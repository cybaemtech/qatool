---
name: Crawler implementation notes
description: Key decisions, bugs fixed, and architecture notes for the website crawler feature
---

# Crawler Implementation Notes

## Concurrency drain-loop bug
The original `crawler-engine.ts` used `await Promise.all(inflight)` to wait for all page audits. This is wrong because `Promise.all` captures the array snapshot at call time; child pages discovered during processing are pushed to `inflight` *after* the call, so they are never awaited. The fix is a drain loop:

```javascript
while (inflight.length > 0) {
  await Promise.race(inflight);
}
```

The `.finally()` on each promise splices it out of `inflight`, so the loop terminates when all promises (including dynamically-added children) have settled.

**Why:** Without the fix, a crawl of N pages reports `pagesAudited=1` (only root) in the final DB write even though child audits continue running in the background and eventually update the counter. The fix makes the final write atomic.

## pdfkit cannot be bundled by esbuild
pdfkit depends on `fontkit`, `brotli`, `png-js`, and `linebreak` which use `@swc/helpers` CJS helpers and dynamic `require()` calls that break esbuild's ESM bundler. All must be marked `external` in `build.mjs`.

**How to apply:** Whenever adding a PDF-related npm package to the api-server, add it to the `external` array in `artifacts/api-server/build.mjs`.

## PDF generator uses pdfkit (real PDFs, not txt)
`lib/pdf-generator.ts` now generates real PDFs (starts with `%PDF-`, opens in PDF viewers). File extension is `.pdf`. Reports are served via `/api/reports/download/:filename` (no auth required on that route — uses `res.download()`).

## Crawl banner in audit-detail
`parentCrawlJob` was fetched but never rendered. The banner is now injected after the `isRunning` card (around line 952 in audit-detail.tsx). It uses violet colours to distinguish it from the blue `isRunning` card.

## histData crash guard
`histData[histData.length - 2]` crashes when there is only 1 (or 0) historical audit entries. Fixed with a null guard: `const prevEntry = histData.length >= 2 ? histData[histData.length - 2] : null`.

## Crawl job auditRunId lookup
`GET /api/crawl-jobs?auditRunId=N` does a two-step lookup: first finds the crawlPage row whose `auditRunId = N`, then fetches the parent crawlJob. This is how the audit-detail crawl banner populates `parentCrawlJob`.

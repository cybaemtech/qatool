---
name: Real scanner implementations
description: All 10 audit scanners replaced with real Playwright/Lighthouse/axe-core implementations; stability test results and adapter contract.
---

## Status (as of 2026-07-31)
All 10 scanners are real — no Math.random(), no fake data.

| Scanner | Adapter | Notes |
|---|---|---|
| performance | Lighthouse CLI via Playwright | Falls back to HTTP fetch if page unreachable |
| accessibility | axe-core via Playwright | Reports real violation IDs and affected element counts |
| seo | Playwright primary, fetch+cheerio fallback | H1/meta/OG/Twitter Card from rendered DOM |
| security | HTTP headers inspection | Raw score (removed grade→score quantization) |
| broken-links | Playwright DOM + HEAD checks | Also checks images |
| console-errors | Playwright CDP | Captures console msgs, uncaught exceptions, failed requests |
| network | Playwright response interception | largestRequests, byResourceType, cache/compression analysis |
| screenshot | Playwright | Real page dimensions via evaluate(); not viewport*3 |
| technology | Two-pass: HTTP+cheerio + Playwright window globals | |
| ai-summary | Rule-based from real scanner outputs | Pipeline injects _scannerOutputs before this scanner runs |

## Stability test (Phase 3)
3 consecutive audits on https://example.com (project id=6):
- Audit 39: overall=78, perf=100, a11y=92, seo=64, bp=100
- Audit 40: overall=78, perf=99,  a11y=92, seo=64, bp=100
- Audit 41: overall=78, perf=100, a11y=92, seo=64, bp=100

Spread = 0 on all non-performance metrics. Performance varies by ±1 point (Lighthouse timing variance on example.com).

## Key design decisions
- `audit-pipeline.ts` injects `_scannerOutputs` into context.options before running `ai-summary` scanner so it can reference real findings.
- `ai-summary-generator.ts` derives all text from actual scanner data — every sentence references real violation IDs, missing header names, SEO issue descriptions, CWV values.
- `audit-execution-service.ts` already calls `auditPipeline.run(context)` — no changes needed there.
- `withPage()` helper in `playwright-browser.ts` manages browser lifecycle; all Playwright scanners use it.

**Why:** The pre-work requirement was to remove all Math.random()/mock/fake/placeholder from audit generation code.

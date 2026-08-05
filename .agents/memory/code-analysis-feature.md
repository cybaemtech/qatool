---
name: Code Analysis Feature
description: How the code analysis feature is built — ESLint integration, routes, DB schema, and build config.
---

## Pattern
- DB table: `code_analysis_jobs` in `lib/db/src/schema/code-analysis.ts`
- API routes: `artifacts/api-server/src/routes/code-analysis.ts` (no api-zod validation — inline validation like crawl-jobs)
- Analyzer lib: `artifacts/api-server/src/lib/code-analyzer.ts`
- PDF generator: `artifacts/api-server/src/lib/code-analysis-pdf.ts`
- Frontend page: `artifacts/qa-portal/src/pages/code-analysis.tsx` (uses direct fetch, NOT generated hooks)

## ESLint Setup
- Uses ESLint v8 (installed as `eslint@8` — v9 API differs significantly)
- `@typescript-eslint/parser` registered via `linter.defineParser("ts-parser", tsParser)`
- `Linter` class (in-memory) preferred over `ESLint` class (requires file system config)
- TS-incompatible rules (no-unused-vars, no-undef) are excluded for .ts/.tsx files
- `eslint`, `@typescript-eslint/parser`, `unzipper`, `multer` added to build.mjs externals

**Why:** ESLint has complex dynamic requires that break esbuild bundling; must be externalized.

## File Upload
- `multer` handles multipart ZIP uploads, stored in OS tmpdir
- `unzipper` extracts to a fresh `mkdtempSync` directory; cleaned up after analysis
- GitHub: downloads archive from `github.com/owner/repo/archive/refs/heads/{main|master|HEAD}.zip`

## Score Formula
`score = max(0, min(100, 100 - min(errors/files,10)*5 - min(warnings/files,10)*2 - min(suggestions/files,10)*0.5))`
Normalizes by files analyzed to avoid penalizing large projects.

## Frontend API calls
Direct fetch + react-query (no codegen) because adding to OpenAPI spec + running codegen carries risk.
Auth token from `localStorage.getItem("qa-portal-token")`.

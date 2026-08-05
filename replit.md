# QA Automation Portal

An enterprise-grade internal QA platform for running automated website audits, tracking bugs, crawling multi-page sites, and generating reports.

## Architecture

**Monorepo (pnpm workspaces):**
- `artifacts/api-server` — Express 5 API server, port 8080
- `artifacts/qa-portal` — React + Vite frontend, port 3000 (PORT env var)
- `lib/db` — Drizzle ORM schema + migrations (PostgreSQL)
- `lib/api-client-react` — Generated React Query hooks (via Orval from OpenAPI spec)
- `lib/api-spec` — OpenAPI 3 spec (`openapi.yaml`)
- `lib/api-zod` — Zod validators generated from OpenAPI spec

## How to Run

Both workflows are configured and managed:
- **API Server** — `PORT=8080 pnpm --filter @workspace/api-server run dev`
- **Start application** — `pnpm --filter @workspace/qa-portal run dev`

### First-time setup
```bash
pnpm install
cd lib/db && pnpm run push   # apply schema to database
pnpm --filter @workspace/db run seed  # seed demo data
```

**Demo login:** `admin@qa.dev` / `password`

## Key Features

- **Website Audits** — Lighthouse + axe-core + Playwright (performance, a11y, SEO, best practices)
- **Website Crawler** — BFS multi-page crawl with configurable depth/page limits, sitemap & robots.txt support
- **Bug Tracker** — Full CRUD with severity, status, comments
- **Screenshot Gallery** — Desktop/tablet/mobile captures per audit
- **PDF Reports** — Auto-generated via PDFKit, downloadable from Reports page
- **JSON Export** — Client-side export from Audit Detail page
- **Dashboard** — Charts, trends, bug severity distribution, recent activity
- **Scheduled Audits** — Cron-based recurring audit runs
- **AI Analysis** — Risk assessment and fix suggestions per audit run

## Database

Replit's managed PostgreSQL (`DATABASE_URL` is runtime-managed — do not set manually).

Schema changes: edit `lib/db/src/schema/`, then run `pnpm --filter @workspace/db run push`.

## API Conventions

- All routes under `/api/...`
- JWT auth via `Authorization: Bearer <token>` (30-day expiry)
- Zod validation on all inputs; Orval-generated client in `lib/api-client-react`

## Known Notes

- Screenshots are captured during real Playwright audits — seeded data has placeholder data only
- PDF generation is async: POST `/api/reports` → background generation → download via `report.fileUrl`
- Crawl jobs run Playwright in the background; concurrency limited to 3 simultaneous pages

## User Preferences

- Do not re-analyze or redesign completed functionality
- Continue only from unfinished tasks, preserving existing APIs and UI
- No placeholder or mock data — all features must use real implementations

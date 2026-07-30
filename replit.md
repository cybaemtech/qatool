# QA Automation Portal

An enterprise-grade internal testing platform for web developers and QA teams to run automated audits, detect bugs, track issues, and generate reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/qa-portal run dev` — run the frontend (port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Demo Credentials

- **Admin**: `admin@qa.dev` / `password`
- **Tester**: `tester@qa.dev` / `password`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (stored in localStorage as `qa-portal-token`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle DB schema (users, projects, audits, bugs, screenshots, reports)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — audit engine, PDF generator, logger
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/qa-portal/src/pages/` — React pages (dashboard, projects, audits, bugs, reports, users, settings)
- `artifacts/qa-portal/src/hooks/use-auth.tsx` — Auth context + JWT management

## Architecture decisions

- JWT stored in localStorage; custom fetch in `lib/api-client-react/src/custom-fetch.ts` attaches it automatically.
- Audit engine runs in the background (non-blocking) after POST /audits — status polled by frontend every 3s.
- PDF reports generate asynchronously; stored as `.txt` files in `artifacts/api-server/reports/` (replace with pdfkit for real PDFs).
- Role-based access: `admin` can manage users; `tester` can run audits and view assigned projects.
- Playwright/Lighthouse integration is simulated — replace `runPlaywrightAudit` and `runLighthouseSimulation` in `audit-engine.ts` with real implementations.

## Product

- **Dashboard**: Summary stats (projects, audits, bugs, critical issues, avg performance score), Recharts charts (audit trends, bug severity pie, performance history), recent activity feed.
- **Projects**: Create, search, filter, sort projects by environment (development/staging/production).
- **Audits**: Run automated audits per project; view Lighthouse scores, findings, screenshots, AI summary; cancel running audits.
- **Bugs**: Track bugs by severity (critical/high/medium/low) and status (open/in_progress/resolved/ignored); inline status update.
- **Reports**: Generate text-based audit reports; download via link.
- **Users (admin only)**: Create and manage users with role assignment.
- **Settings**: Profile and password update.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Setup status

- `DATABASE_URL` is provided by Replit's built-in Postgres (runtime-managed; do not set manually). Schema was pushed with `pnpm --filter @workspace/db run push`.
- Demo data (4 users, 5 projects, 31 audit runs, 67 bugs, 17 reports, 51 notifications, 3 scheduled audits) was seeded via `pnpm --filter @workspace/db run seed`. Re-running truncates and regenerates the same demo dataset. Demo logins: `admin@qa.dev`, `sarah.chen@qa.dev`, `marcus.johnson@qa.dev`, `priya.patel@qa.dev`, all with password `password`.
- Two workflows are configured and running:
  - **Start application** — `pnpm --filter @workspace/qa-portal run dev` (frontend, port 3000)
  - **API Server** — `PORT=8080 pnpm --filter @workspace/api-server run dev` (Express API, port 8080)
- `customFetch` is exported from `lib/api-client-react/src/index.ts` (added during import setup; required by `feedback.tsx`).

## Gotchas

- After any schema change in `lib/db/src/schema/`, run `pnpm run typecheck:libs` before running the API server typecheck, otherwise exports appear missing.
- The audit engine in `audit-engine.ts` simulates Playwright + Lighthouse — it must be replaced with real browser automation for production use.
- JWT secret defaults to a hardcoded string; set `JWT_SECRET` env var in production.
- Reports are `.txt` files; install `pdfkit` in api-server to generate real PDFs and update `pdf-generator.ts`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

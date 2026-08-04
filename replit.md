# QA Automation Portal

An enterprise-grade internal QA management platform with website auditing, bug tracking, project management, reporting, and team collaboration tools.

## Stack

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui (`artifacts/qa-portal/`)
- **Backend**: Express + TypeScript (`artifacts/api-server/`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db/`)
- **API contract**: OpenAPI spec + generated React Query hooks + Zod validators (`lib/api-spec/`, `lib/api-client-react/`, `lib/api-zod/`)

## Running the Project

Two workflows run in parallel:

| Workflow | Command | Port |
|---|---|---|
| API Server | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| Start application | `pnpm --filter @workspace/qa-portal run dev` | 3000 |

The API server builds with esbuild before starting. The frontend is Vite dev server with HMR.

## Database

PostgreSQL is pre-configured via the `DATABASE_URL` environment variable.

To apply schema changes:
```
pnpm --filter @workspace/db run push
```

To seed demo data:
```
pnpm --filter @workspace/db run seed
```

Demo accounts (password: `password`):
- `admin@qa.dev` — admin
- `sarah.chen@qa.dev` — QA engineer
- `marcus.johnson@qa.dev` — QA engineer
- `priya.patel@qa.dev` — QA engineer

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pre-configured) |
| `SESSION_SECRET` | JWT signing secret — **required**; the server will refuse to start without it |

## Key Directories

```
artifacts/
  api-server/   Express API (routes, scanners, audit engine)
  qa-portal/    React frontend (pages, components, hooks)
lib/
  db/           Drizzle schema + migrations + seed script
  api-spec/     OpenAPI spec + codegen config
  api-client-react/  Generated React Query hooks
  api-zod/      Generated Zod validators
```

## User Preferences

- Maintain existing project structure and stack

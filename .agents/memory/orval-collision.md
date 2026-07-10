---
name: Orval schema naming collision
description: Naming OpenAPI request body schemas with a *Body suffix causes Orval to export duplicate identifiers (Zod validator + TS type) that break the lib/api-zod barrel export.
---

## The Rule
Never name OpenAPI component schemas with a `*Body` suffix. Use `*Input` (for create payloads) or `*Update` (for partial update payloads) instead.

**Why:** When a schema is named `CreateFooBody`, Orval generates:
1. A Zod validator `CreateFooBody` in `lib/api-zod/src/generated/api.ts`
2. A TypeScript interface `CreateFooBody` in `lib/api-zod/src/generated/types/`

Both are re-exported from the barrel `index.ts`, causing "has already exported a member named X" TypeScript errors.

Schemas named `FooInput` or `FooUpdate` only generate a TypeScript type — no Zod duplicate — so they work fine.

**How to apply:** When adding any new request body schema to `lib/api-spec/openapi.yaml`, always suffix it `Input` (POST create) or `Update` (PATCH/PUT). Run `pnpm --filter @workspace/api-spec run codegen` after changes; if you see the barrel conflict error, rename any `*Body` schemas to `*Input`/`*Update` and re-run codegen.

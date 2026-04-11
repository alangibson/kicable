# Build Log — kicable

## Project
Cable harness designer — browser-first TypeScript SPA with optional Node.js + SQLite backend.
Spec: PRD.md

---

## Steps

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | §12 Infrastructure & Build Setup | Done | 2026-04-11 |
| 2 | §5 Storage Layer | Done | 2026-04-11 |

---

## Step 1 — §12 Infrastructure & Build Setup

**Files created:**
- `package.json` — pnpm workspace root, scripts: dev / build / build:static / test / lint / format / typecheck
- `pnpm-workspace.yaml` — workspace globs + esbuild build approval
- `tsconfig.base.json` — strict TypeScript base (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride)
- `.prettierrc.json` — Prettier config (singleQuote, trailingComma: all, printWidth: 100)
- `eslint.config.js` — ESLint flat config (typescript-eslint, react, react-hooks, prettier)
- `.gitignore`, `.npmrc`
- `packages/shared/` — package.json, tsconfig.json, vitest.config.ts, src/{types,schemas,utils,storage,index}.ts, tests
- `packages/client/` — package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html, src/{main,App,vite-env.d.ts}, storage/{IndexedDBAdapter,index}.ts, tests

**Decisions:**
- `StorageAdapter` interface lives in `shared` so G3+ ApiAdapter is a drop-in swap with zero app-code changes.
- `VITE_BACKEND_URL` env var controls adapter selection at build time (Vite tree-shakes the unused path).
- Coverage threshold set at 80% on business logic; `src/main.tsx` and `src/index.ts` barrel excluded.
- `@testing-library/react` + jsdom for client tests; node environment for shared tests.

**Verification:**
- `pnpm --filter @kicable/shared build` — clean (tsc)
- `pnpm --filter @kicable/client typecheck` — clean (tsc --noEmit)
- `pnpm --filter @kicable/shared test` — 19 tests pass
- `pnpm --filter @kicable/client test` — 1 test passes
- `pnpm build:static` — dist/ produced (142 kB JS, no server dependency)

---

## Step 2 — §5 Storage Layer

**Files created/modified:**
- `packages/client/src/__tests__/storage/IndexedDBAdapter.test.ts` — 22-test suite using `fake-indexeddb`
- `packages/client/vitest.config.ts` — exclude `src/storage/index.ts` from coverage (entry-point, uses `import.meta.env`)
- `TODO/5-storage-layer.md` — all items checked

**Decisions:**
- `fake-indexeddb/auto` resets per-test via `new IDBFactory()` in `beforeEach` for full isolation
- Proxy used to simulate large buffers for size-guard tests; DataCloneError from fake-indexeddb caught, guards verified before the store call
- `src/storage/index.ts` excluded from coverage (same treatment as `main.tsx`) — no testable logic, only `import.meta.env` branching

**Verification:**
- `pnpm --filter @kicable/client test` — 23 tests pass (22 adapter + 1 App)
- `pnpm --filter @kicable/client test:coverage` — 100% statements/branches/functions/lines on included files

---

## Known Gaps

*(Out-of-scope items discovered during builds go here. Architect triages.)*

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| `StorageAdapter` in `shared` | Allows G3+ ApiAdapter swap with zero app-code changes |
| `idb` for IndexedDB | Typed, promise-based, well-maintained wrapper |
| Flat ESLint config | Required for ESLint 9 |
| Per-package vitest configs | Shared uses node env; client uses jsdom |

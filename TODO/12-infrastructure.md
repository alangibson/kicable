# §12 — Infrastructure & Build Setup (G1)

> Corresponds to PRD §12.1 G1 — Browser-only (Static Site) and §7.4 Maintainability (NFR-M-01 – NFR-M-04).
> This covers everything needed to get a working monorepo and static build before
> feature work begins.

- [x] Scaffold TypeScript monorepo with packages: `client`, `shared` (server package deferred to G3) (NFR-M-01)
- [x] Configure Vite + React + TypeScript for `client` package
- [x] Configure `shared` package with Zod schemas, types, and utility functions used by client (NFR-M-02)
- [x] Set up `pnpm` workspaces and root `package.json` scripts (`dev`, `build`, `test`)
- [x] Configure `VITE_BACKEND_URL` env var: when absent, `IndexedDBAdapter` is used; when present, `ApiAdapter` is used (G3+)
- [x] Add ESLint, Prettier, and TypeScript strict mode
- [x] Set up Vitest for unit tests; configure coverage threshold ≥ 80% on business logic and `shared` modules
- [x] Static build script: `VITE_BACKEND_URL= pnpm --filter client build` produces a servable `dist/` with no runtime server dependency

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
| 3 | §6.2 Schematic Editor | Done | 2026-04-12 |
| 4 | §6.3 Component Library | Done | 2026-04-12 |
| 5 | §6.5 Wire & Cable General Properties | Done | 2026-04-13 |

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

---

## Step 3 — §6.2 Schematic Editor

**Files created:**
- `packages/client/src/workers/autosave.worker.ts` — background Web Worker that writes project to IndexedDB (NFR-R-01)
- `packages/client/src/schematic/useEditorState.ts` — schematic state + undo/redo (100-step stack, FR-SE-08) + worker-backed auto-save (FR-SE-09)
- `packages/client/src/schematic/canvas/ConnectorNode.tsx` — custom RF node with per-pin handles (FR-SE-02, FR-SE-03)
- `packages/client/src/schematic/canvas/SpliceNodeComponent.tsx` — 3-way/4-way junction node (FR-SE-05)
- `packages/client/src/schematic/canvas/WireEdge.tsx` — custom RF edge with waypoints + double-click to add (FR-SE-04)
- `packages/client/src/schematic/canvas/SchematicCanvas.tsx` — ReactFlow canvas (FR-SE-01 to FR-SE-07, FR-SE-10, NFR-P-01)
- `packages/client/src/schematic/LibraryPanel.tsx` — draggable component library (FR-SE-02)
- `packages/client/src/schematic/PropertiesPanel.tsx` — property editor for selected node/wire (FR-SE-06)

**Files modified:**
- `packages/shared/src/schematic.ts` — added `SpliceNodeSchema` / `SpliceNode` type + `spliceNodes` array in `Schematic`
- `packages/client/src/schematic/SchematicEditor.tsx` — wired Library | Canvas | Properties three-column layout; undo/redo buttons in header
- `TODO/6.2-schematic-editor.md` — all items checked

**Decisions:**
- RF nodes/edges maintain their own state; position changes sync back to schematic on every `onNodesChange` position event
- Splice nodes stored in `schematic.spliceNodes` (new shared field) to avoid polluting `connectors` with virtual components
- Worker uses `openDB` directly (same schema as `IndexedDBAdapter`) — cleaner than sharing a main-thread connection
- Undo stack capped at 100 entries (`HISTORY_MAX`) to bound memory use
- `WireEdge` uses double-click to add waypoints (single-click is edge selection)
- RF `snapGrid: [16, 16]` provides pin-snap behaviour for placement
- `proOptions: { hideAttribution: true }` — MIT build, attribution not needed

**Verification:**
- `pnpm --filter @kicable/shared build` — clean
- `pnpm --filter @kicable/client typecheck` — no new errors (pre-existing test errors unchanged)
- `pnpm --filter @kicable/shared test` — 19 tests pass
- `pnpm --filter @kicable/client test` — 38 tests pass

---

---

## Step 4 — §6.3 Component Library

**Files created:**
- `packages/shared/src/builtinLibrary.ts` — 24 built-in components (Deutsch DT ×8, AMP Superseal ×8, TE MCP ×8) + AWG/mm² gauge arrays (FR-CL-01)
- `packages/client/src/library/useLibrary.ts` — CRUD hook covering component save/delete (version bump on update), image attach/rename/reorder/delete/data-URL loader, STEP attach/remove/download, and built-in seeder (FR-CL-02, FR-CL-03, FR-CL-06–FR-CL-13, FR-CL-15–FR-CL-18)
- `packages/client/src/library/libraryIo.ts` — JSON export (images embedded as Base64 data URIs) + JSON import (restores blobs, re-assigns IDs to prevent collisions) (FR-CL-04, FR-CL-12)
- `packages/client/src/library/ComponentEditor.tsx` — form for part number / manufacturer / pin count / gender / description + per-pin label + function dropdowns (FR-CL-02, FR-CL-03)
- `packages/client/src/library/ImageGallery.tsx` — image attachment (MIME/size guard), view-type selector, primary star, drag-to-reorder, rename, recategorize, delete (FR-CL-07–FR-CL-10, FR-CL-13)
- `packages/client/src/library/StepFilePanel.tsx` — STEP attach (ext guard, size guard, 50 MB warning), metadata display, download (model/step MIME), external viewer link, remove (FR-CL-15–FR-CL-19)
- `packages/client/src/library/ComponentLibraryScreen.tsx` — full library management screen: list + filter, new/edit/delete component, tab-switched detail panel (Details / Images / STEP), Export JSON + Import JSON (FR-CL-01–FR-CL-04, FR-CL-06–FR-CL-13, FR-CL-15–FR-CL-19)
- `packages/client/src/__tests__/library/libraryIo.test.ts` — 10 tests covering export/import round-trips, Base64 embedding, missing-blob graceful handling, format validation, and built-in component shape checks

**Files modified:**
- `packages/shared/src/schematic.ts` — added `componentVersion` field to `ConnectorInstanceSchema` (FR-CL-06)
- `packages/shared/src/index.ts` — re-export `builtinLibrary`
- `packages/client/src/schematic/LibraryPanel.tsx` — loads primary image as thumbnail (FR-CL-09); now accepts `storage` prop
- `packages/client/src/schematic/SchematicEditor.tsx` — passes `storage` to LibraryPanel; fills `componentVersion` on ConnectorInstance creation
- `packages/client/src/schematic/canvas/SchematicCanvas.tsx` — `componentVersion: comp.version` on ConnectorInstance create
- `packages/client/src/App.tsx` — adds `library` screen state; renders ComponentLibraryScreen
- `packages/client/src/projects/ProjectListScreen.tsx` — adds `onOpenLibrary` prop + "Component Library" button in header
- `packages/client/src/__tests__/projects/ProjectListScreen.test.tsx` — added `onOpenLibrary={() => {}}` to fix required prop
- `TODO/6.3-component-library.md` — all items checked

**Decisions:**
- Library JSON export re-assigns component/image IDs on import to prevent collision when importing the same file twice
- STEP binaries excluded from library JSON (can be 200 MB); CHD format already handles STEP blobs
- Built-in seed fires only when library is empty; seeds are indistinguishable from user-created components once stored
- `componentVersion` defaults to 0 on the schema so existing schematics round-trip without migration

**Verification:**
- `pnpm --filter @kicable/shared build` — clean
- `pnpm --filter @kicable/client typecheck` — no new errors (pre-existing test errors unchanged)
- `pnpm --filter @kicable/shared test` — 19 tests pass
- `pnpm --filter @kicable/client test` — 48 tests pass (10 new)

---

---

## Step 5 — §6.5 Wire & Cable General Properties

**Files created:**
- `packages/shared/src/wireColors.ts` — ISO 6722 + SAE J1128 color palettes, AWG diameter table, `calcBundleDiameter` (FR-WG-02, FR-WG-03)
- `packages/client/src/schematic/canvas/CableEdge.tsx` — React Flow edge component for routed cables with conductor color stripes (FR-WG-05)
- `packages/shared/src/__tests__/wireGeneral.test.ts` — 24 tests covering color palettes, diameter calc, signal propagation

**Files modified:**
- `packages/shared/src/schematic.ts` — `bundleId` on `WireSchema`; `BundleSchema`; routing fields on `CableSchema` (`fromConnectorId`, `toConnectorId`, `waypoints`); `propagateSignalName()`; `bundles` array on `Schematic`; `'bundle'` kind in `SearchResultKind` (FR-WG-03–FR-WG-05)
- `packages/shared/src/index.ts` — re-export `wireColors`
- `packages/client/src/schematic/useEditorState.ts` — `upsertBundle`/`removeBundle` mutators; signal propagation in `upsertWire` (FR-WG-03, FR-WG-04)
- `packages/client/src/schematic/PropertiesPanel.tsx` — gauge selector (AWG/mm²), color standard preset picker, bundle assignment + OD readout, cable assignment (FR-WG-01–FR-WG-03, FR-WG-05)
- `packages/client/src/schematic/canvas/WireEdge.tsx` — always-visible color swatch dot at edge midpoint (FR-WG-02)
- `packages/client/src/schematic/canvas/SchematicCanvas.tsx` — `CableEdge` registered; cable edges rendered for routed cables; cable delete handling (FR-WG-05)
- `packages/client/src/components/WireListPanel.tsx` — Bundle column added (FR-WG-03)
- `packages/client/src/components/GlobalSearch.tsx` — `'bundle'` kind added to label/color maps

**Decisions:**
- `BundleSchema` is a separate entity from `CableSchema`: bundles = groupings of individual wires; cables = multi-conductor sheathed cables
- Signal propagation is one-hop: when a wire's signalName changes, all wires sharing a connector+pin endpoint get the same name immediately
- Cable edges render with `zIndex: -1` so they appear behind wire edges
- `CableEdge` shows up to 8 conductor color swatches in its label; extra count is shown as "+N"
- `calcBundleDiameter` uses IPC-D-317A fill-ratio area method; default fill ratio = 0.6

**Verification:**
- `npm run build -w @kicable/shared` — clean
- `npm run typecheck -w @kicable/client` — no new errors (pre-existing test errors unchanged)
- `npm run test -w @kicable/shared` — 43 tests pass (24 new)
- `npm run test -w @kicable/client` — 48 tests pass (unchanged)

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

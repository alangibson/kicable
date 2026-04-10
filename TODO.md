# TODO — G1: Browser-Only SPA

**Goal:** Ship a fully functional browser-only SPA. Engineers design harnesses, manage libraries, and generate all manufacturing documents entirely in the browser — no backend, no database, no server, no auth. State persists in IndexedDB; projects and libraries import/export as files.

**Constraint:** Zero runtime dependencies on a backend. Every feature must work offline with no network requests. G1 code must require no rewriting when G3 backend is added.

---

## 1. Monorepo & Infrastructure

- [ ] Scaffold TypeScript monorepo with packages: `client`, `shared` (server deferred to G3)
- [ ] Configure Vite + React + TypeScript for `client` package
- [ ] Configure `shared` package with Zod schemas, types, and utility functions used by client
- [ ] Set up `pnpm` workspaces and root `package.json` scripts
- [ ] Configure `VITE_BACKEND_URL` env var: when absent, IndexedDB adapter is used
- [ ] Add ESLint, Prettier, and TypeScript strict mode
- [ ] Set up Vitest for unit tests; configure coverage threshold ≥ 80% on business logic and shared modules
- [ ] Static build script: `VITE_BACKEND_URL= pnpm --filter client build` produces a servable `dist/`

---

## 2. Storage Layer

- [ ] Define `StorageAdapter` interface in `shared` (methods: project CRUD, library CRUD, blob store)
- [ ] Implement `IndexedDBAdapter` in `client` using `idb` (typed, promise-based)
  - [ ] Store projects, libraries, images (ArrayBuffer keyed by `component_id/image_id`), and STEP files
  - [ ] Warn user when IndexedDB quota approaches limit
  - [ ] Warn user when a STEP file exceeds 50 MB before storing
- [ ] Wire `IndexedDBAdapter` as the active adapter when `VITE_BACKEND_URL` is unset

---

## 3. Project Management

- [ ] Project list screen: create, rename, duplicate, delete projects (FR-PM-01)
- [ ] Store project metadata: name, description, author, created/updated timestamps, schematic version (FR-PM-02)
- [ ] Export project as `.chd` file (JSON zip, self-contained) (FR-PM-03)
- [ ] Import `.chd` file: unpack and restore project + assets to IndexedDB (FR-PM-03)
- [ ] Persist all projects in IndexedDB; surface prominent **Export project** button (FR-PM-04)
- [ ] Show storage quota warning banner when IndexedDB usage approaches limit (FR-PM-04)

---

## 4. Schematic Editor (Canvas)

- [ ] Infinite, pannable, zoomable canvas using React Flow (FR-SE-01)
- [ ] Drag connectors from library panel onto canvas to place nodes (FR-SE-02)
- [ ] Draw wires by clicking a pin and dragging to another pin; snap to valid pins only (FR-SE-03)
- [ ] Add waypoints to wire segments by click-drag on the segment (FR-SE-04)
- [ ] Insert splice nodes on any wire (3-way and 4-way junctions) (FR-SE-05)
- [ ] Select any node or wire; show properties in right-hand Properties Panel (FR-SE-06)
- [ ] Multi-select via rubber-band drag; support group move (FR-SE-07)
- [ ] Undo/redo stack with ≥ 100 steps (FR-SE-08)
- [ ] Auto-save on every user action, debounced at 2 s, targeting `StorageAdapter` (FR-SE-09)
  - [ ] Run auto-save in a background worker to avoid blocking the UI thread (NFR-R-01)
- [ ] Keyboard shortcuts: delete, undo, redo, zoom in/out, pan (FR-SE-10)
- [ ] Canvas renders 500+ nodes and 1000+ wires at ≥ 60 fps (NFR-P-01)

---

## 5. Component Library

### 5.1 Core Library

- [ ] Ship built-in library with common connectors (Deutsch DT, AMP Superseal, TE MCP) and wire gauges (AWG and metric) (FR-CL-01)
- [ ] Custom connector creation: part number, manufacturer, pin count, pin layout, gender, description (FR-CL-02)
- [ ] Per-pin function labels (e.g., SIGNAL, GND, PWR) (FR-CL-03)
- [ ] Export library to JSON; import library from JSON (FR-CL-04)
- [ ] Version library items; schematic records which version of each component was used (FR-CL-06)

### 5.2 Component Images

- [ ] Attach images to components (JPEG, PNG, WebP, SVG; max 20 MB each) (FR-CL-07)
- [ ] Categorize images by view type: `front`, `rear`, `side`, `assembled`, `installed`, `datasheet_scan`, `other`; multiple per category (FR-CL-08)
- [ ] Designate one image as **primary**; display as thumbnail in library panel and canvas node (FR-CL-09)
- [ ] Image gallery panel: drag-to-reorder, rename, recategorize, delete (FR-CL-10)
- [ ] Store images in IndexedDB as ArrayBuffers keyed by `component_id/image_id` (FR-CL-11, FR-CL-13)
- [ ] Embed images as Base64 data URIs in JSON library exports; extract on import (FR-CL-12)

### 5.3 Component STEP Files

- [ ] Attach one STEP file per component (`.step`/`.stp`; max 200 MB; warn at 50 MB) (FR-CL-15, FR-CL-16)
- [ ] Display STEP file metadata: filename, size, upload date (FR-CL-17)
- [ ] Download button for STEP file; correct MIME type (`model/step`) and `Content-Disposition: attachment` (FR-CL-18)
- [ ] No in-browser STEP rendering; link to external viewer is acceptable (FR-CL-19)
- [ ] Include STEP file in `.chd` zip as `step/<component_id>.step` (FR-CL-20)

---

## 6. Wire & Cable Properties

### 6.1 General Wire/Cable Properties

- [ ] Wire properties: wire ID (auto-generated, editable), gauge (AWG or mm²), color, signal name, notes (FR-WG-01)
- [ ] Wire color standards: ISO 6722, SAE J1128, or custom; show color swatch on canvas edge (FR-WG-02)
- [ ] Group wires into bundles; auto-calculate bundle outer diameter from gauges and fill ratio (FR-WG-03)
- [ ] Auto-propagate signal names to matching pins across schematic (FR-WG-04)
- [ ] Place cables as single routed entities; inner conductors inherit routed path but have individual signal names, colors, strip defs (FR-WG-05)

### 6.2 Dimensional Definitions

- [ ] Overall length with three modes per wire: `schematic`, `override`, `formula` (FR-WP-01, FR-WP-02)
- [ ] Per-project canvas scale (mm/px or in/px); changing scale recalculates all `schematic`-mode lengths immediately (FR-WP-03)
- [ ] Store lengths internally in mm; display in user-chosen unit (mm, cm, inches) (FR-WP-04)
- [ ] Per-project global routing slack % (default 0%); individual wires can opt out (FR-WP-05)
- [ ] Named segments: name, length, optional note; ordered and drag-reorderable (FR-WP-06, FR-WP-07, FR-WP-09)
- [ ] Live discrepancy indicator: segment sum vs overall length (FR-WP-08)
- [ ] Strip definitions per end (End A / End B) in collapsible Properties Panel accordion (FR-WP-11, FR-WP-13):
  - Strip length, strip type (`full`, `window`, `step`), insulation OD, tinning required/length, terminal type, terminal insertion depth, notes
- [ ] Step strip type unlocks multi-layer sub-table (FR-WP-12)
- [ ] Default strip values from terminal component library; pre-populate on terminal assignment; overridable (FR-WP-14)
- [ ] Cable-specific fields at cable level: outer jacket strip, shield treatment, drain wire length, pigtail length, tape/heat-shrink start and length for each end (FR-WP-15)
- [ ] Inner conductors of a cable each have independent strip definitions (FR-WP-16)

### 6.3 Length DRC Rules

- [ ] LEN-01 Warning: overall length is 0 or unset
- [ ] LEN-02 Warning: segment lengths don't sum to overall length (tolerance ±0.5 mm)
- [ ] LEN-03 Error: strip length > overall length / 2
- [ ] LEN-04 Warning: tinning length > strip length
- [ ] LEN-05 Warning: terminal insertion depth > strip length
- [ ] LEN-06 Warning: jacket strip length > overall length
- [ ] LEN-07 Info: overall length differs from schematic-calculated by > 20% (override mode)

---

## 7. Cable Split & Join

### 7.1 Split

- [ ] Right-click cable segment → **Split cable here**; inserts split node at click point (FR-CS-01)
- [ ] On split: terminate cable at split node; create one wire per inner conductor preserving signal name, gauge, color, End A strip; assign End A of new wires to split node (FR-CS-02)
- [ ] Split node stores: originating cable, conductor-to-wire mapping, fan-out length (default 0 mm, editable) (FR-CS-03)
- [ ] Fan-out wires are independently routable after split (FR-CS-04)
- [ ] Cable retains jacket/shield/dimensional properties up to split node; fan-out wires have own strip defs (FR-CS-05)
- [ ] Support multiple split nodes on the same cable (FR-CS-06)
- [ ] Delete split node: prompt to re-merge into cable OR leave fan-out wires as standalone (FR-CS-07)

### 7.2 Join

- [ ] Select 2+ wires/fan-outs → right-click or toolbar → **Join into cable** (FR-CJ-01)
- [ ] Join dialog: cable ref ID, cable type (library or create inline), conductor order (drag), fan-in length per end (FR-CJ-02)
- [ ] On confirm: create `join_node` at inferred convergence point; assign wires as inner conductors preserving names/gauges/colors; route new cable from join node (FR-CJ-03)
- [ ] Dissolve join node: cable removed, inner conductors revert to standalone wires (FR-CJ-05)
- [ ] Support chaining split → join nodes (branch harness topology) (FR-CJ-06)

### 7.3 Split/Join DRC Rules

- [ ] JOIN-01 Warning: conductors in cable have mixed gauges
- [ ] JOIN-02 Error: join node has fewer than 2 incoming conductors
- [ ] SPLIT-01 Warning: fan-out wire has no further connection
- [ ] SPLIT-02 Info: fan-out length is 0 mm
- [ ] SPLIT-03 Error: split node references conductor position not in cable's component definition

---

## 8. Protective Materials

### 8.1 Library

- [ ] Add `protective_material` component type with categories: `felt_tape`, `fabric_tape`, `heat_shrink`, `corrugated_loom`, `smooth_loom`, `spiral_wrap`, `conduit`, `rubber_grommet`, `cable_tie`, `other` (§6.7.1)
- [ ] Category-specific properties (width, OD, shrink ratio, split flag, etc.)
- [ ] Ship built-in catalog entries (Hellermann Tyton, TE, Raychem part numbers) (FR-PM-10)
- [ ] Protective material components support image and STEP attachments (FR-PM-11)

### 8.2 Applying Materials

- [ ] Coverage span model: (target wire/cable/bundle/fan-out, start_offset_mm, end_offset_mm) (FR-PM-01)
- [ ] Reference full length, named segment, or arbitrary offset from End A (FR-PM-02)
- [ ] Multiple materials on same span with `layer_order` for nesting (FR-PM-03)
- [ ] Visualize coverage spans on canvas as colored overlay bands with legend; stack overlapping layers (FR-PM-04)
- [ ] Add coverage span via Properties Panel **Add protection** button (FR-PM-05)
- [ ] Add coverage span via right-click → **Add protection here** (pre-fill offset to click point) (FR-PM-05)
- [ ] Coverage span editor fields: material, start/end offset, named segment, layer order, quantity/wrap coverage, notes (FR-PM-06)
- [ ] Calculate total tape length: span length × tape width × overlap % (FR-PM-07)
- [ ] Check loom/conduit inner diameter ≥ bundle outer diameter of covered conductors (FR-PM-08)
- [ ] Check heat-shrink pre-shrink inner diameter ≥ conductor/cable OD; display post-shrink diameter informatively (FR-PM-09)

### 8.3 Protective Material DRC Rules

- [ ] PROT-01 Warning: loom/conduit inner diameter < bundle OD
- [ ] PROT-02 Warning: heat-shrink pre-shrink ID < conductor/cable OD
- [ ] PROT-03 Info: coverage span extends beyond wire/cable length
- [ ] PROT-04 Warning: overlapping spans of same material type and layer order
- [ ] PROT-05 Warning: cable tie spacing > 300 mm on unsupported span (configurable threshold)

---

## 9. Document Generation

All generation runs in-browser via PDFKit (browser build) and ExcelJS; output via FileSaver.js.

- [ ] **Wire List:** table of all wires — Wire ID, From Connector/Pin, To Connector/Pin, Gauge, Color, Overall Length, Signal Name; export PDF, XLSX, CSV (FR-DG-01)
- [ ] **BOM:** aggregated connectors, terminals, seals, wire by part number with quantities + Protective Materials section; export PDF, CSV (FR-DG-02)
- [ ] **Cut Sheet:** per-wire/cable manufacturing sheet with all dimensional, strip, cable-specific, and protection data; export PDF, CSV (FR-DG-03)
- [ ] **Connector Face Diagram:** auto-rendered pin-face view per connector with pin assignments; inset primary image if available; export PDF (FR-DG-04)
- [ ] **Assembly Drawing:** schematic-level PDF with protective material overlays, material legend, split/join callouts, fan-out length annotations (FR-DG-05)
- [ ] Customizable templates: company logo, header/footer fields, color scheme (FR-DG-07)
- [ ] Run DRC validation before generation; highlight errors in UI; block export on errors, allow on warnings (FR-DG-08)
- [ ] Document generation for 200-wire harness completes in < 3 s in-browser (success metric)

---

## 10. DRC Engine

- [ ] DRC runs automatically on every save and on-demand via toolbar button (FR-DV-01)
- [ ] Schematic rules: unconnected required pins, duplicate wire IDs, gauge mismatch, circular routes, missing required signal names (FR-DV-02)
- [ ] Length and strip rules: see §6 tasks above (FR-DV-03)
- [ ] Cable split/join rules: see §7 tasks above (FR-DV-04)
- [ ] Protective material rules: see §8 tasks above (FR-DV-05)
- [ ] DRC results panel: grouped by category (Schematic, Lengths, Split/Join, Protection); clickable items zoom canvas to offending element (FR-DV-06)
- [ ] Errors block document export; warnings and info messages are non-blocking (FR-DV-07)

---

## 11. Search & Navigation

- [ ] Global search bar: find connectors, wires, cables, signals, protective material spans by name or ID; navigate canvas to result (FR-SN-01)
- [ ] Wire list panel: live filter by any column value (FR-SN-02)

---

## 12. Non-Functional

- [ ] All interactive elements keyboard navigable (NFR-A-01)
- [ ] WCAG 2.1 AA color contrast compliance (NFR-A-02)
- [ ] ARIA labels on canvas elements where practical (NFR-A-03)
- [ ] No secrets in the frontend bundle (NFR-S-01)
- [ ] Canvas performance: 500+ nodes, 1000+ wires at ≥ 60 fps (NFR-P-01)
- [ ] IndexedDB writes complete within 50 ms for single-record operations (NFR-P-02)
- [ ] Zod schemas in `shared` package; auto-validated at runtime on all internal API contracts (NFR-M-02, NFR-M-04)
- [ ] New-user time-to-first-harness-schematic < 15 minutes (success metric)
- [ ] Zero network requests during normal use — confirmed by DevTools network panel (success metric)
- [ ] Full feature parity with no internet connection (success metric)

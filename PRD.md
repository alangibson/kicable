# Product Requirements Document
## Cable Harness Designer
**Version:** 1.2  
**Date:** April 8, 2026  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [System Architecture](#5-system-architecture)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Data Model](#8-data-model)
9. [API Design](#9-api-design)
10. [UI/UX Requirements](#10-uiux-requirements)
11. [Technology Stack](#11-technology-stack)
12. [Deployment](#12-deployment)
13. [Out of Scope](#13-out-of-scope)
14. [Open Questions](#14-open-questions)

**Changelog**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-08 | Initial draft |
| 1.1 | 2026-04-08 | Added component image uploads, STEP file uploads, detailed wire/cable length & strip definitions |
| 1.2 | 2026-04-08 | Added cable split/join operations; protective materials (tape, loom, conduit, heat-shrink, etc.) |

---

## 1. Executive Summary

Cable Harness Designer is a full-stack TypeScript application for designing, documenting, and managing electrical cable harnesses. Inspired by RapidHarness, it targets electrical engineers and wire harness manufacturers who need a tool that runs both locally (offline-capable desktop use) and in the cloud (team collaboration). The application uses SQLite as its database — via better-sqlite3 locally and a cloud-compatible SQLite layer (e.g., Turso/libSQL) when deployed — ensuring a single schema and migration path across both environments.

Components support rich media attachments: engineers can upload reference photographs of finished connectors and assemblies (JPEG, PNG, WebP), as well as STEP files for 3D mechanical reference. Wire and cable definitions include precise dimensional data — overall length, segment lengths, strip lengths at each end, and shield/drain treatment — so that cut sheets carry everything the shop floor needs without manual annotation. Cables can be split into individual conductors at any point on the canvas, and separate wires or cables can be joined into a new multi-conductor assembly. Protective materials — felt tape, corrugated loom, conduit, heat-shrink tubing, spiral wrap, and others — can be applied to any segment of the harness and are included in the BOM and cut sheets.

---

## 2. Product Overview

### 2.1 What Is a Cable Harness?

A cable harness (or wire harness) is an assembly of cables or wires bound together to transmit signals or electrical power. Engineers must define connectors, wire gauges, splice points, and routing paths, then produce manufacturing-ready documentation: schematics, cut sheets, and bills of materials.

### 2.2 Competitive Reference — RapidHarness

RapidHarness is a web-based harness design tool offering:
- Graphical schematic editor for connector and wire layout
- Automatic wire list and BOM generation
- Connector and wire library management
- PDF/CSV export of manufacturing documents

Cable Harness Designer targets feature parity with RapidHarness while adding:
- Local-first operation (works fully offline)
- Open SQLite storage (inspectable, scriptable, portable)
- TypeScript throughout (frontend + backend)
- Plugin-friendly architecture for custom component libraries
- Component image gallery: photos of finished connectors and assemblies attached directly to library entries
- STEP file attachment per component for 3D mechanical reference
- Precise wire/cable dimensional definitions: total length, segment lengths, per-end strip lengths, insulation removal depths, and shield/drain treatment

---

## 3. Goals & Success Metrics

### 3.1 Goals

Goals are listed in delivery order. Each goal is a shippable milestone; later goals build on earlier ones.

| # | Goal |
|---|------|
| G1 | **Ship a fully functional browser-only SPA.** Engineers can design harnesses, manage libraries, and generate all manufacturing documents entirely in the browser — no backend, no database, no server, no authentication. State is persisted in `IndexedDB`; projects and libraries are imported/exported as files. |
| G2 | Auto-generate manufacturing documents (wire list, BOM, cut sheet, assembly drawing) from the schematic — implemented as part of G1, running entirely client-side |
| G3 | Add a local Node.js + SQLite backend so projects, component libraries, images, and STEP files persist across sessions on a single machine without manual export/import — no authentication required |
| G4 | Add cloud deployment with user accounts, JWT authentication, team collaboration, and S3-backed file storage |
| G5 | Support component libraries that are importable, exportable, and version-controlled across all deployment configurations |
| G6 | Provide a clean REST + WebSocket API (G3 and G4) so third-party tools can integrate |

> **G1 constraint:** The browser-only milestone must have zero runtime dependencies on a backend. Every feature — schematic editing, DRC, document generation, component library, protective materials, cable split/join — must work with no network requests. The backend introduced in G3 is additive; no G1 code should need to be rewritten to accommodate it.

### 3.2 Success Metrics

| Metric | Target | Goal |
|--------|--------|------|
| Time to first harness schematic (new user, browser-only) | < 15 minutes | G1 |
| Document generation time (200-wire harness, in-browser) | < 3 seconds | G1–G2 |
| Browser-only: zero network requests during normal use | 100% — confirmed by devtools network panel | G1 |
| Browser-only: full feature parity with no internet connection | All features functional offline | G1 |
| Local server API response time (p95) | < 200 ms for CRUD endpoints | G3 |
| Test coverage on business logic / shared modules | ≥ 80% | G1+ |

---

## 4. User Personas

### 4.1 Alex — Electrical Design Engineer
Works in a mid-size automotive supplier. Designs new harness layouts from scratch, imports connector specs from supplier PDFs, and hands off to manufacturing. Needs fast schematic entry and reliable BOM export. **In G1**, Alex runs the app directly in Chrome with no installation — opens a URL, designs a harness, and exports a PDF. **In G3+**, his work persists automatically in SQLite and he can attach connector photos.

### 4.2 Maria — Harness Manufacturing Engineer
Receives designs from engineers, validates wire lengths and splice positions, and generates cut sheets for the shop floor. Needs accurate wire lists and clear visual output. **In G1**, she opens a `.chd` project file exported by Alex, reviews it in her browser, and prints the cut sheet. **In G4**, she accesses shared projects directly from the cloud with no file hand-off.

### 4.3 Dev Team — Integration Developer
Builds internal tooling that pulls BOM data into an ERP system. Needs a documented REST API with stable endpoints and authentication tokens. This persona is only relevant from **G3** onwards when the backend exists.

---

## 5. System Architecture

### 5.1 High-Level Overview

The architecture is delivered in stages matching the goals. **G1** ships only the top box; **G3** adds the bottom box.

**G1 — Browser-only (no backend)**
```
┌──────────────────────────────────────────────────────────┐
│                 React + TypeScript SPA                   │
│                                                          │
│  ┌─────────────────┐  ┌───────────────────────────────┐ │
│  │  Canvas Editor  │  │ Panels: Wire List, BOM, Libs, │ │
│  │  (React Flow)   │  │ Protection, DRC               │ │
│  └─────────────────┘  └───────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Browser Storage Layer               │   │
│  │  IndexedDB (projects, libraries, images, STEP)   │   │
│  │  in-memory document generation (PDFKit-browser,  │   │
│  │  ExcelJS)  ·  file import/export via File API    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
          No network requests. No server. No login.
```

**G3+ — Local server or cloud (additive)**
```
┌──────────────────────────────────────────────────────────┐
│           React SPA (same bundle as G1)                  │
│           detects backend and switches storage layer     │
└──────────────┬───────────────────────────────────────────┘
               │ REST / WebSocket (G3+)
┌──────────────▼───────────────────────────────────────────┐
│                     API Server                           │
│   Node.js + Fastify (TypeScript)                         │
│   ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│   │ Projects │  │Components│  │ Document Generator  │   │
│   │ Router   │  │ Router   │  │ (server-side PDF)   │   │
│   └──────────┘  └──────────┘  └────────────────────┘   │
│   ┌──────────────────────┐  ┌───────────────────────┐   │
│   │   Repository Layer   │  │   File Storage Layer  │   │
│   │ better-sqlite3(G3)   │  │ Local fs  │  S3 (G4)  │   │
│   │ libSQL/Turso (G4)    │  │           │            │   │
│   └──────────────────────┘  └───────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Deployment Configurations

| Concern | G1 — Browser-only | G3 — Local server | G4 — Cloud |
|---------|-------------------|-------------------|------------|
| Backend | **None** | Node.js on localhost | Node.js on server |
| Database | **IndexedDB** (in-browser) | SQLite via better-sqlite3 | libSQL / Turso |
| Auth | **None** | **None** | JWT + user accounts |
| File storage | **In-browser** (images/STEP stored in IndexedDB; large files warn the user) | Local filesystem | S3-compatible object storage |
| Document generation | **In-browser** (PDFKit browser build, ExcelJS) | Server-side (same libs, richer templates) | Same as local server |
| Collaboration | Single user, file-based sharing (`.chd` export) | Single user | Real-time via WebSocket |
| Installation | **None — open a URL** | `pnpm install && pnpm dev` | Docker / hosted |

**Storage layer abstraction:** The client contains a `StorageAdapter` interface. In G1 it is backed by IndexedDB. In G3+ it is backed by the REST API. The rest of the application code is identical in both cases — no feature forks, no conditional UI.

A `VITE_BACKEND_URL` environment variable is set at build time. When absent (G1), the IndexedDB adapter is used. When present, the API adapter is used.

---

## 6. Functional Requirements

### 6.1 Project Management

**FR-PM-01** Users can create, rename, duplicate, and delete projects.  
**FR-PM-02** Each project stores metadata: name, description, author, created/updated timestamps, schematic version.  
**FR-PM-03** Projects can be exported as a self-contained `.chd` file (JSON zip) and re-imported on any instance — this is the primary sharing mechanism in G1.  
**FR-PM-04** In G1, all projects are stored in the browser's IndexedDB. There is no account, no sync, and no server. If the user clears browser storage, projects are lost unless exported. The UI prominently surfaces an "Export project" button and warns on storage quota approach.  
**FR-PM-05** In G3+, the server provides persistent storage and project history (last 50 auto-saved snapshots); users can restore any snapshot. Cloud mode (G4) additionally supports project sharing via invite link with read or read-write permission levels.

### 6.2 Schematic Editor

**FR-SE-01** The canvas is an infinite, pannable/zoomable workspace.  
**FR-SE-02** Users can place connector nodes by dragging from the component library panel.  
**FR-SE-03** Wires are drawn by clicking a connector pin and dragging to another pin; the wire snaps to valid pins only.  
**FR-SE-04** Wires can have waypoints added by clicking on the wire segment and dragging.  
**FR-SE-05** Splice nodes can be inserted on any wire to create a 3-way or 4-way junction.  
**FR-SE-06** Every node and wire can be selected; properties appear in the right-hand panel.  
**FR-SE-07** Multi-select via rubber-band drag; group move supported.  
**FR-SE-08** Undo/redo stack with at least 100 steps.  
**FR-SE-09** Canvas auto-saves on every user action (debounced at 2 seconds). In G1 the target is IndexedDB; in G3+ the target is the server API. The auto-save mechanism is identical from the editor's perspective — it calls the `StorageAdapter` interface.  
**FR-SE-10** Keyboard shortcuts for common actions (delete, undo, redo, zoom, pan).

### 6.3 Component Library

**FR-CL-01** The system ships with a built-in library of common connectors (Deutsch DT, AMP Superseal, TE MCP, etc.) and wire gauges (AWG and metric).  
**FR-CL-02** Users can create custom connectors by specifying: part number, manufacturer, pin count, pin layout, gender, and a description.  
**FR-CL-03** Each connector pin can be labeled with a function (e.g., "SIGNAL", "GND", "PWR").  
**FR-CL-04** Component libraries can be exported to JSON and imported from JSON, enabling sharing across teams.  
**FR-CL-05** Cloud mode provides a shared team library visible to all project members.  
**FR-CL-06** Library items are versioned; the schematic records which version of a component was used at design time.

#### 6.3.1 Component Image Attachments

**FR-CL-07** Each component can have one or more images attached. Supported formats: JPEG, PNG, WebP, SVG. Maximum file size per image: 20 MB.  
**FR-CL-08** Images are categorized by view type: `front`, `rear`, `side`, `assembled`, `installed`, `datasheet_scan`, `other`. Multiple images per category are allowed.  
**FR-CL-09** One image per component can be designated the **primary image**; it appears as the thumbnail in the library panel and on the canvas node.  
**FR-CL-10** The component editor includes an image gallery panel with drag-to-reorder, rename, recategorize, and delete actions.  
**FR-CL-11** In G1, all component images are stored in IndexedDB alongside the project. In G3+, images uploaded for globally shared components are stored in the server file system (or S3 in G4) and are read-only for non-admin users.  
**FR-CL-12** When a component library is exported to JSON, images are embedded as Base64 data URIs so the export is fully self-contained. On import, images are extracted and stored in the file storage layer.  
**FR-CL-13** In G1, images are stored in IndexedDB as ArrayBuffers keyed by `component_id/image_id`. In G3 (local server), images are stored under `./data/uploads/images/<component_id>/`. In G4 (cloud), they are stored in S3 under the key prefix `components/<component_id>/images/`.  
**FR-CL-14** The server generates and caches thumbnail variants (256×256, 512×512) using Sharp on first access; thumbnails are invalidated when the source image is replaced.

#### 6.3.2 Component STEP File Attachments

**FR-CL-15** Each component can have exactly one STEP file attached (`.step` or `.stp`). Maximum file size: 200 MB.  
**FR-CL-16** In G1, STEP files are stored in IndexedDB as ArrayBuffers; the user is warned if the file exceeds 50 MB (IndexedDB quota concern). In G3 (local server): `./data/uploads/step/<component_id>/`. In G4 (cloud): S3 key `components/<component_id>/step/`.  
**FR-CL-17** The component editor shows STEP file metadata: filename, file size, upload date, and uploader.  
**FR-CL-18** A download button is provided. The file is served with the correct MIME type (`model/step`) and `Content-Disposition: attachment` so the browser offers a save-as dialog.  
**FR-CL-19** The application does not render STEP files in-browser in v1. A link to open the file in an external viewer is acceptable.  
**FR-CL-20** When a component library is exported to a `.chd` file, the STEP file is included as a binary entry in the zip archive under `step/<component_id>.step`.  
**FR-CL-21** Uploading a new STEP file replaces the previous one; the old file is deleted from storage within 24 hours (soft-delete with scheduled cleanup job).

### 6.4 Wire & Cable Dimensional Definitions

This section covers how lengths, strip dimensions, and related prep data are defined for every conductor in the harness. These values feed directly into cut sheets and manufacturing instructions.

#### 6.4.1 Distinction: Wire vs Cable

| Term | Definition |
|------|-----------|
| **Wire** | A single conductor (solid or stranded), with a single insulation jacket |
| **Cable** | A multi-conductor assembly (e.g., twisted pair, shielded pair, coax) treated as a single routed object, containing two or more inner wires |

Both share the same length model but cables have additional properties (shield, jacket, drain wire).

#### 6.4.2 Overall Length

**FR-WP-01** Every wire and cable has an **overall length** — the distance from the termination point at one end to the termination point at the other end, measured along the routed path.

**FR-WP-02** Length can be determined by one of three modes, selectable per wire:

| Mode | Description |
|------|-------------|
| `schematic` | Derived from the canvas geometry. The canvas has a user-defined **scale** (e.g., 1 px = 1 mm). The path length is computed from the wire's waypoints. |
| `override` | Engineer enters the exact length manually. Ignores canvas geometry. Takes precedence over schematic mode for that wire. |
| `formula` | A simple expression referencing schematic length plus a routing factor (e.g., `schematic * 1.15 + 50mm`). Useful for accounting for routing slack. |

**FR-WP-03** The canvas scale is set per-project (in mm/px or in/px) and applies to all wires using `schematic` mode. Scale can be changed at any time; affected lengths recalculate immediately.

**FR-WP-04** Lengths are stored internally in millimetres. The UI displays them in the unit system chosen by the user (mm, cm, inches) and converts on display only.

**FR-WP-05** A global **routing slack percentage** can be set per-project (default 0%). When non-zero, it is applied additively to all `schematic` and `formula` mode lengths. Individual wires can opt out.

#### 6.4.3 Segment Lengths

**FR-WP-06** A wire or cable can be divided into **named segments** to define sub-lengths along its routed path. Segments are useful for specifying bundle breakout points and conduit sections.

**FR-WP-07** Each segment has: a name, a length (mm), and an optional note (e.g., "inside conduit", "free air", "spiral wrap").

**FR-WP-08** The sum of all segment lengths must equal the overall length. The UI shows a live discrepancy indicator and flags mismatches as a DRC warning.

**FR-WP-09** Segments are ordered and can be reordered by drag. Their order determines display order in the cut sheet.

#### 6.4.4 Strip Definitions (Per End)

Each wire or inner conductor of a cable has **two ends** (End A and End B), each with its own strip definition.

**FR-WP-10** End A is conventionally the "from" connector end; End B is the "to" connector end. Labels can be overridden by the engineer.

**FR-WP-11** Each end has the following strip fields:

| Field | Unit | Description |
|-------|------|-------------|
| **Strip length** | mm | Length of insulation removed from the conductor tip |
| **Strip type** | enum | `full` (clean bare), `window` (mid-strip, insulation re-seated), `step` (multi-layer removal) |
| **Insulation OD** | mm | Outer diameter of the insulation at this end (auto-filled from component gauge data if available) |
| **Tinning required** | bool | Whether the stripped conductor must be tinned before termination |
| **Tinning length** | mm | Length to tin (if tinning required; ≤ strip length) |
| **Terminal type** | reference | Link to a terminal component from the library |
| **Terminal insertion depth** | mm | How far the conductor inserts into the terminal (overrides terminal default if set) |
| **Notes** | text | Free text for special handling instructions |

**FR-WP-12** Strip type `step` unlocks a sub-table for multi-layer strip dimensions (e.g., for coax: outer jacket strip, braid fold-back length, dielectric strip, inner conductor strip).

**FR-WP-13** Strip definitions are shown inline in the Properties Panel when a wire is selected, in a collapsible "End A / End B" accordion.

**FR-WP-14** Default strip values can be set per terminal type in the component library (e.g., "Deutsch DT socket requires 6 mm strip"). When a terminal is assigned to a wire end, its defaults are pre-populated. The engineer can override any field.

#### 6.4.5 Cable-Specific Dimensional Fields

**FR-WP-15** For cables (multi-conductor), the following additional fields apply at the cable level (not per inner conductor):

| Field | Unit | Description |
|-------|------|-------------|
| **Outer jacket strip — End A** | mm | Length of outer jacket removed at End A |
| **Outer jacket strip — End B** | mm | Length of outer jacket removed at End B |
| **Shield treatment — End A** | enum | `fold_back`, `cut_flush`, `pigtail`, `drain_wire_only`, `none` |
| **Shield treatment — End B** | enum | Same options |
| **Drain wire length — End A** | mm | Exposed length of drain wire at End A (if shield treatment = `drain_wire_only` or `pigtail`) |
| **Drain wire length — End B** | mm | Same for End B |
| **Pigtail length — End A** | mm | Length of shield pigtail braid tail at End A |
| **Pigtail length — End B** | mm | Same for End B |
| **Tape/heat-shrink start from End A** | mm | Where protective tape or heat-shrink begins, measured from End A tip |
| **Tape/heat-shrink length** | mm | Length of the tape or heat-shrink section |

**FR-WP-16** Inner conductors within a cable each have their own strip definitions (FR-WP-11) independent of the cable's jacket strip. The cut sheet renders them as a hierarchical table: cable → inner conductors.

#### 6.4.6 Length Validation (DRC Rules)

**FR-WP-17** The following DRC rules apply to length and strip data:

| Rule ID | Severity | Condition |
|---------|----------|-----------|
| LEN-01 | Warning | Overall length is 0 or unset |
| LEN-02 | Warning | Segment lengths do not sum to overall length (tolerance ±0.5 mm) |
| LEN-03 | Error | Strip length > overall length / 2 (physically impossible) |
| LEN-04 | Warning | Tinning length > strip length |
| LEN-05 | Warning | Terminal insertion depth > strip length |
| LEN-06 | Warning | Jacket strip length (cable) > overall length |
| LEN-07 | Info | Overall length differs from schematic-calculated length by > 20% (when mode = `override`) |

### 6.5 Wire & Cable General Properties

**FR-WG-01** Each wire has: wire ID (auto-generated, editable), gauge (AWG or mm²), color, signal name, and notes.  
**FR-WG-02** Wire color follows a user-selectable standard (ISO 6722, SAE J1128, or custom). Color is shown as a swatch on the canvas edge.  
**FR-WG-03** Wires can be grouped into bundles; bundle outer diameter is calculated automatically from constituent wire gauges and fill ratio.  
**FR-WG-04** Signal names can be auto-propagated to matching pins across the schematic.  
**FR-WG-05** Cables are defined in the component library and placed as a single routed entity on the canvas. Their inner conductors inherit the cable's routed path but have individual signal names, colors, and strip definitions. On the canvas the cable is rendered in a WYSIWYG style: the individual conductor edges are drawn as parallel coloured lines enclosed within a thicker cable-jacket outline, so the visual appearance reflects the actual bundled construction of the cable.
**FR-WG-06** The user can set the outer jacket strip-back length (mm) for End A and End B of a cable independently via the Properties Panel (stored in `CableEnd.outerJacketStripLengthMm`, FR-WP-15). This is distinct from inner-conductor insulation stripping. The stripped length is annotated on the canvas at each cable end.

### 6.6 Cable Split & Join Operations

Engineers frequently need to break a multi-conductor cable into individual wires at an intermediate point, or to combine separate wires into a new cable assembly. These operations are first-class canvas interactions, not just manual re-wiring.

#### 6.6.1 Concepts

| Term | Definition |
|------|-----------|
| **Split node** | A canvas node representing the physical breakout point where a cable's outer jacket ends and its inner conductors fan out as individual wires |
| **Join node** | A canvas node representing the physical point where individual wires are gathered and enter a new cable jacket |
| **Fan-out** | The set of individual wire segments emerging from a split node |
| **Fan-in** | The set of individual wire segments converging into a join node |

A split and a join node are both variants of the existing `splice` node type, extended with cable-specific metadata.

#### 6.6.2 Cable Split

**FR-CS-01** The user can right-click any cable segment on the canvas and select **Split cable here**. This inserts a split node at the click point along the cable's path.

**FR-CS-02** On split, the system automatically:
- Terminates the cable at the split node (cable End B is now the split node)
- Creates one individual wire segment per inner conductor, each originating at the split node
- Preserves each conductor's signal name, gauge, color, and End A strip definition from the cable
- Assigns End A of each new wire to the corresponding conductor position on the split node

**FR-CS-03** The split node records: the cable it originated from, the conductor-to-wire mapping, and the physical fan-out length (the distance from the jacket end to where conductors diverge, defaulting to 0 mm but editable).

**FR-CS-04** After splitting, the individual wire segments are independently routable on the canvas. Each can be connected to a different connector pin.

**FR-CS-05** A cable that has been split retains its jacket strip, shield, and dimensional properties up to the split node. The fan-out wires are governed by their own strip definitions.

**FR-CS-06** Multiple split nodes can exist on the same cable (e.g., a cable splitting at two different points along its run). Each split produces its own set of fan-out wires.

**FR-CS-07** The user can delete a split node. On deletion, the system prompts whether to: (a) re-merge the fan-out wires back into the cable (undoing the split), or (b) leave the fan-out wires as standalone wires disconnected from the cable.

#### 6.6.3 Cable Join

**FR-CJ-01** The user can select two or more wires or cable fan-outs on the canvas, then invoke **Join into cable** from the right-click context menu or the toolbar.

**FR-CJ-02** Joining opens a dialog where the user specifies:
- New cable reference ID
- Cable type (select from library, or create inline)
- Conductor order (drag to reorder the selected wires into pin positions)
- Fan-in length at each end (default 0 mm)

**FR-CJ-03** On confirm, the system:
- Creates a new cable node of type `join_node` at the convergence point inferred from the wire layout (midpoint of the selected wire endpoints, or user-placed)
- Assigns each selected wire as an inner conductor of the new cable, preserving signal names, gauges, and colors
- Sets the new cable's End A at the join node and routes the cable from there toward the common destination
- Marks the original individual wire segments as `inner_conductor` wires belonging to the new cable

**FR-CJ-04** Wires of mismatched gauges can be joined, but a DRC warning (`JOIN-01`) is raised: "Conductors in cable `<ref>` have mixed gauges."

**FR-CJ-05** A join node can be dissolved: the cable is removed and its inner conductors revert to standalone wires at their previous positions.

**FR-CJ-06** A split node and a join node can be chained: a cable splits into conductors, some conductors are re-joined into a new cable, and others continue as standalone wires. This models real harness topology (e.g., a branch harness).

#### 6.6.4 Split/Join DRC Rules

| Rule ID | Severity | Condition |
|---------|----------|-----------|
| JOIN-01 | Warning | Conductors joined into a cable have mixed gauges |
| JOIN-02 | Error | A join node has fewer than 2 incoming conductors |
| SPLIT-01 | Warning | Fan-out wire has no further connection (floating conductor after split) |
| SPLIT-02 | Info | Fan-out length is 0 mm (jacket ends exactly at split point — verify physical feasibility) |
| SPLIT-03 | Error | A split node references a conductor position that does not exist in the cable's component definition |

---

### 6.7 Protective Materials

Protective materials are coverings applied to wire segments, cables, or bundles to provide abrasion resistance, moisture protection, thermal protection, or bundling. They are distinct from the wires themselves and appear in the BOM as separate line items.

#### 6.7.1 Material Types

The system supports the following protective material categories, all manageable in the component library under `component_type = 'protective_material'`:

| Category | Examples | Key Properties |
|----------|---------|----------------|
| `felt_tape` | Felt adhesive tape, foam tape | Width (mm), thickness (mm), adhesive side (`inner`, `outer`, `both`, `none`) |
| `fabric_tape` | PVC harness tape, linen tape | Width (mm), overlap % for helical wrap, temperature rating (°C) |
| `heat_shrink` | Single-wall, dual-wall, adhesive-lined | Inner diameter before/after shrink (mm), shrink ratio, wall thickness, adhesive-lined flag |
| `corrugated_loom` | Split conduit, convoluted tubing | Inner diameter (mm), outer diameter (mm), split (bool), material (PA, PP, PVC) |
| `smooth_loom` | Braided sleeving, nylon sleeve | Inner diameter (mm), expandable (bool), material |
| `spiral_wrap` | PVC spiral wrap, nylon spiral | Inner diameter range (mm), pitch (mm), color |
| `conduit` | Rigid or semi-rigid conduit | Inner diameter (mm), outer diameter (mm), bend radius (mm), rigid (bool) |
| `rubber_grommet` | Firewall grommets, panel pass-through | Inner diameter (mm), panel thickness range (mm) |
| `cable_tie` | Nylon ties, stainless band ties | Max bundle diameter (mm), width (mm), material |
| `other` | Custom / user-defined | Free-form properties JSON |

#### 6.7.2 Applying Materials to the Harness

**FR-PM-01** Protective materials are applied to **coverage spans** — ranges defined as (target, start_offset_mm, end_offset_mm) where target is a wire, cable, bundle, or fan-out segment.

**FR-PM-02** A coverage span can reference an entire wire/cable ("full length"), a named segment, or an arbitrary offset range measured from End A.

**FR-PM-03** Multiple materials can be applied to the same span (e.g., felt tape wrapped first, then corrugated loom over the top). Each application has a `layer_order` to express nesting.

**FR-PM-04** Coverage spans are visualized on the canvas as colored overlay bands on the wire/cable edge, with a legend showing material type. Overlapping materials are shown as stacked bands.

**FR-PM-05** The user can add a coverage span by:
- Selecting a wire or cable, then clicking **Add protection** in the Properties Panel
- Right-clicking a wire/cable segment on the canvas and selecting **Add protection here** (pre-fills the offset to the click point)

**FR-PM-06** The coverage span editor fields:
| Field | Description |
|-------|-------------|
| Material | Select from library (type-ahead search) |
| Start offset from End A | mm; 0 = from the very beginning |
| End offset from End A | mm; blank = to the very end |
| Named segment (alternative) | Pick a segment name instead of manual offsets |
| Layer order | Integer; lower = innermost layer |
| Quantity / wrap coverage | For tapes: overlap %; for ties: spacing (mm) between ties; for grommets: count |
| Notes | Free text |

**FR-PM-07** For tape-type materials, the system calculates the total tape length required based on the covered span length, the tape width, and the specified overlap percentage. This calculated quantity feeds the BOM.

**FR-PM-08** For loom and conduit materials, the system checks that the inner diameter of the material is ≥ the calculated bundle outer diameter of the covered conductors. A DRC warning is raised if the material is undersized.

**FR-PM-09** For heat-shrink, the system checks that the pre-shrink inner diameter is ≥ the outer diameter of the covered conductor or cable. Post-shrink diameter is displayed informatively.

**FR-PM-10** Protective materials defined in the global component library ship with standard catalog entries (e.g., common Hellermann Tyton, TE, Raychem part numbers). Users can add custom entries.

**FR-PM-11** Protective material components support the same image and STEP file attachments as other components (§6.3.1, §6.3.2).

#### 6.7.3 Protective Material DRC Rules

| Rule ID | Severity | Condition |
|---------|----------|-----------|
| PROT-01 | Warning | Loom/conduit inner diameter < bundle outer diameter at any covered cross-section |
| PROT-02 | Warning | Heat-shrink pre-shrink inner diameter < conductor/cable outer diameter |
| PROT-03 | Info | Coverage span extends beyond the wire/cable's defined length |
| PROT-04 | Warning | Overlapping coverage spans of the same material type and layer order (likely duplicate application) |
| PROT-05 | Warning | Cable tie spacing > 300 mm on unsupported span (configurable threshold) |

#### 6.7.4 Protective Materials in Documents

**FR-PM-12 BOM:** Protective materials appear as their own BOM section. Tape and wrap quantities are expressed in metres (calculated). Looms and conduits are in metres. Grommets and ties are in units.

**FR-PM-13 Cut Sheet:** Each wire/cable cut sheet includes a "Protection" table listing all coverage spans in order from End A, with: material part number, start–end offsets, layer, and calculated quantity.

**FR-PM-14 Assembly Drawing (new document type):** A schematic-level view that shows the harness with all protective material coverage bands rendered as colored overlays, with a material legend and callout labels. Exported as PDF. This is the primary visual reference for the assembly technician.

---

### 6.8 Document Generation

**FR-DG-01 Wire List:** Tabular export of all wires with columns: Wire ID, From Connector, From Pin, To Connector, To Pin, Gauge, Color, Overall Length, Signal Name.  
**FR-DG-02 Bill of Materials (BOM):** Aggregated list of all connectors, terminals, seals, wire by part number with quantities, plus a dedicated Protective Materials section (§6.7.4).  
**FR-DG-03 Cut Sheet:** Per-wire manufacturing instruction sheet. For each wire or cable, includes:
  - Wire ID, signal name, gauge, color
  - Overall length
  - Segment lengths table (if segments defined)
  - End A: connector, pin, strip length, strip type, tinning, terminal, insertion depth, notes
  - End B: same fields
  - For cables: jacket strip lengths, shield treatment, drain/pigtail lengths at each end
  - For cables: inner conductor sub-table with per-conductor strip definitions
  - Protection table: all coverage spans in offset order with material, extents, layer, and calculated quantity

**FR-DG-04 Connector Face Diagram:** Auto-rendered pin-face view for each connector showing pin assignments. If a primary image exists for the connector, it is inset beside the diagram.  
**FR-DG-05 Assembly Drawing:** Schematic-level PDF showing the full harness with protective material coverage bands rendered as colored overlays, material legend, split/join node callouts, and fan-out length annotations. Intended as the primary visual reference for assembly technicians.  
**FR-DG-06** All documents export to PDF and CSV. Wire List additionally exports to XLSX.  
**FR-DG-07** Document templates are customizable: company logo, header/footer fields, color scheme.  
**FR-DG-08** Generation is triggered on demand; the system highlights any validation errors before generating (e.g., unconnected required pins, duplicate wire IDs, length DRC failures, protective material sizing failures).

### 6.9 Validation & Design Rule Checks (DRC)

**FR-DV-01** DRC runs automatically on save and on demand via a toolbar button.  
**FR-DV-02** Schematic rules checked:
- Unconnected pins marked as required
- Duplicate wire IDs in the same project
- Wire gauge mismatch between connected pins
- Circular routes (wire connects a pin to itself)
- Missing signal names on wires flagged as "named required"

**FR-DV-03** Length and strip rules checked (see §6.4.6): zero lengths, segment sum mismatch, strip longer than wire, tinning/insertion depth violations.  
**FR-DV-04** Cable split/join rules checked (see §6.6.4): floating fan-out conductors, undersized join nodes, invalid conductor position references.  
**FR-DV-05** Protective material rules checked (see §6.7.3): undersized loom/conduit, undersized heat-shrink, duplicate overlapping applications, overhang beyond wire length.  
**FR-DV-06** DRC results appear in a panel with clickable errors that zoom to the offending element. Results are grouped by rule category (Schematic, Lengths, Split/Join, Protection).  
**FR-DV-07** Errors are blocking for export; warnings and info messages are non-blocking.

### 6.10 Search & Navigation

**FR-SN-01** Global search bar finds connectors, wires, cables, signals, and protective material spans by name or ID, and navigates the canvas to the result.  
**FR-SN-02** The wire list panel is live-filtered by any column value.

### 6.11 Authentication & Access (G4 — Cloud only)

There is no authentication in G1 or G3. The following requirements apply only once the cloud backend (G4) is introduced.

**FR-AU-01** User registration and login via email + password (bcrypt hashed).  
**FR-AU-02** JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry, stored in httpOnly cookie).  
**FR-AU-03** Project-level roles: Owner, Editor, Viewer.  
**FR-AU-04** API tokens can be generated per-user for programmatic access.

---

## 7. Non-Functional Requirements

### 7.1 Performance

**NFR-P-01** The canvas must render 500+ nodes and 1000+ wires at ≥ 60 fps on a modern laptop.  
**NFR-P-02** Database writes must complete within 50 ms for single-record operations.  
**NFR-P-03** PDF generation for a 500-wire harness must complete within 10 seconds.

### 7.2 Reliability

**NFR-R-01** Auto-save must not block the UI thread; it runs in a background worker.  
**NFR-R-02** If the server is unreachable in cloud mode, the client queues mutations and syncs on reconnection.  
**NFR-R-03** The application must handle a corrupted SQLite file gracefully, offering recovery from the last valid snapshot.

### 7.3 Security

**NFR-S-01** No secrets are stored in the frontend bundle.  
**NFR-S-02** All cloud API endpoints are authenticated except the health check.  
**NFR-S-03** SQL queries use parameterized statements throughout (no string interpolation).  
**NFR-S-04** Uploaded files are validated before storage:
  - Images: MIME type verified by reading magic bytes (not just extension); malformed images rejected.
  - STEP files: Extension and MIME type checked (`model/step`); file content scanned for the ISO 10303 header string before acceptance.
  - File size limits enforced at the HTTP layer (Fastify multipart limits), not just application logic.  

**NFR-S-05** Image files are stored outside the web root and served only through authenticated API endpoints; direct filesystem URLs are never exposed to clients.  
**NFR-S-06** Sharp image processing runs in a sandboxed worker; malformed images cannot crash the main server process.

### 7.4 Maintainability

**NFR-M-01** The codebase is a TypeScript monorepo (packages: `client`, `server`, `shared`).  
**NFR-M-02** The shared package contains all Zod schemas, types, and utility functions used by both client and server.  
**NFR-M-03** Database migrations are managed by a migration runner (e.g., `db-migrate` or custom) and are committed alongside code.  
**NFR-M-04** All API contracts are defined via Zod schemas in the shared package and auto-validated at runtime.

### 7.5 Accessibility

**NFR-A-01** All interactive elements are keyboard navigable.  
**NFR-A-02** The application meets WCAG 2.1 AA contrast requirements.  
**NFR-A-03** Canvas elements expose ARIA labels for screen reader compatibility where practical.

---

## 8. Data Model

### 8.1 SQLite Schema

```sql
-- Users (cloud mode only; single implicit user in local mode)
CREATE TABLE users (
  id            TEXT PRIMARY KEY,         -- UUID
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Projects
CREATE TABLE projects (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  owner_id          TEXT REFERENCES users(id),
  schematic_version INTEGER NOT NULL DEFAULT 1,
  unit_system       TEXT NOT NULL DEFAULT 'mm' CHECK(unit_system IN ('mm','in')),
  canvas_scale_mm_per_px REAL NOT NULL DEFAULT 1.0,
  routing_slack_pct REAL NOT NULL DEFAULT 0.0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- Project snapshots (history)
CREATE TABLE project_snapshots (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot    TEXT NOT NULL,            -- JSON blob of full schematic
  created_at  INTEGER NOT NULL
);

-- Component library items
CREATE TABLE components (
  id              TEXT PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE, -- NULL = global library
  part_number     TEXT NOT NULL,
  manufacturer    TEXT,
  component_type  TEXT NOT NULL CHECK(component_type IN ('connector','wire_gauge','cable','terminal','seal','splice')),
  pin_count       INTEGER,
  gender          TEXT CHECK(gender IN ('male','female','neutral',NULL)),
  properties      TEXT NOT NULL DEFAULT '{}', -- JSON (flexible per type)
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- Connector pins definition
CREATE TABLE component_pins (
  id           TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  pin_number   TEXT NOT NULL,
  label        TEXT,
  pin_type     TEXT CHECK(pin_type IN ('signal','power','ground','no_connect')),
  required     INTEGER NOT NULL DEFAULT 0
);

-- Component image attachments
CREATE TABLE component_images (
  id             TEXT PRIMARY KEY,
  component_id   TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  storage_key    TEXT NOT NULL,          -- relative path (local) or S3 key (cloud)
  mime_type      TEXT NOT NULL,          -- image/jpeg | image/png | image/webp | image/svg+xml
  file_size_bytes INTEGER NOT NULL,
  width_px       INTEGER,
  height_px      INTEGER,
  view_category  TEXT NOT NULL DEFAULT 'other'
                 CHECK(view_category IN ('front','rear','side','assembled','installed','datasheet_scan','other')),
  is_primary     INTEGER NOT NULL DEFAULT 0, -- boolean; enforced unique per component via trigger
  sort_order     INTEGER NOT NULL DEFAULT 0,
  uploaded_by    TEXT REFERENCES users(id),
  created_at     INTEGER NOT NULL
);

-- Thumbnail cache for component images
CREATE TABLE component_image_thumbnails (
  id             TEXT PRIMARY KEY,
  image_id       TEXT NOT NULL REFERENCES component_images(id) ON DELETE CASCADE,
  size           TEXT NOT NULL CHECK(size IN ('256','512')), -- px square
  storage_key    TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE(image_id, size)
);

-- Component STEP file attachments
CREATE TABLE component_step_files (
  id              TEXT PRIMARY KEY,
  component_id    TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE UNIQUE,
  filename        TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  uploaded_by     TEXT REFERENCES users(id),
  created_at      INTEGER NOT NULL,
  deleted_at      INTEGER             -- soft-delete; hard-deleted by cleanup job after 24h
);

-- Schematic nodes (placed connectors, splices, labels)
CREATE TABLE nodes (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_type    TEXT NOT NULL CHECK(node_type IN ('connector','splice','label')),
  component_id TEXT REFERENCES components(id),
  label        TEXT,
  position_x   REAL NOT NULL,
  position_y   REAL NOT NULL,
  rotation     REAL NOT NULL DEFAULT 0,
  properties   TEXT NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Wires (single conductor)
CREATE TABLE wires (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wire_ref        TEXT NOT NULL,           -- user-visible ID, unique per project
  from_node_id    TEXT NOT NULL REFERENCES nodes(id),
  from_pin        TEXT NOT NULL,
  to_node_id      TEXT NOT NULL REFERENCES nodes(id),
  to_pin          TEXT NOT NULL,
  gauge_awg       REAL,
  gauge_mm2       REAL,
  color           TEXT,
  signal_name     TEXT,
  -- Length
  length_mode     TEXT NOT NULL DEFAULT 'schematic'
                  CHECK(length_mode IN ('schematic','override','formula')),
  length_mm       REAL,                    -- override or formula result; NULL = use schematic
  length_formula  TEXT,                    -- e.g. "schematic * 1.15 + 50"
  apply_slack     INTEGER NOT NULL DEFAULT 1, -- whether project routing_slack_pct applies
  -- Cable parent (NULL for standalone wires)
  cable_id        TEXT REFERENCES cables(id),
  bundle_id       TEXT REFERENCES bundles(id),
  notes           TEXT,
  waypoints       TEXT NOT NULL DEFAULT '[]',  -- JSON [{x,y}]
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE(project_id, wire_ref)
);

-- Wire end strip definitions (one row per end per wire)
CREATE TABLE wire_end_strips (
  id                    TEXT PRIMARY KEY,
  wire_id               TEXT NOT NULL REFERENCES wires(id) ON DELETE CASCADE,
  end_side              TEXT NOT NULL CHECK(end_side IN ('A','B')),
  end_label             TEXT,              -- overrides default "End A" / "End B" label
  strip_length_mm       REAL,
  strip_type            TEXT NOT NULL DEFAULT 'full'
                        CHECK(strip_type IN ('full','window','step')),
  insulation_od_mm      REAL,
  tinning_required      INTEGER NOT NULL DEFAULT 0,
  tinning_length_mm     REAL,
  terminal_component_id TEXT REFERENCES components(id),
  terminal_insertion_depth_mm REAL,
  notes                 TEXT,
  UNIQUE(wire_id, end_side)
);

-- Step-strip layers (for strip_type = 'step', e.g. coax inner/outer)
CREATE TABLE wire_strip_layers (
  id              TEXT PRIMARY KEY,
  end_strip_id    TEXT NOT NULL REFERENCES wire_end_strips(id) ON DELETE CASCADE,
  layer_order     INTEGER NOT NULL,
  layer_name      TEXT NOT NULL,           -- e.g. "Outer jacket", "Braid", "Dielectric"
  strip_length_mm REAL NOT NULL,
  notes           TEXT
);

-- Wire segments (sub-lengths along the routed path)
CREATE TABLE wire_segments (
  id           TEXT PRIMARY KEY,
  wire_id      TEXT NOT NULL REFERENCES wires(id) ON DELETE CASCADE,
  segment_order INTEGER NOT NULL,
  name         TEXT NOT NULL,
  length_mm    REAL NOT NULL,
  notes        TEXT
);

-- Cables (multi-conductor assemblies)
CREATE TABLE cables (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cable_ref           TEXT NOT NULL,
  component_id        TEXT REFERENCES components(id),  -- cable type from library
  -- Jacket strip
  jacket_strip_a_mm   REAL,
  jacket_strip_b_mm   REAL,
  -- Shield
  shield_treatment_a  TEXT CHECK(shield_treatment_a IN ('fold_back','cut_flush','pigtail','drain_wire_only','none',NULL)),
  shield_treatment_b  TEXT CHECK(shield_treatment_b IN ('fold_back','cut_flush','pigtail','drain_wire_only','none',NULL)),
  drain_length_a_mm   REAL,
  drain_length_b_mm   REAL,
  pigtail_length_a_mm REAL,
  pigtail_length_b_mm REAL,
  -- Protective sleeve (cable-level only; finer spans use coverage_spans table)
  sleeve_start_from_a_mm REAL,
  sleeve_length_mm    REAL,
  notes               TEXT,
  waypoints           TEXT NOT NULL DEFAULT '[]',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  UNIQUE(project_id, cable_ref)
);

-- Split / Join nodes
-- A split_join_node is placed on the canvas and records whether it is a split (cable→wires)
-- or a join (wires→cable) operation, plus the mapping of conductors.
CREATE TABLE split_join_nodes (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_type       TEXT NOT NULL CHECK(node_type IN ('split','join')),
  position_x      REAL NOT NULL,
  position_y      REAL NOT NULL,
  -- For split: the upstream cable that terminates here
  cable_id        TEXT REFERENCES cables(id),
  -- For join: the downstream cable that originates here
  output_cable_id TEXT REFERENCES cables(id),
  -- Physical distance from jacket end to where conductors fully diverge/converge
  fanout_length_mm REAL NOT NULL DEFAULT 0,
  label           TEXT,
  notes           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- Conductor mapping within a split or join node
-- Maps each inner conductor (wire) to its position in the cable
CREATE TABLE split_join_conductors (
  id                  TEXT PRIMARY KEY,
  split_join_node_id  TEXT NOT NULL REFERENCES split_join_nodes(id) ON DELETE CASCADE,
  wire_id             TEXT NOT NULL REFERENCES wires(id),
  conductor_position  INTEGER NOT NULL,  -- pin/conductor index in the cable definition
  created_at          INTEGER NOT NULL
);

-- Protective material component library entries
-- Stored as components with component_type = 'protective_material'
-- The 'properties' JSON column on components holds category-specific fields.
-- This table stores the normalized category for efficient querying.
CREATE TABLE protective_material_props (
  component_id  TEXT PRIMARY KEY REFERENCES components(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK(category IN (
                  'felt_tape','fabric_tape','heat_shrink',
                  'corrugated_loom','smooth_loom','spiral_wrap',
                  'conduit','rubber_grommet','cable_tie','other')),
  -- Common dimensional fields (nullable; category-specific fields in components.properties JSON)
  inner_diameter_mm   REAL,
  outer_diameter_mm   REAL,
  width_mm            REAL,
  thickness_mm        REAL,
  temperature_rating_c REAL,
  color               TEXT,
  material_compound   TEXT        -- e.g. "PA6", "PVC", "EPDM"
);

-- Coverage spans: protective material applied to a wire, cable, bundle, or fan-out range
CREATE TABLE coverage_spans (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Target (exactly one of these is non-NULL)
  wire_id               TEXT REFERENCES wires(id),
  cable_id              TEXT REFERENCES cables(id),
  bundle_id             TEXT REFERENCES bundles(id),
  split_join_node_id    TEXT REFERENCES split_join_nodes(id), -- for fan-out spans
  -- Material
  component_id          TEXT NOT NULL REFERENCES components(id),
  -- Extent (from End A); NULL end_offset means "to the very end"
  start_offset_mm       REAL NOT NULL DEFAULT 0,
  end_offset_mm         REAL,
  -- Alternative: reference a named wire segment instead of raw offsets
  wire_segment_id       TEXT REFERENCES wire_segments(id),
  -- Layering (1 = innermost)
  layer_order           INTEGER NOT NULL DEFAULT 1,
  -- Quantity modifiers (computed values stored for BOM; recalculated on save)
  overlap_pct           REAL,           -- for tapes: helical overlap percentage (0–100)
  tie_spacing_mm        REAL,           -- for cable ties: spacing between ties
  calculated_qty_m      REAL,           -- metres of tape/loom/conduit required
  calculated_qty_units  INTEGER,        -- count of discrete items (ties, grommets)
  notes                 TEXT,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  -- Enforce single target
  CHECK (
    (wire_id IS NOT NULL)::INTEGER +
    (cable_id IS NOT NULL)::INTEGER +
    (bundle_id IS NOT NULL)::INTEGER +
    (split_join_node_id IS NOT NULL)::INTEGER = 1
  )
);

-- Bundles
CREATE TABLE bundles (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  notes      TEXT
);

-- Project membership (cloud mode)
CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
  PRIMARY KEY (project_id, user_id)
);

-- API tokens (cloud mode)
CREATE TABLE api_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  last_used   INTEGER,
  created_at  INTEGER NOT NULL
);
```

### 8.2 Key Relationships

```
projects ──< nodes ──< wires ──< wire_end_strips ──< wire_strip_layers
                             ──< wire_segments
         ──< cables ──< wires (inner conductors via cable_id)
         ──< split_join_nodes ──< split_join_conductors → wires
                               (cable_id → cables, output_cable_id → cables)
         ──< coverage_spans → components (protective_material_props)
                 (targets: wire | cable | bundle | split_join_node)
         ──< bundles ──< wires (via bundle_id)
                     ──< coverage_spans
         ──< components (project-scoped library)
<NULL project_id> components (global library)
components ──< component_pins
           ──< component_images ──< component_image_thumbnails
           ── component_step_files (0..1)
           ── protective_material_props (0..1, when type = protective_material)
```

### 8.3 File Storage Layout

```
Local:                              Cloud (S3):
./data/uploads/
  images/
    <component_id>/
      <image_id>.<ext>              components/<component_id>/images/<image_id>.<ext>
      thumbs/
        <image_id>_256.jpg          components/<component_id>/thumbs/<image_id>_256.jpg
        <image_id>_512.jpg          components/<component_id>/thumbs/<image_id>_512.jpg
  step/
    <component_id>/
      <step_file_id>.step           components/<component_id>/step/<step_file_id>.step
  exports/
    <project_id>/
      <document_id>.pdf             projects/<project_id>/exports/<document_id>.pdf
```

---

## 9. API Design

### 9.1 Base URL

- Local: `http://localhost:3001/api/v1`
- Cloud: `https://<host>/api/v1`

### 9.2 Authentication Header (cloud)

```
Authorization: Bearer <jwt_access_token>
```

### 9.3 Endpoints

#### Projects
```
GET    /projects                  List all projects for the user
POST   /projects                  Create project
GET    /projects/:id              Get project + full schematic
PUT    /projects/:id              Update project metadata
DELETE /projects/:id              Delete project
POST   /projects/:id/export       Export .chd file
POST   /projects/import           Import .chd file
GET    /projects/:id/snapshots    List snapshots
POST   /projects/:id/snapshots/:snapshotId/restore  Restore snapshot
```

#### Nodes
```
GET    /projects/:id/nodes        List all nodes
POST   /projects/:id/nodes        Create node
PUT    /projects/:id/nodes/:nodeId  Update node
DELETE /projects/:id/nodes/:nodeId  Delete node
```

#### Wires
```
GET    /projects/:id/wires        List all wires (filterable)
POST   /projects/:id/wires        Create wire
PUT    /projects/:id/wires/:wireId  Update wire
DELETE /projects/:id/wires/:wireId  Delete wire
```

#### Components (Library)
```
GET    /components                List global library
GET    /projects/:id/components          List project library
POST   /components                       Create global component
POST   /projects/:id/components          Create project component
PUT    /components/:compId               Update component
DELETE /components/:compId               Delete component
POST   /components/import                Import library JSON (may include embedded images)
GET    /components/export                Export library JSON (with embedded image option)

# Image attachments
GET    /components/:compId/images                       List images (metadata)
POST   /components/:compId/images                       Upload image (multipart/form-data, max 20 MB)
PUT    /components/:compId/images/:imageId              Update metadata (category, label, sort_order)
PATCH  /components/:compId/images/:imageId/primary      Set as primary image
DELETE /components/:compId/images/:imageId              Delete image
GET    /components/:compId/images/:imageId/file         Download original file
GET    /components/:compId/images/:imageId/thumb        Thumbnail (?size=256|512)

# STEP file
GET    /components/:compId/step                         Get STEP metadata (filename, size, date)
POST   /components/:compId/step                         Upload STEP file (multipart/form-data, max 200 MB)
DELETE /components/:compId/step                         Soft-delete STEP file
GET    /components/:compId/step/file                    Download STEP file
```

#### Wires & Strip Data
```
GET    /projects/:id/wires                              List all wires
POST   /projects/:id/wires                              Create wire
PUT    /projects/:id/wires/:wireId                      Update wire (length, mode, formula, etc.)
DELETE /projects/:id/wires/:wireId                      Delete wire

GET    /projects/:id/wires/:wireId/ends                 Get both end strip definitions
PUT    /projects/:id/wires/:wireId/ends/A               Update End A strip definition
PUT    /projects/:id/wires/:wireId/ends/B               Update End B strip definition
GET    /projects/:id/wires/:wireId/ends/A/layers        List step-strip layers (End A)
PUT    /projects/:id/wires/:wireId/ends/A/layers        Replace all layers (End A)
GET    /projects/:id/wires/:wireId/ends/B/layers        List step-strip layers (End B)
PUT    /projects/:id/wires/:wireId/ends/B/layers        Replace all layers (End B)

GET    /projects/:id/wires/:wireId/segments             List segments
PUT    /projects/:id/wires/:wireId/segments             Replace all segments (ordered array)
```

#### Cables
```
GET    /projects/:id/cables                             List all cables
POST   /projects/:id/cables                             Create cable
PUT    /projects/:id/cables/:cableId                    Update cable (jacket strip, shield treatment, etc.)
DELETE /projects/:id/cables/:cableId                    Delete cable
GET    /projects/:id/cables/:cableId/wires              List inner conductors of a cable

# Split operations
POST   /projects/:id/cables/:cableId/split              Split cable at a point; body: {offset_mm, position_x, position_y}
                                                        Returns: split_join_node + created fan-out wires
# Join operations
POST   /projects/:id/cables/join                        Join wires into a new cable; body: {wire_ids[], cable_ref, component_id, position_x, position_y}
                                                        Returns: split_join_node + new cable
```

#### Split/Join Nodes
```
GET    /projects/:id/split-join-nodes                   List all split/join nodes
GET    /projects/:id/split-join-nodes/:nodeId           Get node with conductor mapping
PUT    /projects/:id/split-join-nodes/:nodeId           Update (fanout_length, label, notes)
DELETE /projects/:id/split-join-nodes/:nodeId           Delete; body: {strategy: 'remerge'|'disconnect'}
PUT    /projects/:id/split-join-nodes/:nodeId/conductors Reorder conductor-to-wire mapping
```

#### Protective Materials
```
# Library
GET    /components?type=protective_material             List all protective material library entries
POST   /components                                      Create protective material (component_type = 'protective_material')
PUT    /components/:compId                              Update material properties
DELETE /components/:compId                              Delete material

# Coverage spans on a project
GET    /projects/:id/coverage-spans                     List all coverage spans (filterable by wire_id, cable_id, bundle_id)
POST   /projects/:id/coverage-spans                     Create coverage span
PUT    /projects/:id/coverage-spans/:spanId             Update span (offsets, overlap, layer)
DELETE /projects/:id/coverage-spans/:spanId             Delete span

# Convenience: spans on a specific target
GET    /projects/:id/wires/:wireId/coverage-spans       List spans on a wire
GET    /projects/:id/cables/:cableId/coverage-spans     List spans on a cable
GET    /projects/:id/bundles/:bundleId/coverage-spans   List spans on a bundle
```

#### Documents
```
POST   /projects/:id/documents/wire-list        Generate wire list (PDF/CSV/XLSX)
POST   /projects/:id/documents/bom              Generate BOM (PDF/CSV)
POST   /projects/:id/documents/cut-sheet        Generate cut sheet (PDF)
POST   /projects/:id/documents/assembly-drawing Generate assembly drawing with protection overlays (PDF)
POST   /projects/:id/validate                   Run DRC, return errors/warnings grouped by category
```

#### Auth (cloud only)
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/tokens               List API tokens
POST   /auth/tokens               Create API token
DELETE /auth/tokens/:tokenId      Revoke API token
```

#### System
```
GET    /health                    Health check (unauthenticated)
GET    /version                   App + schema version
```

### 9.4 WebSocket (cloud, real-time collaboration)

```
WS /ws/projects/:id
```

Events emitted by server:
- `node:created`, `node:updated`, `node:deleted`
- `wire:created`, `wire:updated`, `wire:deleted`
- `user:joined`, `user:left`
- `drc:results`

Clients send mutations via REST; WebSocket is receive-only for collaboration updates.

---

## 10. UI/UX Requirements

### 10.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: File | Edit | View | DRC | Generate | Help    │
├──────────┬──────────────────────────────┬───────────────┤
│ Library  │                              │  Properties   │
│ Panel    │       Canvas (React Flow)    │  Panel        │
│          │                              │               │
│ Search   │  [connectors, wires,         │  Wire/Node/   │
│ ──────── │   cables, split/join nodes,  │  Material     │
│ Connec-  │   protection bands]          │  details      │
│ tors     │                              │               │
│ Cables   │                              │               │
│ Materials│                              │               │
│ Splices  │                              │               │
├──────────┴──────────────────────────────┴───────────────┤
│  Wire List / BOM / Protection / DRC (tabbed bottom)     │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Canvas Interactions

| Action | Interaction |
|--------|-------------|
| Place connector | Drag from library to canvas |
| Draw wire | Click pin handle → drag to target pin |
| Add waypoint | Click wire segment → drag |
| Select | Click node or wire |
| Multi-select | Shift+click or rubber-band drag |
| Pan | Middle-click drag or Space+drag |
| Zoom | Scroll wheel or Ctrl+/- |
| Delete | Delete or Backspace key |
| Undo/Redo | Ctrl+Z / Ctrl+Shift+Z |
| **Split cable** | Right-click cable segment → **Split cable here** |
| **Join wires** | Select 2+ wires → right-click → **Join into cable** |
| **Dissolve split/join** | Right-click split/join node → **Dissolve** |
| **Add protection** | Right-click wire/cable/bundle → **Add protection here** |
| **View protection** | Hover protection band → tooltip with material name, span, layer |

#### Canvas Visual Conventions

- **Split node** rendered as a filled diamond (◆) on the cable, coloured by cable jacket colour
- **Join node** rendered as an open diamond (◇) at the convergence point
- **Fan-out region** shown as a tapered graphic between split/join node and the diverging wires, annotated with fan-out length
- **Protection bands** shown as coloured stripes alongside the wire/cable edge; each material category has a distinct hue (configurable in project settings); overlapping layers shown as stacked stripes
- **Protection legend** shown in a collapsible overlay in the canvas corner when any protection is present

### 10.3 Component Library Panel

- Tree view: Connectors → Cables → Terminals & Seals → **Protective Materials** → Splices → recent
- Protective Materials sub-tree grouped by category (Tapes, Looms, Heat-Shrink, Conduit, …)
- Search box with instant filter across all categories
- Drag-and-drop connectors and cables to canvas; drag protective materials onto a wire/cable to open the coverage span dialog pre-filled with the target
- Right-click → Edit / Duplicate / Delete

### 10.4 Properties Panel

Contextual based on selection:

- **No selection:** Project info, unit system, canvas scale, routing slack %
- **Connector node:** Part number, label, pin assignments table, primary image thumbnail (click to open gallery)
- **Wire:** Wire ID, gauge, color picker, signal name, length mode selector, length/formula field, slack opt-out, bundle assignment, notes; collapsible **End A / End B** accordion (strip length, strip type, tinning, terminal, insertion depth, step-strip layers); collapsible **Protection** list showing all coverage spans on this wire with quick-edit and delete
- **Cable:** Cable ref, component type, jacket strip lengths, shield treatment dropdowns (End A/B), drain/pigtail lengths, sleeve fields, notes; collapsible **Inner Conductors** list; collapsible **Protection** list
- **Split node:** Upstream cable, fan-out length, conductor mapping table (drag to reorder), label, notes; button: **Dissolve split**
- **Join node:** Output cable, fan-out length, conductor mapping table, label, notes; button: **Dissolve join**
- **Coverage span (click protection band):** Material (type-ahead), start/end offsets or segment picker, layer order, overlap %, tie spacing, calculated quantity readout, notes; button: **Delete span**
- **Splice:** Label, connected wires list
- **Bundle:** Name, color, wire membership list, outer diameter readout; collapsible **Protection** list

#### Component Editor (Library Panel → Edit)

When editing a component from the library, a dedicated editor dialog opens with the following tabs:

- **General:** Part number, manufacturer, type, gender, description, properties JSON
- **Pins:** Pin table — only shown for connector and cable types (add/remove/reorder rows; pin number, label, type, required flag)
- **Material Props:** Shown for `protective_material` type — category selector, then category-specific dimension fields (inner/outer diameter, width, thickness, temperature rating, material compound, color)
- **Images:** Gallery grid of uploaded images. Each thumbnail shows view category badge. Controls: Upload (drag-and-drop or file picker, multi-select), set primary, rename, change category, delete. Supported formats: JPEG, PNG, WebP, SVG. Max 20 MB per file.
- **STEP File:** Shows current STEP metadata (filename, size, uploaded date). Buttons: Upload new file (replaces existing after confirmation), Download, Delete. If no file is attached, shows an upload dropzone.
- **Defaults:** Default strip length, tinning requirements, insertion depth (connector/terminal types); default overlap % or tie spacing (protective material types).

### 10.5 Bottom Panel Tabs

- **Wire List:** Sortable, filterable table; inline edit of signal name, length override, and notes; length column shows mode indicator (S = schematic, O = override, F = formula)
- **BOM:** Grouped by component type with quantities; image thumbnails in connector rows; dedicated Protective Materials section with calculated quantities
- **Protection:** Table of all coverage spans in the project — target, material, offsets, layer, quantity; click row to navigate canvas to the span
- **DRC:** Error/warning/info list with severity icons; grouped by category (Schematic, Lengths/Strips, Split/Join, Protection); click to navigate canvas

---

## 11. Technology Stack

### 11.1 Monorepo Structure

```
/
├── packages/
│   ├── client/               # React SPA (Vite + TypeScript) — delivered in G1
│   │   ├── src/
│   │   │   ├── storage/
│   │   │   │   ├── StorageAdapter.ts      # interface — identical API for all backends
│   │   │   │   ├── IndexedDBAdapter.ts    # G1: browser-only, no server
│   │   │   │   └── ApiAdapter.ts          # G3+: delegates to REST API
│   │   │   ├── canvas/       # React Flow schematic editor
│   │   │   ├── panels/       # Wire list, BOM, DRC, Protection panels
│   │   │   └── documents/    # Client-side PDF/XLSX generation (G1)
│   ├── server/               # Fastify API (Node.js + TypeScript) — added in G3
│   └── shared/               # Zod schemas, types, utilities — used by both
├── migrations/               # SQL migration files (G3+)
├── docker-compose.yml        # Cloud deployment (G4)
├── package.json              # Workspace root (pnpm workspaces)
└── turbo.json                # Turborepo build orchestration
```

### 11.2 Client Package

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | React 18 + TypeScript | Industry standard, large ecosystem |
| Build tool | Vite | Fast HMR, native ESM; static build for G1 requires no server |
| Canvas/graph | React Flow (xyflow) | Purpose-built node/edge canvas with extensibility |
| State management | Zustand | Lightweight, no boilerplate, works with React Flow |
| Server state | TanStack Query | Caching, optimistic updates; in G1 wraps IndexedDB adapter transparently |
| **Browser storage (G1)** | **idb** (IndexedDB wrapper) | Typed, promise-based IndexedDB — stores projects, libraries, images, STEP files |
| **Document gen in browser (G1)** | **PDFKit** (browser build) + **ExcelJS** | Both run in-browser via bundler; output via `FileSaver.js` |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent UI without custom CSS overhead |
| Image gallery | yet-another-react-lightbox | Accessible lightbox with zoom |
| File upload UI | react-dropzone | Drag-and-drop upload zones for images and STEP files |
| PDF preview | react-pdf | In-browser PDF rendering for generated docs |
| WebSocket | native WebSocket + custom hook | G3+ only; unused in G1 |

### 11.3 Server Package

*The server package is introduced in G3. Nothing below is required to ship G1.*

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | Node.js 20 LTS | LTS stability |
| Framework | Fastify | High throughput, TypeScript-first, schema validation |
| Multipart uploads | @fastify/multipart | Streaming upload handling, configurable size limits |
| Database (G3 local) | better-sqlite3 | Synchronous, fastest SQLite binding for Node |
| Database (G4 cloud) | @libsql/client (Turso) | SQLite-compatible, remote, HTTP-based |
| Auth (G4 only) | jose (JWT) + bcrypt | Standards-compliant, no heavy auth library needed |
| Validation | Zod (from shared) | Single source of truth for schemas |
| Image processing | Sharp | Fast libvips-based resize/thumbnail generation; runs in worker thread |
| PDF generation | PDFKit | Same library as client — server-side for richer templates in G3+ |
| XLSX generation | ExcelJS | Full XLSX support |
| File storage (G3) | Node.js fs/promises | Direct filesystem |
| File storage (G4) | AWS S3 SDK v3 (`@aws-sdk/client-s3`) | S3-compatible, presigned URLs for large downloads |
| Scheduled cleanup | node-cron | STEP soft-delete cleanup, thumbnail cache pruning |

### 11.4 Shared Package

- Zod schemas for all request/response bodies
- TypeScript types derived from schemas (`z.infer<>`)
- Wire color standard definitions (ISO 6722, SAE J1128)
- AWG/mm² conversion utilities
- Bundle outer diameter calculation (from wire gauges + fill ratio)
- Length formula evaluator (safe expression parser for `formula` mode)
- Strip definition defaults resolver (terminal → wire end pre-population)
- Harness validation rules / DRC logic (shared between server enforcement and client preview)

### 11.5 Tooling

| Tool | Purpose |
|------|---------|
| pnpm workspaces | Monorepo package management |
| Turborepo | Build caching and task orchestration |
| ESLint + Prettier | Code style |
| Vitest | Unit and integration tests (client + server) |
| Playwright | End-to-end tests |
| Docker + docker-compose | Cloud deployment packaging |

---

## 12. Deployment

### 12.1 G1 — Browser-only (Static Site)

```bash
# Build a fully static bundle — no server required at runtime
VITE_BACKEND_URL=  pnpm --filter client build

# Serve from any static host (GitHub Pages, Netlify, S3, nginx, etc.)
# Or locally during development:
npx serve packages/client/dist
```

The build output is a directory of plain static assets. There is no Node.js runtime dependency, no database, and no environment secrets needed at serve time. The entire application runs inside the visitor's browser. Any static file host works.

### 12.2 G3 — Local Server Mode

```bash
pnpm install

# Development: API + client dev server on localhost:3001
DB_MODE=local VITE_BACKEND_URL=http://localhost:3001 pnpm dev

# Production build and run
VITE_BACKEND_URL=http://localhost:3001 pnpm build
DB_MODE=local node packages/server/dist/index.js
```

`VITE_BACKEND_URL` is baked into the client at compile time. When set, the client uses `ApiAdapter` instead of `IndexedDBAdapter` — no feature differences, no conditional UI. The Fastify server serves the pre-built client bundle on `localhost:3001` alongside the REST API.

### 12.3 G4 — Cloud Mode (Docker)

```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - DB_MODE=cloud
      - DATABASE_URL=${TURSO_DATABASE_URL}
      - DATABASE_AUTH_TOKEN=${TURSO_AUTH_TOKEN}
      - JWT_SECRET=${JWT_SECRET}
      - S3_BUCKET=${S3_BUCKET}
      - S3_REGION=${S3_REGION}
    ports:
      - "3001:3001"
```

A single container serves both the static client bundle and the REST/WebSocket API.

### 12.4 Database Migrations (G3+)

```bash
pnpm migrate:up              # run all pending migrations
pnpm migrate:down            # rollback the last migration
pnpm migrate:create <n>      # scaffold a new migration file
```

Migrations are plain `.sql` files in `/migrations/`, executed by a lightweight TypeScript runner that works identically against better-sqlite3 (G3) and libSQL (G4).

### 12.5 Environment Variables

| Variable | G1 | G3 | G4 |
|----------|----|----|----|
| `VITE_BACKEND_URL` | _(empty — IndexedDB adapter)_ | `http://localhost:3001` | `https://<host>` |
| `DB_MODE` | — | `local` | `cloud` |
| `DB_PATH` | — | `./data/harness.db` | — |
| `DATABASE_URL` | — | — | required |
| `DATABASE_AUTH_TOKEN` | — | — | required |
| `JWT_SECRET` | — | — | required |
| `PORT` | — | `3001` | `3001` |
| `UPLOAD_DIR` | — | `./data/uploads` | — |
| `S3_BUCKET` | — | — | required |
| `S3_REGION` | — | — | required |
| `S3_KEY_PREFIX` | — | — | optional |
| `S3_ENDPOINT` | — | — | optional (non-AWS S3-compatible stores) |
| `IMAGE_MAX_BYTES` | — | `20971520` (20 MB) | `20971520` |
| `STEP_MAX_BYTES` | — | `209715200` (200 MB) | `209715200` |
| `THUMBNAIL_CACHE_TTL_DAYS` | — | `30` | `30` |
---

## 13. Out of Scope (v1.0)

- **In-browser STEP file viewer** — STEP files are stored and downloadable; 3D rendering in the browser (e.g. via OpenCascade.js) is deferred to v2
- **Automatic protection sizing recommendation** — the system validates sizing but does not suggest a replacement material; that is a v2 feature
- **Chained split/join optimization** — the system supports arbitrary split/join chains but does not auto-simplify redundant nodes
- 3D harness routing / form board layout
- CAD import (DXF, CATIA, Capital) — STEP *upload/download* is in scope; parsing STEP geometry to extract dimensions is not
- Real-time multi-cursor collaboration (WebSocket broadcasts changes; conflict resolution deferred)
- Native desktop packaging (Electron) — local mode runs in the browser against a local Node server
- Mobile / tablet touch support
- Automated electrical simulation or continuity checking
- Integration with ERP or PLM systems (API is available for third-party integration)
- Multi-language (i18n) support
- Image OCR / automatic datasheet parsing

---

## 14. Open Questions

| # | Question | Owner | Target Date |
|---|----------|-------|-------------|
| OQ-1 | Should the cloud deployment support self-hosted SQLite (file on server) as an alternative to Turso, for users who cannot use a cloud DB service? | Engineering | — |
| OQ-2 | What connector library standards should ship in v1 (Deutsch, TE, Molex, Amphenol)? What is the licensing model for part data? | Product | — |
| OQ-3 | Is real-time multi-cursor collaboration (v2 feature) a hard requirement for the cloud launch or a nice-to-have? | Product | — |
| OQ-4 | Should cut sheets include a visual wire-path diagram, or is a tabular format sufficient for v1? | UX | — |
| OQ-5 | What is the maximum harness size we need to support (wire count, node count) for performance benchmarking? | Engineering | — |
| OQ-6 | Does the PDF export template engine need to support customer branding (logo, colors) in v1, or is a single default template acceptable? | Product | — |
| OQ-7 | Should component images uploaded to the global (built-in) library be editable by all users, or only by designated library admins? What is the admin designation flow? | Product | — |
| OQ-8 | Is 200 MB the right STEP file size cap? Some full-vehicle harness STEP assemblies exceed 1 GB. Should we support chunked/resumable upload (e.g. S3 multipart) from day one? | Engineering | — |
| OQ-9 | Should the `.chd` project export embed images as Base64 (fully self-contained, larger file) or store them as references with a separate download step (smaller file, requires connectivity)? | Product | — |
| OQ-10 | For length `formula` mode, what expression syntax should be supported? A simple `schematic * factor + offset` model, or a full expression language (supporting per-segment references)? | Engineering | — |
| OQ-11 | Should strip length defaults defined on a terminal component auto-update wire end strips when the terminal library entry is edited, or only apply at the moment of assignment? | Product | — |
| OQ-12 | Are there any regulatory or quality-system requirements (e.g. IATF 16949, AS9100) that mandate specific fields or audit trails on strip/length data? | Product/Legal | — |
| OQ-13 | When a cable is split and a fan-out wire is later re-routed to a new destination, should the split node update automatically or require manual confirmation? What if the wire gauge changes? | Engineering | — |
| OQ-14 | Should join operations enforce that all incoming conductors must be fully routed (i.e. connected to a pin at their other end), or allow partial joins for in-progress designs? | Product | — |
| OQ-15 | What is the canonical colour coding scheme for protection bands on the canvas? Should users be able to customise per-category colours project-wide, or should they be fixed by material category? | UX | — |
| OQ-16 | Should the built-in protective materials library ship with real part numbers (Hellermann Tyton, TE, Raychem, etc.), and if so, how do we handle part number changes and regional availability? | Product | — |
| OQ-17 | For the Assembly Drawing document, should coverage band lengths be annotated with absolute offsets, or relative to the nearest node? Both? | UX | — |

---

*End of Document*

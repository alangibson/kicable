import { z } from 'zod';

// ---------------------------------------------------------------------------
// ConnectorInstance — a Component placed on the canvas (FR-SE-02)
// ---------------------------------------------------------------------------

export const ConnectorInstanceSchema = z.object({
  /** Unique ID of this canvas placement */
  id: z.string().uuid(),
  /** References Component.id from the project component library */
  componentId: z.string().uuid(),
  /** Component.version at the time this instance was placed (FR-CL-06) */
  componentVersion: z.number().int().nonnegative().default(0),
  /** Reference designator / label shown on canvas (e.g. "J1", "P2") */
  label: z.string().max(64).default(''),
  x: z.number().default(0),
  y: z.number().default(0),
});
export type ConnectorInstance = z.infer<typeof ConnectorInstanceSchema>;

// ---------------------------------------------------------------------------
// WireEndPoint — which connector-pin a wire attaches to
// ---------------------------------------------------------------------------

export const WireEndPointSchema = z.object({
  /** References ConnectorInstance.id */
  connectorId: z.string().uuid(),
  pinNumber: z.number().int().positive(),
});
export type WireEndPoint = z.infer<typeof WireEndPointSchema>;

// ---------------------------------------------------------------------------
// Wire — a single conductor between two pins (FR-WG-01 / FR-WG-02)
// ---------------------------------------------------------------------------

export const WireSchema = z.object({
  id: z.string().uuid(),
  /** User-editable label / wire number */
  label: z.string().max(128).default(''),
  fromEnd: WireEndPointSchema,
  toEnd: WireEndPointSchema,
  /** AWG gauge (null if using mm²) */
  gaugeAwg: z.number().nullable().default(null),
  /** Cross-section in mm² (null if using AWG) */
  gaugeMm2: z.number().nonnegative().nullable().default(null),
  /** CSS hex color string e.g. "#ff0000" */
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#888888'),
  /** Human-readable color name / abbreviation e.g. "Red", "GN/YE" */
  colorName: z.string().max(64).default(''),
  /** Named signal carried by this wire */
  signalName: z.string().max(128).default(''),
  notes: z.string().max(2000).default(''),
  /** Cable this wire belongs to (null = standalone) */
  cableId: z.string().uuid().nullable().default(null),
  /** Intermediate canvas waypoints */
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).default([]),
});
export type Wire = z.infer<typeof WireSchema>;

// ---------------------------------------------------------------------------
// Cable — multi-conductor cable grouping (FR-WG-05)
// ---------------------------------------------------------------------------

export const CableSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(128).default(''),
  notes: z.string().max(2000).default(''),
});
export type Cable = z.infer<typeof CableSchema>;

// ---------------------------------------------------------------------------
// Signal — named net that can span multiple wires (FR-WG-04)
// ---------------------------------------------------------------------------

export const SignalSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  description: z.string().max(2000).default(''),
});
export type Signal = z.infer<typeof SignalSchema>;

// ---------------------------------------------------------------------------
// ProtectiveMaterialSpan — sleeving/tape/heat-shrink coverage (§6.7)
// ---------------------------------------------------------------------------

export const ProtectiveMaterialSpanSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(128).default(''),
  /** Wire or Cable ID this span is applied to */
  targetId: z.string().uuid(),
  targetType: z.enum(['wire', 'cable']),
  startOffsetMm: z.number().nonnegative().default(0),
  endOffsetMm: z.number().nonnegative().default(0),
  /** References Component.id for the material part */
  materialComponentId: z.string().uuid().nullable().default(null),
  notes: z.string().max(2000).default(''),
});
export type ProtectiveMaterialSpan = z.infer<typeof ProtectiveMaterialSpanSchema>;

// ---------------------------------------------------------------------------
// SpliceNode — 3-way or 4-way junction placed on the canvas (FR-SE-05)
// ---------------------------------------------------------------------------

export const SpliceNodeSchema = z.object({
  id: z.string().uuid(),
  x: z.number().default(0),
  y: z.number().default(0),
  /** 3 = T-junction, 4 = cross junction */
  type: z.enum(['3way', '4way']).default('3way'),
  label: z.string().max(64).default(''),
});
export type SpliceNode = z.infer<typeof SpliceNodeSchema>;

// ---------------------------------------------------------------------------
// Schematic — full canvas data stored in Project.schematic
// ---------------------------------------------------------------------------

export const SchematicSchema = z.object({
  connectors: z.array(ConnectorInstanceSchema).default([]),
  wires: z.array(WireSchema).default([]),
  cables: z.array(CableSchema).default([]),
  signals: z.array(SignalSchema).default([]),
  protectiveSpans: z.array(ProtectiveMaterialSpanSchema).default([]),
  spliceNodes: z.array(SpliceNodeSchema).default([]),
});
export type Schematic = z.infer<typeof SchematicSchema>;

export const EMPTY_SCHEMATIC: Schematic = {
  connectors: [],
  wires: [],
  cables: [],
  signals: [],
  protectiveSpans: [],
  spliceNodes: [],
};

// ---------------------------------------------------------------------------
// Search — unified result type for FR-SN-01
// ---------------------------------------------------------------------------

export type SearchResultKind =
  | 'connector'
  | 'wire'
  | 'cable'
  | 'signal'
  | 'protective_span';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  /** Primary display label */
  label: string;
  /** Secondary subtitle (e.g. signal name, pin info) */
  subtitle: string;
}

/** Search all schematic entities by name or ID substring (case-insensitive). */
export function searchSchematic(
  schematic: Schematic,
  query: string,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];

  const match = (...fields: string[]) =>
    fields.some((f) => f.toLowerCase().includes(q));

  for (const c of schematic.connectors) {
    if (match(c.id, c.label, c.componentId)) {
      results.push({ kind: 'connector', id: c.id, label: c.label || c.id, subtitle: `Connector · ${c.componentId}` });
    }
  }
  for (const w of schematic.wires) {
    if (match(w.id, w.label, w.signalName, w.colorName, w.notes)) {
      results.push({
        kind: 'wire',
        id: w.id,
        label: w.label || w.id,
        subtitle: `Wire · ${w.signalName || '—'} · ${w.colorName || w.colorHex}`,
      });
    }
  }
  for (const c of schematic.cables) {
    if (match(c.id, c.label, c.notes)) {
      results.push({ kind: 'cable', id: c.id, label: c.label || c.id, subtitle: 'Cable' });
    }
  }
  for (const s of schematic.signals) {
    if (match(s.id, s.name, s.description)) {
      results.push({ kind: 'signal', id: s.id, label: s.name, subtitle: `Signal · ${s.description || '—'}` });
    }
  }
  for (const p of schematic.protectiveSpans) {
    if (match(p.id, p.label, p.notes)) {
      results.push({
        kind: 'protective_span',
        id: p.id,
        label: p.label || p.id,
        subtitle: `Protective span on ${p.targetType} ${p.targetId}`,
      });
    }
  }

  return results;
}

import type { LengthUnit, LengthMode } from './types.js';

/** Convert millimetres to the requested display unit */
export function mmToUnit(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return mm;
    case 'cm':
      return mm / 10;
    case 'in':
      return mm / 25.4;
  }
}

/** Convert a value in the given unit back to millimetres */
export function unitToMm(value: number, unit: LengthUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'in':
      return value * 25.4;
  }
}

/** Format a length for display, rounding to 2 decimal places */
export function formatLength(mm: number, unit: LengthUnit): string {
  const converted = mmToUnit(mm, unit);
  return `${parseFloat(converted.toFixed(2))}\u202f${unit}`;
}

/** Clamp a number between min and max (inclusive) */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Return an ISO-8601 UTC datetime string for the current moment */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Check whether IndexedDB estimated usage is approaching the quota.
 * Returns true when usage exceeds `thresholdPct` percent of quota.
 * Falls back to false if the Storage API is unavailable.
 */
export async function isStorageNearQuota(thresholdPct = 80): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return false;
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (quota === 0) return false;
  return usage / quota >= thresholdPct / 100;
}

/** Maximum image file size in bytes (20 MB — FR-CL-07) */
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// §6.5 — Wire insulation OD lookup tables (FR-WG-03)
//
// Outer diameters are approximate nominal values for PVC/XLPE insulated
// automotive wire (single conductor).  Values in millimetres.
// ---------------------------------------------------------------------------

/** Insulation OD (mm) keyed by AWG size. */
export const AWG_INSULATION_OD_MM: Record<number, number> = {
  8:  4.57,
  10: 3.71,
  12: 3.07,
  14: 2.54,
  16: 2.13,
  18: 1.78,
  20: 1.52,
  22: 1.27,
  24: 1.09,
  26: 0.97,
};

/** Insulation OD (mm) keyed by cross-sectional area in mm². */
export const MM2_INSULATION_OD_MM: Record<number, number> = {
  0.35: 2.0,
  0.5:  2.1,
  0.75: 2.3,
  1.0:  2.5,
  1.5:  2.8,
  2.5:  3.5,
  4.0:  4.2,
  6.0:  5.2,
  10.0: 6.5,
  16.0: 8.2,
};

/**
 * Return the nominal insulation OD for a wire given its gauge.
 *
 * Looks up the AWG table when `gaugeAwg` is set, the mm² table when
 * `gaugeMm2` is set.  Returns null when neither gauge is specified or
 * when the exact value is not in the lookup table.
 */
export function wireInsulationOdMm(wire: {
  gaugeAwg: number | null;
  gaugeMm2: number | null;
}): number | null {
  if (wire.gaugeAwg != null) return AWG_INSULATION_OD_MM[wire.gaugeAwg] ?? null;
  if (wire.gaugeMm2 != null) return MM2_INSULATION_OD_MM[wire.gaugeMm2] ?? null;
  return null;
}

/**
 * Compute the outer diameter of a bundle of wires using the fill-ratio
 * method (FR-WG-03).
 *
 * Formula (derived from circular cross-section area):
 *   D_bundle = sqrt( Σ(od_i²) / fillRatio )
 *
 * Wires without a known OD are skipped.  Returns null when the bundle is
 * empty or no OD data is available.
 *
 * @param wireOds   Array of per-wire insulation OD values in mm.
 * @param fillRatio Fraction of bundle cross-section occupied by wire (0–1).
 */
export function computeBundleOuterDiameterMm(
  wireOds: number[],
  fillRatio: number,
): number | null {
  const valid = wireOds.filter((d) => d > 0);
  if (valid.length === 0 || fillRatio <= 0) return null;
  const sumSq = valid.reduce((acc, d) => acc + d * d, 0);
  return Math.sqrt(sumSq / fillRatio);
}

/** STEP file size threshold that triggers a user warning in G1 (50 MB — FR-CL-16) */
export const STEP_FILE_WARN_THRESHOLD_BYTES = 50 * 1024 * 1024;

/** Maximum STEP file size in bytes (200 MB — FR-CL-15) */
export const MAX_STEP_FILE_SIZE_BYTES = 200 * 1024 * 1024;

// ---------------------------------------------------------------------------
// §6.4.2 — Wire length helpers
// ---------------------------------------------------------------------------

/**
 * Compute the effective length of a wire in mm given project settings.
 *
 * - 'schematic' mode: uses `schematicLengthMm` (computed from canvas geometry)
 * - 'override'  mode: uses `overrideLengthMm`
 * - 'formula'   mode: returns null (formula evaluation not implemented in G1)
 *
 * Routing slack is applied unless the wire has opted out (FR-WP-05).
 */
export function getEffectiveLengthMm(
  wire: {
    lengthMode: LengthMode;
    overrideLengthMm: number | null;
    routingSlackOptOut: boolean;
  },
  schematicLengthMm: number | null,
  routingSlackPct: number,
): number | null {
  let baseMm: number | null;

  switch (wire.lengthMode) {
    case 'schematic':
      baseMm = schematicLengthMm;
      break;
    case 'override':
      baseMm = wire.overrideLengthMm;
      break;
    case 'formula':
      baseMm = null; // formula evaluation deferred
      break;
    default:
      baseMm = null;
  }

  if (baseMm == null) return null;

  const slack = wire.routingSlackOptOut ? 0 : routingSlackPct;
  return baseMm * (1 + slack / 100);
}

/** Euclidean distance between two 2-D points. */
function dist2d(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

/**
 * Compute the schematic path length of a wire in mm.
 *
 * Sums the pixel distances along the path
 *   fromConnector → waypoints → toConnector
 * and multiplies by `scaleMmPerPx` (FR-WP-03).
 *
 * Returns null if either endpoint connector is not found.
 */
export function computeWireSchematicLengthMm(
  wire: {
    fromEnd: { connectorId: string };
    toEnd: { connectorId: string };
    waypoints: { x: number; y: number }[];
  },
  connectors: { id: string; x: number; y: number }[],
  scaleMmPerPx: number,
): number | null {
  const from = connectors.find((c) => c.id === wire.fromEnd.connectorId);
  const to = connectors.find((c) => c.id === wire.toEnd.connectorId);
  if (!from || !to) return null;

  const points = [
    { x: from.x, y: from.y },
    ...wire.waypoints,
    { x: to.x, y: to.y },
  ];

  let totalPx = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    totalPx += dist2d(prev.x, prev.y, curr.x, curr.y);
  }

  return totalPx * scaleMmPerPx;
}

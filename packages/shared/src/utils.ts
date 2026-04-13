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

import type { LengthUnit } from './types.js';

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

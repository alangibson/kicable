/**
 * Standard wire color palettes and bundle diameter utilities (FR-WG-02, FR-WG-03).
 *
 * Color standards:
 *   ISO 6722  — European automotive wire color coding
 *   SAE J1128 — North-American automotive wire color coding
 *
 * Diameter / bundle:
 *   AWG bare-copper conductor diameter table
 *   calcBundleDiameter — fill-ratio model for bundle OD
 */

// ---------------------------------------------------------------------------
// Color presets
// ---------------------------------------------------------------------------

export interface WireColorPreset {
  /** Short standard code e.g. "BK", "RD/BU" */
  code: string;
  /** Human-readable name e.g. "Black", "Red/Blue" */
  name: string;
  /** CSS hex color #rrggbb (primary/base color for mixed codes) */
  hex: string;
  standard: 'ISO6722' | 'SAEJ1128';
}

/** ISO 6722 color codes (European automotive) */
export const ISO_6722_COLORS: WireColorPreset[] = [
  { code: 'BK',    name: 'Black',         hex: '#1a1a1a', standard: 'ISO6722' },
  { code: 'BN',    name: 'Brown',         hex: '#8B4513', standard: 'ISO6722' },
  { code: 'RD',    name: 'Red',           hex: '#CC0000', standard: 'ISO6722' },
  { code: 'OG',    name: 'Orange',        hex: '#FF8000', standard: 'ISO6722' },
  { code: 'YE',    name: 'Yellow',        hex: '#D4C000', standard: 'ISO6722' },
  { code: 'GN',    name: 'Green',         hex: '#007700', standard: 'ISO6722' },
  { code: 'BU',    name: 'Blue',          hex: '#0055CC', standard: 'ISO6722' },
  { code: 'VT',    name: 'Violet',        hex: '#7700AA', standard: 'ISO6722' },
  { code: 'GY',    name: 'Grey',          hex: '#808080', standard: 'ISO6722' },
  { code: 'WH',    name: 'White',         hex: '#EEEEEE', standard: 'ISO6722' },
  { code: 'PK',    name: 'Pink',          hex: '#FF69B4', standard: 'ISO6722' },
  { code: 'TE',    name: 'Turquoise',     hex: '#008080', standard: 'ISO6722' },
  { code: 'GN/YE', name: 'Green-Yellow', hex: '#66BB00', standard: 'ISO6722' },
  { code: 'RD/BU', name: 'Red-Blue',     hex: '#882266', standard: 'ISO6722' },
  { code: 'RD/WH', name: 'Red-White',    hex: '#DD3333', standard: 'ISO6722' },
  { code: 'BK/RD', name: 'Black-Red',    hex: '#880000', standard: 'ISO6722' },
  { code: 'BK/WH', name: 'Black-White',  hex: '#555555', standard: 'ISO6722' },
  { code: 'BU/WH', name: 'Blue-White',   hex: '#3377CC', standard: 'ISO6722' },
];

/** SAE J1128 color codes (North-American automotive) */
export const SAE_J1128_COLORS: WireColorPreset[] = [
  { code: 'BLK',    name: 'Black',       hex: '#1a1a1a', standard: 'SAEJ1128' },
  { code: 'WHT',    name: 'White',       hex: '#EEEEEE', standard: 'SAEJ1128' },
  { code: 'RED',    name: 'Red',         hex: '#CC0000', standard: 'SAEJ1128' },
  { code: 'GRN',    name: 'Green',       hex: '#007700', standard: 'SAEJ1128' },
  { code: 'ORN',    name: 'Orange',      hex: '#FF8000', standard: 'SAEJ1128' },
  { code: 'BLU',    name: 'Blue',        hex: '#0055CC', standard: 'SAEJ1128' },
  { code: 'BRN',    name: 'Brown',       hex: '#8B4513', standard: 'SAEJ1128' },
  { code: 'YEL',    name: 'Yellow',      hex: '#D4C000', standard: 'SAEJ1128' },
  { code: 'GRA',    name: 'Gray',        hex: '#808080', standard: 'SAEJ1128' },
  { code: 'PNK',    name: 'Pink',        hex: '#FF69B4', standard: 'SAEJ1128' },
  { code: 'TAN',    name: 'Tan',         hex: '#D2B48C', standard: 'SAEJ1128' },
  { code: 'VIO',    name: 'Violet',      hex: '#7700AA', standard: 'SAEJ1128' },
  { code: 'LT BLU', name: 'Light Blue', hex: '#87CEEB', standard: 'SAEJ1128' },
  { code: 'LT GRN', name: 'Light Green',hex: '#90EE90', standard: 'SAEJ1128' },
  { code: 'DK BLU', name: 'Dark Blue',  hex: '#00008B', standard: 'SAEJ1128' },
  { code: 'DK GRN', name: 'Dark Green', hex: '#006400', standard: 'SAEJ1128' },
];

/** All presets (ISO 6722 first, then SAE J1128) */
export const ALL_WIRE_COLORS: WireColorPreset[] = [
  ...ISO_6722_COLORS,
  ...SAE_J1128_COLORS,
];

/** Find a preset by code (case-insensitive). Returns undefined if not found. */
export function findColorPreset(code: string): WireColorPreset | undefined {
  return ALL_WIRE_COLORS.find((c) => c.code.toLowerCase() === code.toLowerCase());
}

// ---------------------------------------------------------------------------
// AWG conductor bare-copper diameter table (mm)
// Values from ASTM B258 / IEC 60228
// ---------------------------------------------------------------------------

const AWG_DIAMETER_MM: Readonly<Record<number, number>> = {
  4:  5.189,
  6:  4.115,
  8:  3.264,
  10: 2.588,
  12: 2.053,
  14: 1.628,
  16: 1.291,
  18: 1.024,
  20: 0.812,
  22: 0.644,
  24: 0.511,
  26: 0.405,
  28: 0.321,
  30: 0.255,
};

/**
 * Return the bare-copper conductor diameter in mm for a given AWG gauge.
 * Returns null for gauges not in the table.
 */
export function awgDiameterMm(awg: number): number | null {
  return AWG_DIAMETER_MM[awg] ?? null;
}

/**
 * Convert cross-section area (mm²) to conductor diameter (mm).
 * d = 2 × √(A / π)
 */
export function mm2DiameterMm(areaMm2: number): number {
  return 2 * Math.sqrt(areaMm2 / Math.PI);
}

// ---------------------------------------------------------------------------
// Bundle outer diameter (FR-WG-03)
// ---------------------------------------------------------------------------

/**
 * Estimate the outer diameter (mm) of a bundle of wires using a fill-ratio model.
 *
 * Formula (IPC-D-317A area method):
 *   A_conductors = Σ π(d_i / 2)²
 *   A_bundle     = A_conductors / fillRatio
 *   OD_bundle    = 2 × √(A_bundle / π)
 *
 * @param wires      Array of wire gauge records (only gaugeAwg / gaugeMm2 are used)
 * @param fillRatio  Conductor fill ratio 0.1–1.0 (default 0.6 per IPC-D-317A typical)
 * @returns Estimated outer diameter in mm, or null when no wires have gauge info
 */
export function calcBundleDiameter(
  wires: ReadonlyArray<{ gaugeAwg: number | null; gaugeMm2: number | null }>,
  fillRatio = 0.6,
): number | null {
  let totalArea = 0;
  let hasGauge = false;

  for (const w of wires) {
    let dMm: number | null = null;
    if (w.gaugeAwg != null) {
      dMm = awgDiameterMm(w.gaugeAwg);
    } else if (w.gaugeMm2 != null) {
      dMm = mm2DiameterMm(w.gaugeMm2);
    }
    if (dMm != null) {
      totalArea += Math.PI * (dMm / 2) ** 2;
      hasGauge = true;
    }
  }

  if (!hasGauge || totalArea === 0) return null;

  const ratio = Math.max(0.01, Math.min(1, fillRatio));
  const bundleArea = totalArea / ratio;
  return 2 * Math.sqrt(bundleArea / Math.PI);
}

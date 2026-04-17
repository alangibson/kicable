/**
 * Wire color standard definitions (FR-WG-02).
 *
 * Supports:
 *   - ISO 6722  — European automotive wire colour coding
 *   - SAE J1128 — North American automotive wire colour coding
 *   - custom    — user-supplied hex + name (no lookup needed)
 */

export type WireColorStandard = 'ISO_6722' | 'SAE_J1128' | 'custom';

export interface WireColorEntry {
  /** Short code as used in the standard (e.g. "BK", "RD") */
  code: string;
  /** Human-readable colour name */
  name: string;
  /** Representative CSS hex value */
  hex: string;
}

// ---------------------------------------------------------------------------
// ISO 6722 — automotive wire colours (single and bicolour)
// ---------------------------------------------------------------------------

export const ISO_6722_COLORS: WireColorEntry[] = [
  { code: 'BK', name: 'Black',           hex: '#000000' },
  { code: 'BN', name: 'Brown',           hex: '#7b3f00' },
  { code: 'RD', name: 'Red',             hex: '#cc0000' },
  { code: 'OG', name: 'Orange',          hex: '#ff8c00' },
  { code: 'YE', name: 'Yellow',          hex: '#ffcc00' },
  { code: 'GN', name: 'Green',           hex: '#008000' },
  { code: 'BL', name: 'Blue',            hex: '#0055cc' },
  { code: 'VT', name: 'Violet',          hex: '#7c3aed' },
  { code: 'GY', name: 'Grey',            hex: '#808080' },
  { code: 'WH', name: 'White',           hex: '#ffffff' },
  { code: 'PK', name: 'Pink',            hex: '#ff69b4' },
  { code: 'TQ', name: 'Turquoise',       hex: '#00ced1' },
  { code: 'GN/YE', name: 'Green/Yellow', hex: '#6ab04c' },
  { code: 'BN/WH', name: 'Brown/White',  hex: '#b5855a' },
  { code: 'RD/BK', name: 'Red/Black',    hex: '#990000' },
  { code: 'BL/RD', name: 'Blue/Red',     hex: '#3366cc' },
];

// ---------------------------------------------------------------------------
// SAE J1128 — automotive wire colours
// ---------------------------------------------------------------------------

export const SAE_J1128_COLORS: WireColorEntry[] = [
  { code: 'BLK', name: 'Black',        hex: '#000000' },
  { code: 'BRN', name: 'Brown',        hex: '#7b3f00' },
  { code: 'RED', name: 'Red',          hex: '#cc0000' },
  { code: 'ORN', name: 'Orange',       hex: '#ff8c00' },
  { code: 'YEL', name: 'Yellow',       hex: '#ffcc00' },
  { code: 'GRN', name: 'Green',        hex: '#008000' },
  { code: 'BLU', name: 'Blue',         hex: '#0055cc' },
  { code: 'PUR', name: 'Purple',       hex: '#7c3aed' },
  { code: 'GRA', name: 'Gray',         hex: '#808080' },
  { code: 'WHT', name: 'White',        hex: '#ffffff' },
  { code: 'PNK', name: 'Pink',         hex: '#ff69b4' },
  { code: 'LT BLU', name: 'Light Blue', hex: '#87ceeb' },
  { code: 'TAN', name: 'Tan',          hex: '#d2b48c' },
  { code: 'GRN/YEL', name: 'Green/Yellow', hex: '#6ab04c' },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const _isoMap = new Map(ISO_6722_COLORS.map((c) => [c.code.toUpperCase(), c]));
const _saeMap = new Map(SAE_J1128_COLORS.map((c) => [c.code.toUpperCase(), c]));

/**
 * Look up a colour entry by code within a standard.
 * Returns undefined when the code is not found.
 */
export function lookupWireColor(
  standard: WireColorStandard,
  code: string,
): WireColorEntry | undefined {
  if (standard === 'ISO_6722') return _isoMap.get(code.toUpperCase());
  if (standard === 'SAE_J1128') return _saeMap.get(code.toUpperCase());
  return undefined;
}

/**
 * Return all colour entries for a given standard.
 * Returns an empty array for 'custom'.
 */
export function getColorStandardEntries(standard: WireColorStandard): WireColorEntry[] {
  if (standard === 'ISO_6722') return ISO_6722_COLORS;
  if (standard === 'SAE_J1128') return SAE_J1128_COLORS;
  return [];
}

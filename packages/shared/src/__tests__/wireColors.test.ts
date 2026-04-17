import { describe, it, expect } from 'vitest';
import {
  ISO_6722_COLORS,
  SAE_J1128_COLORS,
  lookupWireColor,
  getColorStandardEntries,
} from '../wireColors.js';

describe('ISO_6722_COLORS', () => {
  it('contains at least 12 entries', () => {
    expect(ISO_6722_COLORS.length).toBeGreaterThanOrEqual(12);
  });

  it('every entry has a valid hex color', () => {
    for (const c of ISO_6722_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('contains Black (BK)', () => {
    const bk = ISO_6722_COLORS.find((c) => c.code === 'BK');
    expect(bk).toBeDefined();
    expect(bk!.hex).toBe('#000000');
  });

  it('contains the protective earth bicolour GN/YE', () => {
    const gnye = ISO_6722_COLORS.find((c) => c.code === 'GN/YE');
    expect(gnye).toBeDefined();
  });
});

describe('SAE_J1128_COLORS', () => {
  it('contains at least 10 entries', () => {
    expect(SAE_J1128_COLORS.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has a valid hex color', () => {
    for (const c of SAE_J1128_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('contains Black (BLK)', () => {
    const blk = SAE_J1128_COLORS.find((c) => c.code === 'BLK');
    expect(blk).toBeDefined();
    expect(blk!.hex).toBe('#000000');
  });
});

describe('lookupWireColor', () => {
  it('finds an ISO 6722 colour by code (case-insensitive)', () => {
    const result = lookupWireColor('ISO_6722', 'rd');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Red');
  });

  it('finds a SAE J1128 colour by code', () => {
    const result = lookupWireColor('SAE_J1128', 'GRN');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Green');
  });

  it('returns undefined for an unknown code', () => {
    expect(lookupWireColor('ISO_6722', 'ZZ')).toBeUndefined();
  });

  it('returns undefined for custom standard', () => {
    expect(lookupWireColor('custom', 'RD')).toBeUndefined();
  });
});

describe('getColorStandardEntries', () => {
  it('returns ISO 6722 entries', () => {
    const entries = getColorStandardEntries('ISO_6722');
    expect(entries).toBe(ISO_6722_COLORS);
  });

  it('returns SAE J1128 entries', () => {
    const entries = getColorStandardEntries('SAE_J1128');
    expect(entries).toBe(SAE_J1128_COLORS);
  });

  it('returns empty array for custom', () => {
    expect(getColorStandardEntries('custom')).toHaveLength(0);
  });
});

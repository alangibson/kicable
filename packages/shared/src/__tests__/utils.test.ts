import { describe, it, expect } from 'vitest';
import {
  mmToUnit,
  unitToMm,
  formatLength,
  clamp,
  nowIso,
  wireInsulationOdMm,
  computeBundleOuterDiameterMm,
} from '../utils.js';

describe('mmToUnit', () => {
  it('returns mm unchanged', () => {
    expect(mmToUnit(100, 'mm')).toBe(100);
  });

  it('converts mm to cm', () => {
    expect(mmToUnit(100, 'cm')).toBe(10);
  });

  it('converts mm to inches', () => {
    expect(mmToUnit(25.4, 'in')).toBeCloseTo(1, 5);
  });
});

describe('unitToMm', () => {
  it('converts cm to mm', () => {
    expect(unitToMm(10, 'cm')).toBe(100);
  });

  it('converts inches to mm', () => {
    expect(unitToMm(1, 'in')).toBeCloseTo(25.4, 5);
  });

  it('round-trips mm → unit → mm', () => {
    const original = 123.456;
    for (const unit of ['mm', 'cm', 'in'] as const) {
      expect(unitToMm(mmToUnit(original, unit), unit)).toBeCloseTo(original, 5);
    }
  });
});

describe('formatLength', () => {
  it('formats mm with unit suffix', () => {
    expect(formatLength(100, 'mm')).toBe('100\u202fmm');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatLength(25.4, 'in')).toBe('1\u202fin');
  });

  it('strips trailing zeros', () => {
    expect(formatLength(10, 'cm')).toBe('1\u202fcm');
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('nowIso', () => {
  it('returns a valid ISO datetime string', () => {
    const result = nowIso();
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });
});

describe('wireInsulationOdMm', () => {
  it('returns OD for known AWG gauge', () => {
    expect(wireInsulationOdMm({ gaugeAwg: 18, gaugeMm2: null })).toBeCloseTo(1.78, 2);
  });

  it('returns OD for known mm² gauge', () => {
    expect(wireInsulationOdMm({ gaugeAwg: null, gaugeMm2: 1.5 })).toBeCloseTo(2.8, 2);
  });

  it('returns null when no gauge is set', () => {
    expect(wireInsulationOdMm({ gaugeAwg: null, gaugeMm2: null })).toBeNull();
  });

  it('returns null for an unknown AWG value', () => {
    expect(wireInsulationOdMm({ gaugeAwg: 99, gaugeMm2: null })).toBeNull();
  });

  it('AWG takes precedence over mm² when both set', () => {
    expect(wireInsulationOdMm({ gaugeAwg: 20, gaugeMm2: 1.5 })).toBeCloseTo(1.52, 2);
  });
});

describe('computeBundleOuterDiameterMm', () => {
  it('returns null for an empty array', () => {
    expect(computeBundleOuterDiameterMm([], 0.6)).toBeNull();
  });

  it('returns null when fillRatio is zero', () => {
    expect(computeBundleOuterDiameterMm([2.0, 2.0], 0)).toBeNull();
  });

  it('single wire: diameter = od / sqrt(fillRatio)', () => {
    const od = 2.0;
    const fill = 0.6;
    const expected = Math.sqrt((od * od) / fill);
    expect(computeBundleOuterDiameterMm([od], fill)).toBeCloseTo(expected, 5);
  });

  it('two equal wires: diameter grows vs single wire', () => {
    const single = computeBundleOuterDiameterMm([2.0], 0.6)!;
    const dual = computeBundleOuterDiameterMm([2.0, 2.0], 0.6)!;
    expect(dual).toBeGreaterThan(single);
  });

  it('higher fill ratio produces smaller bundle', () => {
    const loose = computeBundleOuterDiameterMm([2.0, 2.0], 0.4)!;
    const tight = computeBundleOuterDiameterMm([2.0, 2.0], 0.8)!;
    expect(tight).toBeLessThan(loose);
  });

  it('skips zero-OD wires', () => {
    const result = computeBundleOuterDiameterMm([2.0, 0, 2.0], 0.6)!;
    const expected = computeBundleOuterDiameterMm([2.0, 2.0], 0.6)!;
    expect(result).toBeCloseTo(expected, 5);
  });
});

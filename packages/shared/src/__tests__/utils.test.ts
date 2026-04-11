import { describe, it, expect } from 'vitest';
import { mmToUnit, unitToMm, formatLength, clamp, nowIso } from '../utils.js';

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

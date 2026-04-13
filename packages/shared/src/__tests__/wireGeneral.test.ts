/**
 * Tests for §6.5 Wire & Cable General Properties.
 *
 * Covers:
 *   FR-WG-02: wire color standard palettes
 *   FR-WG-03: bundle outer diameter calculation
 *   FR-WG-04: signal name propagation
 */

import { describe, it, expect } from 'vitest';
import {
  ISO_6722_COLORS,
  SAE_J1128_COLORS,
  ALL_WIRE_COLORS,
  findColorPreset,
  awgDiameterMm,
  mm2DiameterMm,
  calcBundleDiameter,
} from '../wireColors.js';
import { propagateSignalName } from '../schematic.js';
import type { Schematic, Wire } from '../schematic.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWire(overrides: Partial<Wire> & { id: string }): Wire {
  return {
    label: '',
    fromEnd: { connectorId: 'c1', pinNumber: 1 },
    toEnd: { connectorId: 'c2', pinNumber: 1 },
    gaugeAwg: null,
    gaugeMm2: null,
    colorHex: '#888888',
    colorName: '',
    signalName: '',
    notes: '',
    cableId: null,
    bundleId: null,
    waypoints: [],
    ...overrides,
  };
}

function makeSchematic(wires: Wire[]): Schematic {
  return {
    connectors: [],
    wires,
    cables: [],
    bundles: [],
    signals: [],
    protectiveSpans: [],
    spliceNodes: [],
  };
}

// ---------------------------------------------------------------------------
// FR-WG-02: color palettes
// ---------------------------------------------------------------------------

describe('ISO 6722 color palette', () => {
  it('has at least 10 entries', () => {
    expect(ISO_6722_COLORS.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has valid hex', () => {
    for (const c of ISO_6722_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('includes BK, RD, GN, BU', () => {
    const codes = ISO_6722_COLORS.map((c) => c.code);
    expect(codes).toContain('BK');
    expect(codes).toContain('RD');
    expect(codes).toContain('GN');
    expect(codes).toContain('BU');
  });
});

describe('SAE J1128 color palette', () => {
  it('has at least 10 entries', () => {
    expect(SAE_J1128_COLORS.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has valid hex', () => {
    for (const c of SAE_J1128_COLORS) {
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('includes BLK, RED, GRN, BLU', () => {
    const codes = SAE_J1128_COLORS.map((c) => c.code);
    expect(codes).toContain('BLK');
    expect(codes).toContain('RED');
    expect(codes).toContain('GRN');
    expect(codes).toContain('BLU');
  });
});

describe('ALL_WIRE_COLORS', () => {
  it('contains all ISO and SAE colors', () => {
    expect(ALL_WIRE_COLORS.length).toBe(ISO_6722_COLORS.length + SAE_J1128_COLORS.length);
  });
});

describe('findColorPreset', () => {
  it('finds a known ISO code case-insensitively', () => {
    const result = findColorPreset('bk');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Black');
    expect(result!.standard).toBe('ISO6722');
  });

  it('finds SAE code', () => {
    const result = findColorPreset('YEL');
    expect(result).toBeDefined();
    expect(result!.standard).toBe('SAEJ1128');
  });

  it('returns undefined for unknown code', () => {
    expect(findColorPreset('UNKNOWN')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FR-WG-03: gauge diameter + bundle diameter
// ---------------------------------------------------------------------------

describe('awgDiameterMm', () => {
  it('returns correct value for AWG 20', () => {
    expect(awgDiameterMm(20)).toBeCloseTo(0.812, 2);
  });

  it('returns correct value for AWG 14', () => {
    expect(awgDiameterMm(14)).toBeCloseTo(1.628, 2);
  });

  it('returns null for unlisted AWG', () => {
    expect(awgDiameterMm(99)).toBeNull();
  });
});

describe('mm2DiameterMm', () => {
  it('returns correct diameter for 0.75 mm²', () => {
    // d = 2 * sqrt(0.75 / π) ≈ 0.977
    expect(mm2DiameterMm(0.75)).toBeCloseTo(0.977, 2);
  });

  it('returns correct diameter for 1.5 mm²', () => {
    expect(mm2DiameterMm(1.5)).toBeCloseTo(1.382, 2);
  });
});

describe('calcBundleDiameter', () => {
  it('returns null when no wires have gauge', () => {
    const wires = [
      { gaugeAwg: null, gaugeMm2: null },
      { gaugeAwg: null, gaugeMm2: null },
    ];
    expect(calcBundleDiameter(wires)).toBeNull();
  });

  it('returns a positive number for AWG wires', () => {
    const wires = [
      { gaugeAwg: 20, gaugeMm2: null },
      { gaugeAwg: 20, gaugeMm2: null },
    ];
    const od = calcBundleDiameter(wires);
    expect(od).not.toBeNull();
    expect(od!).toBeGreaterThan(0);
  });

  it('returns larger diameter with more wires', () => {
    const two = [
      { gaugeAwg: 20, gaugeMm2: null },
      { gaugeAwg: 20, gaugeMm2: null },
    ];
    const four = [
      { gaugeAwg: 20, gaugeMm2: null },
      { gaugeAwg: 20, gaugeMm2: null },
      { gaugeAwg: 20, gaugeMm2: null },
      { gaugeAwg: 20, gaugeMm2: null },
    ];
    const odTwo = calcBundleDiameter(two)!;
    const odFour = calcBundleDiameter(four)!;
    expect(odFour).toBeGreaterThan(odTwo);
  });

  it('accepts mm² gauges', () => {
    const wires = [
      { gaugeAwg: null, gaugeMm2: 1.5 },
      { gaugeAwg: null, gaugeMm2: 1.5 },
    ];
    const od = calcBundleDiameter(wires);
    expect(od).not.toBeNull();
    expect(od!).toBeGreaterThan(0);
  });

  it('clamps fill ratio to a sensible range', () => {
    const wires = [{ gaugeAwg: 20, gaugeMm2: null }];
    const odNormal = calcBundleDiameter(wires, 0.6)!;
    const odClamped = calcBundleDiameter(wires, 999)!; // clamps to 1
    // fillRatio=1 means bundle is exactly the conductor area → smaller OD
    expect(odClamped).toBeLessThanOrEqual(odNormal);
  });
});

// ---------------------------------------------------------------------------
// FR-WG-04: signal name propagation
// ---------------------------------------------------------------------------

describe('propagateSignalName', () => {
  it('does nothing when signalName is empty', () => {
    const w1 = makeWire({ id: 'w1', fromEnd: { connectorId: 'J1', pinNumber: 1 }, toEnd: { connectorId: 'J2', pinNumber: 1 } });
    const w2 = makeWire({ id: 'w2', signalName: 'OLD', fromEnd: { connectorId: 'J1', pinNumber: 1 }, toEnd: { connectorId: 'J3', pinNumber: 2 } });
    const s = makeSchematic([w1, w2]);
    const result = propagateSignalName(s, { ...w1, signalName: '' });
    expect(result.wires.find((x) => x.id === 'w2')!.signalName).toBe('OLD');
  });

  it('propagates to wires sharing the fromEnd pin', () => {
    // w1 and w2 both connect to J1 pin 1
    const w1 = makeWire({ id: 'w1', signalName: 'GND', fromEnd: { connectorId: 'J1', pinNumber: 1 }, toEnd: { connectorId: 'J2', pinNumber: 3 } });
    const w2 = makeWire({ id: 'w2', signalName: '', fromEnd: { connectorId: 'J1', pinNumber: 1 }, toEnd: { connectorId: 'J3', pinNumber: 2 } });
    const w3 = makeWire({ id: 'w3', signalName: '', fromEnd: { connectorId: 'J4', pinNumber: 5 }, toEnd: { connectorId: 'J5', pinNumber: 6 } });
    const s = makeSchematic([w1, w2, w3]);
    const result = propagateSignalName(s, w1);
    expect(result.wires.find((x) => x.id === 'w2')!.signalName).toBe('GND');
    expect(result.wires.find((x) => x.id === 'w3')!.signalName).toBe(''); // unrelated — untouched
  });

  it('propagates to wires sharing the toEnd pin', () => {
    const w1 = makeWire({ id: 'w1', signalName: 'VCC', fromEnd: { connectorId: 'J1', pinNumber: 2 }, toEnd: { connectorId: 'J2', pinNumber: 1 } });
    const w2 = makeWire({ id: 'w2', signalName: '', fromEnd: { connectorId: 'J3', pinNumber: 4 }, toEnd: { connectorId: 'J2', pinNumber: 1 } });
    const s = makeSchematic([w1, w2]);
    const result = propagateSignalName(s, w1);
    expect(result.wires.find((x) => x.id === 'w2')!.signalName).toBe('VCC');
  });

  it('does not overwrite the changed wire itself', () => {
    const w1 = makeWire({ id: 'w1', signalName: 'SIG', fromEnd: { connectorId: 'J1', pinNumber: 1 }, toEnd: { connectorId: 'J2', pinNumber: 1 } });
    const s = makeSchematic([w1]);
    const result = propagateSignalName(s, w1);
    expect(result.wires.find((x) => x.id === 'w1')!.signalName).toBe('SIG');
  });
});

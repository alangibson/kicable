import { describe, it, expect } from 'vitest';
import { runWireDrc, runCableDrc } from '../drc.js';
import type { Wire, Cable } from '../schematic.js';

const now = new Date().toISOString();
const uuid = () => crypto.randomUUID();

const baseWire = (): Wire => ({
  id: uuid(),
  label: 'W1',
  fromEnd: { connectorId: uuid(), pinNumber: 1 },
  toEnd: { connectorId: uuid(), pinNumber: 1 },
  gaugeAwg: null,
  gaugeMm2: null,
  colorHex: '#888888',
  colorName: '',
  signalName: '',
  notes: '',
  cableId: null,
  waypoints: [],
  lengthMode: 'override',
  overrideLengthMm: 500,
  formulaExpr: null,
  routingSlackOptOut: false,
  segments: [],
  endA: {
    label: '',
    stripLengthMm: 10,
    stripType: 'full',
    insulationOdMm: null,
    tinningRequired: false,
    tinningLengthMm: null,
    terminalComponentId: null,
    terminalInsertionDepthMm: null,
    notes: '',
    stepLayers: [],
  },
  endB: {
    label: '',
    stripLengthMm: 10,
    stripType: 'full',
    insulationOdMm: null,
    tinningRequired: false,
    tinningLengthMm: null,
    terminalComponentId: null,
    terminalInsertionDepthMm: null,
    notes: '',
    stepLayers: [],
  },
});

const baseCable = (): Cable => ({
  id: uuid(),
  label: 'C1',
  notes: '',
  overallLengthMm: 500,
  endA: {
    outerJacketStripLengthMm: 20,
    shieldTreatment: 'none',
    drainWireLengthMm: null,
    pigtailLengthMm: null,
    tapeShrinkStartMm: null,
    tapeShrinkLengthMm: null,
  },
  endB: {
    outerJacketStripLengthMm: 20,
    shieldTreatment: 'none',
    drainWireLengthMm: null,
    pigtailLengthMm: null,
    tapeShrinkStartMm: null,
    tapeShrinkLengthMm: null,
  },
});

describe('runWireDrc', () => {
  it('LEN-01: fires when effective length is null', () => {
    const wire = baseWire();
    const v = runWireDrc(wire, { effectiveLengthMm: null });
    expect(v.some((x) => x.code === 'LEN-01')).toBe(true);
  });

  it('LEN-01: fires when effective length is 0', () => {
    const wire = baseWire();
    const v = runWireDrc(wire, { effectiveLengthMm: 0 });
    expect(v.some((x) => x.code === 'LEN-01')).toBe(true);
  });

  it('LEN-01: does not fire for a valid length', () => {
    const wire = baseWire();
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    expect(v.some((x) => x.code === 'LEN-01')).toBe(false);
  });

  it('LEN-02: fires when segment sum mismatches by > 0.5 mm', () => {
    const wire = baseWire();
    wire.segments = [
      { name: 'A', lengthMm: 200, note: '' },
      { name: 'B', lengthMm: 200, note: '' },
    ];
    const v = runWireDrc(wire, { effectiveLengthMm: 500 }); // sum=400, diff=100
    expect(v.some((x) => x.code === 'LEN-02')).toBe(true);
    expect(v.find((x) => x.code === 'LEN-02')!.severity).toBe('warning');
  });

  it('LEN-02: does not fire when within ±0.5 mm', () => {
    const wire = baseWire();
    wire.segments = [
      { name: 'A', lengthMm: 250.2, note: '' },
      { name: 'B', lengthMm: 249.8, note: '' },
    ];
    const v = runWireDrc(wire, { effectiveLengthMm: 500 }); // sum=500, diff=0
    expect(v.some((x) => x.code === 'LEN-02')).toBe(false);
  });

  it('LEN-03: error when strip length > half of overall', () => {
    const wire = baseWire();
    wire.endA.stripLengthMm = 260; // > 500/2 = 250
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    const violation = v.find((x) => x.code === 'LEN-03');
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe('error');
    expect(violation!.message).toContain('End A');
  });

  it('LEN-03: does not fire when strip ≤ half', () => {
    const wire = baseWire();
    wire.endA.stripLengthMm = 249;
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    expect(v.some((x) => x.code === 'LEN-03')).toBe(false);
  });

  it('LEN-04: warning when tinning length > strip length', () => {
    const wire = baseWire();
    wire.endB.tinningRequired = true;
    wire.endB.tinningLengthMm = 15; // strip = 10
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    const violation = v.find((x) => x.code === 'LEN-04');
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe('warning');
    expect(violation!.message).toContain('End B');
  });

  it('LEN-04: does not fire when tinningRequired is false', () => {
    const wire = baseWire();
    wire.endB.tinningRequired = false;
    wire.endB.tinningLengthMm = 20; // would be > strip, but tinning not required
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    expect(v.some((x) => x.code === 'LEN-04')).toBe(false);
  });

  it('LEN-05: warning when terminal insertion depth > strip length', () => {
    const wire = baseWire();
    wire.endA.terminalInsertionDepthMm = 12; // strip = 10
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    const violation = v.find((x) => x.code === 'LEN-05');
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe('warning');
  });

  it('LEN-05: does not fire when depth ≤ strip length', () => {
    const wire = baseWire();
    wire.endA.terminalInsertionDepthMm = 9;
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    expect(v.some((x) => x.code === 'LEN-05')).toBe(false);
  });

  it('LEN-07: info when override differs from schematic by > 20%', () => {
    const wire = baseWire();
    wire.lengthMode = 'override';
    wire.overrideLengthMm = 700;
    const v = runWireDrc(wire, {
      effectiveLengthMm: 700,
      schematicLengthMm: 500, // 40% diff
    });
    const violation = v.find((x) => x.code === 'LEN-07');
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe('info');
  });

  it('LEN-07: does not fire when within 20%', () => {
    const wire = baseWire();
    wire.lengthMode = 'override';
    wire.overrideLengthMm = 510;
    const v = runWireDrc(wire, {
      effectiveLengthMm: 510,
      schematicLengthMm: 500, // 2% diff
    });
    expect(v.some((x) => x.code === 'LEN-07')).toBe(false);
  });

  it('LEN-07: does not fire when mode is schematic', () => {
    const wire = baseWire();
    wire.lengthMode = 'schematic';
    wire.overrideLengthMm = 700;
    const v = runWireDrc(wire, {
      effectiveLengthMm: 500,
      schematicLengthMm: 500,
    });
    expect(v.some((x) => x.code === 'LEN-07')).toBe(false);
  });

  it('returns no violations for a clean wire', () => {
    const wire = baseWire();
    const v = runWireDrc(wire, { effectiveLengthMm: 500 });
    expect(v).toHaveLength(0);
  });
});

describe('runCableDrc', () => {
  it('LEN-06: warning when jacket strip > overall length', () => {
    const cable = baseCable();
    cable.endA.outerJacketStripLengthMm = 600; // > 500
    const v = runCableDrc(cable, 500);
    const violation = v.find((x) => x.code === 'LEN-06');
    expect(violation).toBeDefined();
    expect(violation!.severity).toBe('warning');
    expect(violation!.message).toContain('End A');
  });

  it('LEN-06: does not fire when jacket strip ≤ overall length', () => {
    const cable = baseCable();
    cable.endA.outerJacketStripLengthMm = 20;
    const v = runCableDrc(cable, 500);
    expect(v.some((x) => x.code === 'LEN-06')).toBe(false);
  });

  it('returns empty when effectiveLengthMm is null', () => {
    const cable = baseCable();
    cable.endA.outerJacketStripLengthMm = 999;
    const v = runCableDrc(cable, null);
    expect(v).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { runWireDrc, runCableDrc, runSplitJoinDrc } from '../drc.js';
import type { Wire, Cable, Schematic } from '../schematic.js';
import { EMPTY_SCHEMATIC } from '../schematic.js';

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

// ── Helpers for split/join DRC tests ──────────────────────────────────────────

function baseSchematic(overrides?: Partial<Schematic>): Schematic {
  return { ...EMPTY_SCHEMATIC, ...overrides };
}

function makeSplitNode(overrides?: Partial<Schematic['splitNodes'][number]>) {
  return {
    id: uuid(),
    x: 0,
    y: 0,
    label: 'SP1',
    cableId: null,
    fanOutLengthMm: 0,
    ...overrides,
  };
}

function makeJoinNode(overrides?: Partial<Schematic['joinNodes'][number]>) {
  return {
    id: uuid(),
    x: 0,
    y: 0,
    label: 'JN1',
    cableId: null,
    fanInLengthMm: 0,
    ...overrides,
  };
}

function makeConnector(idOverride?: string) {
  return { id: idOverride ?? uuid(), componentId: uuid(), componentVersion: 0, label: '', x: 0, y: 0 };
}

describe('runSplitJoinDrc', () => {
  // ── SPLIT-01 ──────────────────────────────────────────────────────────────

  it('SPLIT-01: warns when fan-out wire has no further connection', () => {
    const splitNode = makeSplitNode();
    const fanOutWire = baseWire();
    fanOutWire.fromEnd = { connectorId: splitNode.id, pinNumber: 1 };
    // toEnd.connectorId is a random uuid not in any node list → no further connection
    const s = baseSchematic({ splitNodes: [splitNode], wires: [fanOutWire] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-01')).toBe(true);
    expect(v.find((x) => x.code === 'SPLIT-01')!.severity).toBe('warning');
  });

  it('SPLIT-01: does not fire when fan-out wire connects to a valid connector', () => {
    const splitNode = makeSplitNode();
    const connector = makeConnector();
    const fanOutWire = baseWire();
    fanOutWire.fromEnd = { connectorId: splitNode.id, pinNumber: 1 };
    fanOutWire.toEnd = { connectorId: connector.id, pinNumber: 1 };
    const s = baseSchematic({ splitNodes: [splitNode], connectors: [connector], wires: [fanOutWire] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-01')).toBe(false);
  });

  // ── SPLIT-02 ──────────────────────────────────────────────────────────────

  it('SPLIT-02: info when fan-out length is 0 mm', () => {
    const splitNode = makeSplitNode({ fanOutLengthMm: 0 });
    const s = baseSchematic({ splitNodes: [splitNode] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-02')).toBe(true);
    expect(v.find((x) => x.code === 'SPLIT-02')!.severity).toBe('info');
  });

  it('SPLIT-02: does not fire when fan-out length > 0', () => {
    const splitNode = makeSplitNode({ fanOutLengthMm: 50 });
    const s = baseSchematic({ splitNodes: [splitNode] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-02')).toBe(false);
  });

  // ── SPLIT-03 ──────────────────────────────────────────────────────────────

  it('SPLIT-03: error when split node references unknown cable', () => {
    const splitNode = makeSplitNode({ cableId: uuid() }); // random uuid, no cable
    const s = baseSchematic({ splitNodes: [splitNode] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-03')).toBe(true);
    expect(v.find((x) => x.code === 'SPLIT-03')!.severity).toBe('error');
  });

  it('SPLIT-03: does not fire when cableId is null', () => {
    const splitNode = makeSplitNode({ cableId: null, fanOutLengthMm: 10 });
    const s = baseSchematic({ splitNodes: [splitNode] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-03')).toBe(false);
  });

  it('SPLIT-03: error when incoming conductor does not belong to referenced cable', () => {
    const cable = baseCable();
    const cable2 = baseCable();
    const splitNode = makeSplitNode({ cableId: cable.id, fanOutLengthMm: 10 });
    // Incoming wire belongs to a DIFFERENT cable
    const incomingWire = baseWire();
    incomingWire.cableId = cable2.id;
    incomingWire.toEnd = { connectorId: splitNode.id, pinNumber: 1 };
    const s = baseSchematic({ splitNodes: [splitNode], cables: [cable, cable2], wires: [incomingWire] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'SPLIT-03')).toBe(true);
  });

  // ── JOIN-01 ───────────────────────────────────────────────────────────────

  it('JOIN-01: warns when conductors have mixed AWG gauges', () => {
    const joinNode = makeJoinNode();
    const w1 = baseWire();
    w1.gaugeAwg = 16;
    w1.gaugeMm2 = null;
    w1.toEnd = { connectorId: joinNode.id, pinNumber: 1 };
    const w2 = baseWire();
    w2.gaugeAwg = 18;
    w2.gaugeMm2 = null;
    w2.toEnd = { connectorId: joinNode.id, pinNumber: 2 };
    const s = baseSchematic({ joinNodes: [joinNode], wires: [w1, w2] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'JOIN-01')).toBe(true);
    expect(v.find((x) => x.code === 'JOIN-01')!.severity).toBe('warning');
  });

  it('JOIN-01: does not fire when all conductors have the same gauge', () => {
    const joinNode = makeJoinNode();
    const w1 = baseWire();
    w1.gaugeAwg = 16;
    w1.gaugeMm2 = null;
    w1.toEnd = { connectorId: joinNode.id, pinNumber: 1 };
    const w2 = baseWire();
    w2.gaugeAwg = 16;
    w2.gaugeMm2 = null;
    w2.toEnd = { connectorId: joinNode.id, pinNumber: 2 };
    const s = baseSchematic({ joinNodes: [joinNode], wires: [w1, w2] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'JOIN-01')).toBe(false);
  });

  // ── JOIN-02 ───────────────────────────────────────────────────────────────

  it('JOIN-02: error when join node has only 1 incoming conductor', () => {
    const joinNode = makeJoinNode();
    const w1 = baseWire();
    w1.toEnd = { connectorId: joinNode.id, pinNumber: 1 };
    const s = baseSchematic({ joinNodes: [joinNode], wires: [w1] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'JOIN-02')).toBe(true);
    expect(v.find((x) => x.code === 'JOIN-02')!.severity).toBe('error');
  });

  it('JOIN-02: does not fire when join node has 2+ incoming conductors', () => {
    const joinNode = makeJoinNode();
    const w1 = baseWire();
    w1.toEnd = { connectorId: joinNode.id, pinNumber: 1 };
    const w2 = baseWire();
    w2.toEnd = { connectorId: joinNode.id, pinNumber: 2 };
    const s = baseSchematic({ joinNodes: [joinNode], wires: [w1, w2] });
    const v = runSplitJoinDrc(s);
    expect(v.some((x) => x.code === 'JOIN-02')).toBe(false);
  });

  it('returns empty for schematic with no split/join nodes', () => {
    const s = baseSchematic();
    const v = runSplitJoinDrc(s);
    expect(v).toHaveLength(0);
  });
});

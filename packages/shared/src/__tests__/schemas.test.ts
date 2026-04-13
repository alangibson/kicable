import { describe, it, expect } from 'vitest';
import {
  ProjectMetaSchema,
  ComponentSchema,
  ProjectSchema,
  WireEndSchema,
  CableEndSchema,
  ShieldTreatmentSchema,
} from '../schemas.js';
import { WireSchema, CableSchema } from '../schematic.js';

const now = new Date().toISOString();

describe('ProjectMetaSchema', () => {
  it('parses a valid project meta', () => {
    const result = ProjectMetaSchema.safeParse({
      id: crypto.randomUUID(),
      name: 'Test Harness',
      description: 'desc',
      author: 'Engineer',
      schematicVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = ProjectMetaSchema.safeParse({
      id: crypto.randomUUID(),
      name: '',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });

  it('applies description default', () => {
    const result = ProjectMetaSchema.safeParse({
      id: crypto.randomUUID(),
      name: 'X',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe('');
  });
});

describe('ComponentSchema', () => {
  it('parses a minimal component', () => {
    const result = ComponentSchema.safeParse({
      id: crypto.randomUUID(),
      partNumber: 'DT04-2P',
      manufacturer: 'Deutsch',
      pinCount: 2,
      pins: [
        { number: 1, label: 'A', function: 'SIGNAL' },
        { number: 2, label: 'B', function: 'GND' },
      ],
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });

  it('rejects pinCount of 0', () => {
    const result = ComponentSchema.safeParse({
      id: crypto.randomUUID(),
      partNumber: 'BAD',
      pinCount: 0,
      pins: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(false);
  });
});

describe('ProjectSchema', () => {
  it('applies defaults', () => {
    const result = ProjectSchema.safeParse({
      meta: {
        id: crypto.randomUUID(),
        name: 'Harness',
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scaleMmPerPx).toBe(1);
      expect(result.data.preferredUnit).toBe('mm');
      expect(result.data.routingSlackPct).toBe(0);
      expect(result.data.components).toEqual([]);
    }
  });
});

describe('WireEndSchema', () => {
  it('parses with all defaults', () => {
    const result = WireEndSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stripLengthMm).toBe(0);
      expect(result.data.stripType).toBe('full');
      expect(result.data.tinningRequired).toBe(false);
      expect(result.data.stepLayers).toEqual([]);
    }
  });

  it('parses a full strip definition', () => {
    const result = WireEndSchema.safeParse({
      stripLengthMm: 15,
      stripType: 'step',
      insulationOdMm: 3.5,
      tinningRequired: true,
      tinningLengthMm: 5,
      terminalInsertionDepthMm: 8,
      stepLayers: [{ label: 'outer', stripLengthMm: 8 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stripLengthMm).toBe(15);
      expect(result.data.stepLayers).toHaveLength(1);
    }
  });
});

describe('CableEndSchema', () => {
  it('parses with all defaults', () => {
    const result = CableEndSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outerJacketStripLengthMm).toBe(0);
      expect(result.data.shieldTreatment).toBe('none');
      expect(result.data.drainWireLengthMm).toBeNull();
    }
  });

  it('parses all shield treatment values', () => {
    for (const val of ['fold_back', 'cut_flush', 'pigtail', 'drain_wire_only', 'none']) {
      const result = ShieldTreatmentSchema.safeParse(val);
      expect(result.success).toBe(true);
    }
  });
});

describe('WireSchema (dimension fields)', () => {
  const uuid = () => crypto.randomUUID();

  it('defaults to schematic mode with no length', () => {
    const result = WireSchema.safeParse({
      id: uuid(),
      fromEnd: { connectorId: uuid(), pinNumber: 1 },
      toEnd: { connectorId: uuid(), pinNumber: 2 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lengthMode).toBe('schematic');
      expect(result.data.overrideLengthMm).toBeNull();
      expect(result.data.formulaExpr).toBeNull();
      expect(result.data.routingSlackOptOut).toBe(false);
      expect(result.data.segments).toEqual([]);
      expect(result.data.endA.stripLengthMm).toBe(0);
      expect(result.data.endB.stripLengthMm).toBe(0);
    }
  });

  it('round-trips override mode with segments', () => {
    const result = WireSchema.safeParse({
      id: uuid(),
      fromEnd: { connectorId: uuid(), pinNumber: 1 },
      toEnd: { connectorId: uuid(), pinNumber: 2 },
      lengthMode: 'override',
      overrideLengthMm: 350,
      routingSlackOptOut: true,
      segments: [
        { name: 'Conduit', lengthMm: 200, note: 'in conduit' },
        { name: 'Free', lengthMm: 150, note: '' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overrideLengthMm).toBe(350);
      expect(result.data.routingSlackOptOut).toBe(true);
      expect(result.data.segments).toHaveLength(2);
    }
  });
});

describe('CableSchema (dimension fields)', () => {
  it('defaults endA/endB and overallLengthMm', () => {
    const result = CableSchema.safeParse({ id: crypto.randomUUID() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overallLengthMm).toBeNull();
      expect(result.data.endA.outerJacketStripLengthMm).toBe(0);
      expect(result.data.endB.shieldTreatment).toBe('none');
    }
  });
});

import { describe, it, expect } from 'vitest';
import { ProjectMetaSchema, ComponentSchema, ProjectSchema } from '../schemas.js';

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

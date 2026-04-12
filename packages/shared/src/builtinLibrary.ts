/**
 * Built-in component library — FR-CL-01
 *
 * Provides seed data for common connector families:
 *   - Deutsch DT Series (automotive)
 *   - TE AMP Superseal 1.5 Series (waterproof)
 *   - TE MCP 2.8 Series (Mini Connector Products)
 *
 * These are used to pre-populate a fresh library so new users have something
 * useful immediately. They carry version: 0 and are indistinguishable from
 * user-created components once stored.
 */

import type { Component } from './schemas.js';

const NOW = '2026-01-01T00:00:00.000Z';

function makeComponent(
  id: string,
  partNumber: string,
  manufacturer: string,
  pinCount: number,
  gender: 'male' | 'female' | 'neutral',
  description: string,
  pinLabels?: string[],
): Component {
  return {
    id,
    partNumber,
    manufacturer,
    pinCount,
    pins: Array.from({ length: pinCount }, (_, i) => ({
      number: i + 1,
      label: pinLabels?.[i] ?? String(i + 1),
      function: '',
    })),
    gender,
    description,
    version: 0,
    images: [],
    stepFile: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// ---------------------------------------------------------------------------
// Deutsch DT Series — automotive sealed connectors (2–12 pin)
// ---------------------------------------------------------------------------

export const DEUTSCH_DT: Component[] = [
  makeComponent(
    '00000000-0000-0000-0001-000000000001',
    'DT04-2P',
    'Deutsch / TE Connectivity',
    2,
    'female',
    'Deutsch DT Series 2-pin receptacle (female)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000002',
    'DT06-2S',
    'Deutsch / TE Connectivity',
    2,
    'male',
    'Deutsch DT Series 2-pin plug (male)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000003',
    'DT04-4P',
    'Deutsch / TE Connectivity',
    4,
    'female',
    'Deutsch DT Series 4-pin receptacle (female)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000004',
    'DT06-4S',
    'Deutsch / TE Connectivity',
    4,
    'male',
    'Deutsch DT Series 4-pin plug (male)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000005',
    'DT04-6P',
    'Deutsch / TE Connectivity',
    6,
    'female',
    'Deutsch DT Series 6-pin receptacle (female)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000006',
    'DT06-6S',
    'Deutsch / TE Connectivity',
    6,
    'male',
    'Deutsch DT Series 6-pin plug (male)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000007',
    'DT04-12PA',
    'Deutsch / TE Connectivity',
    12,
    'female',
    'Deutsch DT Series 12-pin receptacle (female)',
  ),
  makeComponent(
    '00000000-0000-0000-0001-000000000008',
    'DT06-12SA',
    'Deutsch / TE Connectivity',
    12,
    'male',
    'Deutsch DT Series 12-pin plug (male)',
  ),
];

// ---------------------------------------------------------------------------
// TE AMP Superseal 1.5 Series — waterproof, wire-to-wire (1–6 pin)
// ---------------------------------------------------------------------------

export const AMP_SUPERSEAL: Component[] = [
  makeComponent(
    '00000000-0000-0000-0002-000000000001',
    '282088-1',
    'TE Connectivity',
    1,
    'female',
    'AMP Superseal 1.5 1-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000002',
    '282189-1',
    'TE Connectivity',
    1,
    'male',
    'AMP Superseal 1.5 1-pin male housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000003',
    '282090-1',
    'TE Connectivity',
    2,
    'female',
    'AMP Superseal 1.5 2-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000004',
    '282191-1',
    'TE Connectivity',
    2,
    'male',
    'AMP Superseal 1.5 2-pin male housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000005',
    '282085-1',
    'TE Connectivity',
    4,
    'female',
    'AMP Superseal 1.5 4-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000006',
    '282193-1',
    'TE Connectivity',
    4,
    'male',
    'AMP Superseal 1.5 4-pin male housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000007',
    '282087-1',
    'TE Connectivity',
    6,
    'female',
    'AMP Superseal 1.5 6-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0002-000000000008',
    '282195-1',
    'TE Connectivity',
    6,
    'male',
    'AMP Superseal 1.5 6-pin male housing',
  ),
];

// ---------------------------------------------------------------------------
// TE MCP 2.8 Series — Mini Connector Products, compact automotive (2–6 pin)
// ---------------------------------------------------------------------------

export const TE_MCP: Component[] = [
  makeComponent(
    '00000000-0000-0000-0003-000000000001',
    '1-967622-1',
    'TE Connectivity',
    2,
    'female',
    'TE MCP 2.8 2-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0003-000000000002',
    '963230-1',
    'TE Connectivity',
    2,
    'male',
    'TE MCP 2.8 2-pin male header',
  ),
  makeComponent(
    '00000000-0000-0000-0003-000000000003',
    '1-967632-1',
    'TE Connectivity',
    4,
    'female',
    'TE MCP 2.8 4-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0003-000000000004',
    '963240-1',
    'TE Connectivity',
    4,
    'male',
    'TE MCP 2.8 4-pin male header',
  ),
  makeComponent(
    '00000000-0000-0000-0003-000000000005',
    '1-967644-1',
    'TE Connectivity',
    6,
    'female',
    'TE MCP 2.8 6-pin female housing',
  ),
  makeComponent(
    '00000000-0000-0000-0003-000000000006',
    '963250-1',
    'TE Connectivity',
    6,
    'male',
    'TE MCP 2.8 6-pin male header',
  ),
];

// ---------------------------------------------------------------------------
// All built-in components, grouped by family
// ---------------------------------------------------------------------------

export const BUILTIN_COMPONENTS: Component[] = [
  ...DEUTSCH_DT,
  ...AMP_SUPERSEAL,
  ...TE_MCP,
];

/** AWG gauge values commonly used in automotive wiring */
export const COMMON_AWG_GAUGES: number[] = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];

/** Common metric cross-sections (mm²) for automotive wiring */
export const COMMON_MM2_GAUGES: number[] = [0.35, 0.5, 0.75, 1.0, 1.5, 2.5, 4.0, 6.0, 10.0, 16.0];

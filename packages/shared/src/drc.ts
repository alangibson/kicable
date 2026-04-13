/**
 * Length DRC rules for wires and cables (§6.4.6, FR-WP-08).
 *
 * LEN-01  Warning : overall length is 0 or unset
 * LEN-02  Warning : segment sum ≠ overall length (tolerance ±0.5 mm)
 * LEN-03  Error   : strip length > overall length / 2
 * LEN-04  Warning : tinning length > strip length
 * LEN-05  Warning : terminal insertion depth > strip length
 * LEN-06  Warning : jacket strip length (cable) > overall length
 * LEN-07  Info    : override length differs from schematic-calculated by > 20%
 */

import type { Wire, Cable } from './schematic.js';

export type DrcSeverity = 'info' | 'warning' | 'error';

export interface DrcViolation {
  code: string;
  severity: DrcSeverity;
  message: string;
}

export interface WireDrcOptions {
  /** Effective overall length in mm (null if unknown/unset). */
  effectiveLengthMm: number | null;
  /** Schematic-computed pixel-path length in mm (needed for LEN-07). */
  schematicLengthMm?: number | null;
}

/** Run all length DRC checks for a single wire. */
export function runWireDrc(wire: Wire, opts: WireDrcOptions): DrcViolation[] {
  const violations: DrcViolation[] = [];
  const len = opts.effectiveLengthMm;

  // LEN-01 — length unset or zero
  if (len == null || len === 0) {
    violations.push({
      code: 'LEN-01',
      severity: 'warning',
      message: 'Overall length is 0 or unset.',
    });
    // Without a valid length the remaining rules cannot fire.
    return violations;
  }

  // LEN-02 — segment sum mismatch (±0.5 mm tolerance)
  if (wire.segments.length > 0) {
    const segSum = wire.segments.reduce((acc, s) => acc + s.lengthMm, 0);
    if (Math.abs(segSum - len) > 0.5) {
      violations.push({
        code: 'LEN-02',
        severity: 'warning',
        message: `Segment sum (${segSum.toFixed(1)} mm) does not match overall length (${len.toFixed(1)} mm).`,
      });
    }
  }

  // Per-end checks (LEN-03 / LEN-04 / LEN-05)
  for (const [end, endLabel] of [
    [wire.endA, 'End A'],
    [wire.endB, 'End B'],
  ] as const) {
    // LEN-03 — strip length > half of overall
    if (end.stripLengthMm > len / 2) {
      violations.push({
        code: 'LEN-03',
        severity: 'error',
        message: `${endLabel} strip length (${end.stripLengthMm} mm) exceeds half of overall length (${(len / 2).toFixed(1)} mm).`,
      });
    }

    // LEN-04 — tinning length > strip length
    if (
      end.tinningRequired &&
      end.tinningLengthMm != null &&
      end.tinningLengthMm > end.stripLengthMm
    ) {
      violations.push({
        code: 'LEN-04',
        severity: 'warning',
        message: `${endLabel} tinning length (${end.tinningLengthMm} mm) exceeds strip length (${end.stripLengthMm} mm).`,
      });
    }

    // LEN-05 — terminal insertion depth > strip length
    if (
      end.terminalInsertionDepthMm != null &&
      end.terminalInsertionDepthMm > end.stripLengthMm
    ) {
      violations.push({
        code: 'LEN-05',
        severity: 'warning',
        message: `${endLabel} terminal insertion depth (${end.terminalInsertionDepthMm} mm) exceeds strip length (${end.stripLengthMm} mm).`,
      });
    }
  }

  // LEN-07 — override differs from schematic-calculated by > 20%
  if (
    wire.lengthMode === 'override' &&
    wire.overrideLengthMm != null &&
    opts.schematicLengthMm != null &&
    opts.schematicLengthMm > 0
  ) {
    const pct =
      Math.abs(wire.overrideLengthMm - opts.schematicLengthMm) /
      opts.schematicLengthMm;
    if (pct > 0.2) {
      violations.push({
        code: 'LEN-07',
        severity: 'info',
        message: `Override length (${wire.overrideLengthMm} mm) differs from schematic-calculated (${opts.schematicLengthMm.toFixed(1)} mm) by ${(pct * 100).toFixed(0)}%.`,
      });
    }
  }

  return violations;
}

/** Run cable-level length DRC checks (LEN-06). */
export function runCableDrc(
  cable: Cable,
  effectiveLengthMm: number | null,
): DrcViolation[] {
  const violations: DrcViolation[] = [];
  if (effectiveLengthMm == null || effectiveLengthMm === 0) return violations;

  for (const [end, endLabel] of [
    [cable.endA, 'End A'],
    [cable.endB, 'End B'],
  ] as const) {
    if (end.outerJacketStripLengthMm > effectiveLengthMm) {
      violations.push({
        code: 'LEN-06',
        severity: 'warning',
        message: `${endLabel} jacket strip length (${end.outerJacketStripLengthMm} mm) exceeds overall cable length (${effectiveLengthMm} mm).`,
      });
    }
  }

  return violations;
}

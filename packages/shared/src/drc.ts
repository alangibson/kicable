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

import type { Wire, Cable, Schematic } from './schematic.js';

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

/**
 * Run split/join node DRC checks (§6.6.4).
 *
 * JOIN-01  Warning : conductors in cable have mixed gauges
 * JOIN-02  Error   : join node has fewer than 2 incoming conductors
 * SPLIT-01 Warning : fan-out wire has no further connection
 * SPLIT-02 Info    : fan-out length is 0 mm
 * SPLIT-03 Error   : split node references cable not in schematic, or incoming wires don't belong to that cable
 */
export function runSplitJoinDrc(schematic: Schematic): DrcViolation[] {
  const violations: DrcViolation[] = [];
  const { wires, splitNodes, joinNodes, connectors, cables } = schematic;

  // Build set of all canvas node IDs for connectivity checks
  const allNodeIds = new Set<string>([
    ...connectors.map((c) => c.id),
    ...schematic.spliceNodes.map((s) => s.id),
    ...splitNodes.map((s) => s.id),
    ...joinNodes.map((j) => j.id),
  ]);

  for (const sn of splitNodes) {
    const nodeLabel = sn.label || sn.id.slice(0, 8);

    // Fan-out wires: fromEnd points to this split node
    const fanOutWires = wires.filter((w) => w.fromEnd.connectorId === sn.id);

    // SPLIT-01: fan-out wire has no further connection
    for (const fw of fanOutWires) {
      if (!allNodeIds.has(fw.toEnd.connectorId)) {
        violations.push({
          code: 'SPLIT-01',
          severity: 'warning',
          message: `Fan-out wire "${fw.label || fw.id.slice(0, 8)}" from split node "${nodeLabel}" has no further connection.`,
        });
      }
    }

    // SPLIT-02: fan-out length is 0 mm
    if (sn.fanOutLengthMm === 0) {
      violations.push({
        code: 'SPLIT-02',
        severity: 'info',
        message: `Split node "${nodeLabel}" fan-out length is 0 mm.`,
      });
    }

    // SPLIT-03: split node references unknown cable or incoming wires don't match
    if (sn.cableId) {
      const cable = cables.find((c) => c.id === sn.cableId);
      if (!cable) {
        violations.push({
          code: 'SPLIT-03',
          severity: 'error',
          message: `Split node "${nodeLabel}" references unknown cable ${sn.cableId.slice(0, 8)}.`,
        });
      } else {
        const incomingWires = wires.filter((w) => w.toEnd.connectorId === sn.id);
        const mismatched = incomingWires.filter((w) => w.cableId !== sn.cableId);
        if (mismatched.length > 0) {
          violations.push({
            code: 'SPLIT-03',
            severity: 'error',
            message: `Split node "${nodeLabel}" has ${mismatched.length} incoming conductor(s) not belonging to cable "${cable.label || cable.id.slice(0, 8)}".`,
          });
        }
      }
    }
  }

  for (const jn of joinNodes) {
    const nodeLabel = jn.label || jn.id.slice(0, 8);
    const incomingWires = wires.filter((w) => w.toEnd.connectorId === jn.id);

    // JOIN-01: mixed gauges among incoming conductors
    const gaugesAwg = new Set(incomingWires.filter((w) => w.gaugeAwg != null).map((w) => w.gaugeAwg));
    const gaugesMm2 = new Set(incomingWires.filter((w) => w.gaugeMm2 != null).map((w) => w.gaugeMm2));
    if (gaugesAwg.size > 1 || gaugesMm2.size > 1 || (gaugesAwg.size > 0 && gaugesMm2.size > 0)) {
      violations.push({
        code: 'JOIN-01',
        severity: 'warning',
        message: `Join node "${nodeLabel}" has conductors with mixed gauges.`,
      });
    }

    // JOIN-02: fewer than 2 incoming conductors
    if (incomingWires.length < 2) {
      violations.push({
        code: 'JOIN-02',
        severity: 'error',
        message: `Join node "${nodeLabel}" has ${incomingWires.length} incoming conductor(s); at least 2 required.`,
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

/**
 * CableJacketEdge — opaque cable jacket rendered on TOP of conductor edges.
 *
 * Visual model (FR-WG-05 WYSIWYG):
 *
 *   J1 (side A)                          J2 (side B)
 *   pin1 ──┐                              ┌── pin1
 *   pin2 ──┤══════════ jacket ════════════├── pin2
 *   pin3 ──┘                              └── pin3
 *         ↑ fan-out stub                 ↑ fan-out stub
 *         (conductor edge peeking out)
 *
 * The jacket path is INSET from each end by FAN_OUT_PX so the individual
 * coloured conductor stubs remain visible at each connector.
 *
 * Jacket edges must come AFTER wire edges in the RF edges array so they
 * render on top (React Flow renders later entries above earlier ones).
 */

import { memo } from 'react';
import { EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

/** Distance from each connector at which the jacket starts/ends (px). */
const FAN_OUT_PX = 32;
/** Pixels between conductor centre-lines (used to scale jacket width). */
const CONDUCTOR_SPACING_PX = 6;
/** Padding on each side of the conductor spread. */
const JACKET_PADDING_PX = 6;
/** Minimum jacket stroke width. */
const MIN_JACKET_WIDTH_PX = 12;

export interface CableJacketEdgeData {
  conductorCount: number;
  /** Jacket colour hex */
  jacketColorHex: string;
  cableLabel: string;
  /** Strip-back length in mm at End A — annotated at the jacket mouth */
  endAStripMm: number;
  /** Strip-back length in mm at End B — annotated at the jacket mouth */
  endBStripMm: number;
}

const CableJacketEdge = memo(function CableJacketEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const d = data as CableJacketEdgeData | undefined;
  const conductorCount = d?.conductorCount ?? 1;
  const jacketColor = d?.jacketColorHex ?? '#475569';
  const cableLabel = d?.cableLabel ?? '';
  const endAStripMm = d?.endAStripMm ?? 0;
  const endBStripMm = d?.endBStripMm ?? 0;

  const strokeWidth = Math.max(
    MIN_JACKET_WIDTH_PX,
    conductorCount * CONDUCTOR_SPACING_PX + JACKET_PADDING_PX * 2,
  );

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Need at least 2× FAN_OUT_PX to draw a meaningful jacket body.
  if (dist < FAN_OUT_PX * 2) return null;

  const ux = dx / dist;
  const uy = dy / dist;

  // Inset start and end of the jacket body
  const jSrcX = sourceX + FAN_OUT_PX * ux;
  const jSrcY = sourceY + FAN_OUT_PX * uy;
  const jTgtX = targetX - FAN_OUT_PX * ux;
  const jTgtY = targetY - FAN_OUT_PX * uy;

  const jacketPath = `M ${jSrcX} ${jSrcY} L ${jTgtX} ${jTgtY}`;

  // Label positions
  const midX = (jSrcX + jTgtX) / 2;
  const midY = (jSrcY + jTgtY) / 2;
  // Annotation offset perpendicular to the cable axis (above the jacket)
  const perpX = -uy * (strokeWidth / 2 + 4);
  const perpY = ux * (strokeWidth / 2 + 4);

  return (
    <>
      {/* Opaque jacket body */}
      <path
        d={jacketPath}
        stroke={jacketColor}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        fill="none"
        opacity={1}
        style={selected ? { filter: `drop-shadow(0 0 4px ${jacketColor})` } : undefined}
      />
      {/* Thin highlight line along the top */}
      <path
        d={jacketPath}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={2}
        strokeLinecap="butt"
        fill="none"
      />
      {/* Selection ring */}
      {selected && (
        <path
          d={jacketPath}
          stroke={jacketColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="butt"
          fill="none"
          opacity={0.3}
        />
      )}

      <EdgeLabelRenderer>
        {/* Cable label centred on the jacket body */}
        {cableLabel && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX + perpX}px,${midY + perpY}px)`,
              background: jacketColor,
              color: '#fff',
              borderRadius: 3,
              padding: '1px 5px',
              fontSize: 9,
              fontFamily: 'sans-serif',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontWeight: 700,
            }}
          >
            {cableLabel}
          </div>
        )}

        {/* End A strip-back annotation — at the jacket mouth (side A) */}
        {endAStripMm > 0 && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${jSrcX + perpX}px,${jSrcY + perpY}px)`,
              background: '#fff',
              border: `1px solid ${jacketColor}`,
              borderRadius: 3,
              padding: '1px 4px',
              fontSize: 8,
              fontFamily: 'sans-serif',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              color: '#334155',
            }}
          >
            A: {endAStripMm}mm
          </div>
        )}

        {/* End B strip-back annotation — at the jacket mouth (side B) */}
        {endBStripMm > 0 && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${jTgtX + perpX}px,${jTgtY + perpY}px)`,
              background: '#fff',
              border: `1px solid ${jacketColor}`,
              borderRadius: 3,
              padding: '1px 4px',
              fontSize: 8,
              fontFamily: 'sans-serif',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              color: '#334155',
            }}
          >
            B: {endBStripMm}mm
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

export default CableJacketEdge;

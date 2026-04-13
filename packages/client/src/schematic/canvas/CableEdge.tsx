/**
 * CableEdge — React Flow custom edge for multi-conductor cables (FR-WG-05).
 *
 * Renders a cable as a thick edge with:
 *  - A dark outer sheath line
 *  - A label showing the cable name
 *  - Small colored stripes for each inner conductor
 */

import { memo } from 'react';
import {
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';

export interface CableEdgeData {
  label: string;
  /** Colors of inner conductors (each wire's colorHex) */
  conductorColors: string[];
  /** Intermediate waypoints */
  waypoints: Array<{ x: number; y: number }>;
}

function buildPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  waypoints: Array<{ x: number; y: number }>,
): string {
  if (waypoints.length === 0) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }
  const pts = [{ x: sx, y: sy }, ...waypoints, { x: tx, y: ty }];
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

const CableEdge = memo(function CableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  style,
}: EdgeProps) {
  const edgeData = (data as CableEdgeData | undefined) ?? {
    label: '',
    conductorColors: [],
    waypoints: [],
  };

  const waypoints = edgeData.waypoints ?? [];
  const conductorColors = edgeData.conductorColors ?? [];

  let edgePath: string;
  if (waypoints.length === 0) {
    [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  } else {
    edgePath = buildPath(sourceX, sourceY, targetX, targetY, waypoints);
  }

  const midX =
    waypoints.length > 0
      ? waypoints[Math.floor(waypoints.length / 2)]!.x
      : (sourceX + targetX) / 2;
  const midY =
    waypoints.length > 0
      ? waypoints[Math.floor(waypoints.length / 2)]!.y
      : (sourceY + targetY) / 2;

  const sheathColor = selected ? '#6366f1' : '#334155';
  const sheathWidth = selected ? 10 : 8;

  // Spread up to 5 conductor stripes across the cable mid-point label area
  const shownColors = conductorColors.slice(0, 8);

  void id;
  void style;

  return (
    <>
      {/* Sheath — wide dark line */}
      <path
        d={edgePath}
        stroke={sheathColor}
        strokeWidth={sheathWidth}
        fill="none"
        style={{ cursor: 'pointer', strokeDasharray: selected ? '10 4' : undefined }}
      />
      {/* Inner highlight */}
      <path
        d={edgePath}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={sheathWidth - 4}
        fill="none"
        style={{ pointerEvents: 'none' }}
      />

      {/* Waypoint handles */}
      {waypoints.map((wp, i) => (
        <circle
          key={i}
          cx={wp.x}
          cy={wp.y}
          r={6}
          fill={selected ? '#6366f1' : '#334155'}
          stroke="#fff"
          strokeWidth={2}
          style={{ cursor: 'move' }}
        />
      ))}

      {/* Label + conductor color swatches */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            background: '#1e293b',
            border: '1.5px solid #475569',
            borderRadius: 5,
            padding: '2px 7px',
            fontSize: 10,
            fontFamily: 'sans-serif',
            color: '#f1f5f9',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {edgeData.label || 'Cable'}
          {shownColors.length > 0 && (
            <span style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
              {shownColors.map((hex, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: 1,
                    background: hex,
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                />
              ))}
              {conductorColors.length > 8 && (
                <span style={{ fontSize: 9, color: '#94a3b8' }}>
                  +{conductorColors.length - 8}
                </span>
              )}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export default CableEdge;

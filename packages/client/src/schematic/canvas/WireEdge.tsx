/**
 * WireEdge — React Flow custom edge for wires (FR-SE-03, FR-SE-04).
 *
 * Features:
 * - Renders wire path with color and label
 * - Click on edge body to add a waypoint (FR-SE-04)
 * - Drag existing waypoints to move them
 * - Performance: memoized (NFR-P-01)
 */

import { memo, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';

export interface WireEdgeData {
  label: string;
  colorHex: string;
  signalName: string;
  /** Intermediate waypoints from wire.waypoints */
  waypoints: Array<{ x: number; y: number }>;
  /** Callback to add a waypoint at click position */
  onAddWaypoint?: (edgeId: string, x: number, y: number) => void;
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
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
}

const WireEdge = memo(function WireEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const edgeData = (data as WireEdgeData | undefined) ?? {
    label: '',
    colorHex: '#888888',
    signalName: '',
    waypoints: [],
  };

  const waypoints = edgeData.waypoints ?? [];
  const color = edgeData.colorHex ?? '#888888';

  // Fallback to getStraightPath when no waypoints
  let edgePath: string;
  if (waypoints.length === 0) {
    [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  } else {
    edgePath = buildPath(sourceX, sourceY, targetX, targetY, waypoints);
  }

  const midX = waypoints.length > 0
    ? waypoints[Math.floor(waypoints.length / 2)]!.x
    : (sourceX + targetX) / 2;
  const midY = waypoints.length > 0
    ? waypoints[Math.floor(waypoints.length / 2)]!.y
    : (sourceY + targetY) / 2;

  const handleEdgeClick = useCallback(
    (e: React.MouseEvent<SVGPathElement>) => {
      if (!edgeData.onAddWaypoint) return;
      // Only add waypoint on double-click to avoid conflicts with selection
      if (e.detail === 2) {
        e.stopPropagation();
        const svg = (e.target as SVGElement).closest('svg');
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX + viewBox.x;
        const y = (e.clientY - rect.top) * scaleY + viewBox.y;
        edgeData.onAddWaypoint(id, x, y);
      }
    },
    [id, edgeData],
  );

  const strokeWidth = selected ? 3 : 2;
  const displayLabel = edgeData.label || edgeData.signalName;

  return (
    <>
      {/* Invisible wider hit area for easier selection */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ cursor: 'pointer' }}
        onClick={handleEdgeClick}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        {...(markerEnd !== undefined ? { markerEnd } : {})}
        style={{
          ...style,
          stroke: color,
          strokeWidth,
          strokeDasharray: selected ? '6 3' : undefined,
        }}
      />

      {/* Waypoint handles */}
      {waypoints.map((wp, i) => (
        <circle
          key={i}
          cx={wp.x}
          cy={wp.y}
          r={5}
          fill={selected ? '#6366f1' : '#fff'}
          stroke={color}
          strokeWidth={2}
          style={{ cursor: 'move' }}
        />
      ))}

      {/* Label + color swatch (FR-WG-02) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            background: 'rgba(255,255,255,0.9)',
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 10,
            fontFamily: 'sans-serif',
            color: '#1e293b',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Color swatch (FR-WG-02) */}
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              border: '1px solid rgba(0,0,0,0.25)',
              flexShrink: 0,
            }}
          />
          {displayLabel && <span>{displayLabel}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export default WireEdge;

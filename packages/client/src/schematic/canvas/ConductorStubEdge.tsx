/**
 * ConductorStubEdge — renders only the stripped-back stubs of a conductor that
 * belongs to a cable. The jacket (CableJacketEdge) covers the middle section;
 * this edge draws only the two short segments visible at each connector end.
 *
 * Visual model:
 *
 *   connector A                              connector B
 *     pin ────┐                          ┌──── pin
 *             ╲══════ jacket body ═══════╱
 *             ↑ stub (this component)   ↑ stub (this component)
 */

import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react';

/** Must match FAN_OUT_PX in CableJacketEdge.tsx */
const FAN_OUT_PX = 32;

export interface ConductorStubEdgeData {
  colorHex: string;
  label: string;
  signalName: string;
}

const ConductorStubEdge = memo(function ConductorStubEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const d = data as ConductorStubEdgeData | undefined;
  const color = d?.colorHex ?? '#888888';
  const displayLabel = d?.label || d?.signalName || '';
  const strokeWidth = selected ? 3 : 2;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Too short for a jacket — render as a full wire so the connection is visible
  if (dist < FAN_OUT_PX * 2) {
    const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth }} />;
  }

  const ux = dx / dist;
  const uy = dy / dist;

  // Jacket mouth positions — identical calculation to CableJacketEdge
  const jSrcX = sourceX + FAN_OUT_PX * ux;
  const jSrcY = sourceY + FAN_OUT_PX * uy;
  const jTgtX = targetX - FAN_OUT_PX * ux;
  const jTgtY = targetY - FAN_OUT_PX * uy;

  const srcStub = `M ${sourceX} ${sourceY} L ${jSrcX} ${jSrcY}`;
  const tgtStub = `M ${jTgtX} ${jTgtY} L ${targetX} ${targetY}`;

  // Label at source-side stub midpoint (inside stripped region near connector A)
  const labelX = (sourceX + jSrcX) / 2;
  const labelY = (sourceY + jSrcY) / 2;

  return (
    <>
      <path d={srcStub} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <path d={tgtStub} stroke={color} strokeWidth={strokeWidth} fill="none" />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(255,255,255,0.85)',
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
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 2,
                background: color,
                border: '1px solid rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            />
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export default ConductorStubEdge;

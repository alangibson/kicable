/**
 * JoinNodeComponent — React Flow custom node for a cable join point (FR-CJ-01 – FR-CJ-06).
 *
 * Visual model:
 *   wire 1 ──┐
 *   wire 2 ──┤ [JN] ──── cable out
 *   wire N ──┘
 *
 * Left handles (pin-{N}-left):  incoming fan-in wires
 * Right handles (pin-{N}-right): outgoing cable conductors
 * Performance: memoized (NFR-P-01).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface JoinNodeData {
  label: string;
  conductorCount: number;
  fanInLengthMm: number;
}

const PIN_SPACING = 16;
const NODE_WIDTH = 64;
const HEADER_H = 22;

const JoinNodeComponent = memo(function JoinNodeComponent({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as JoinNodeData;
  const count = Math.max(1, nodeData.conductorCount);
  const bodyH = count * PIN_SPACING;
  const totalH = HEADER_H + bodyH + 8;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: totalH,
        background: selected ? '#f0fdf4' : '#f0fdf4',
        border: `2px solid ${selected ? '#15803d' : '#166534'}`,
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 3px rgba(21,128,61,0.25)' : '0 1px 4px rgba(0,0,0,0.12)',
        fontFamily: 'sans-serif',
        fontSize: 9,
        userSelect: 'none',
        position: 'relative',
      }}
      title={`Join node — ${count} conductors`}
    >
      {/* Header */}
      <div
        style={{
          background: selected ? '#15803d' : '#166534',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '4px 4px 0 0',
          fontWeight: 700,
          textAlign: 'center',
          fontSize: 9,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {nodeData.label || 'JN'}
      </div>

      {/* Fan-in length annotation */}
      {nodeData.fanInLengthMm > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 8,
            color: '#166534',
            padding: '1px 4px',
          }}
        >
          {nodeData.fanInLengthMm}mm
        </div>
      )}

      {/* Per-conductor handles */}
      {Array.from({ length: count }, (_, i) => {
        const pinNumber = i + 1;
        const topOffset = HEADER_H + i * PIN_SPACING + PIN_SPACING / 2;
        return (
          <div key={pinNumber} style={{ position: 'relative', height: PIN_SPACING }}>
            {/* Left: incoming fan-in wire */}
            <Handle
              type="target"
              position={Position.Left}
              id={`pin-${pinNumber}-left`}
              style={{
                left: -6,
                top: topOffset,
                width: 9,
                height: 9,
                background: '#166534',
                border: '2px solid #fff',
              }}
            />
            {/* Right: outgoing cable conductor */}
            <Handle
              type="source"
              position={Position.Right}
              id={`pin-${pinNumber}-right`}
              style={{
                right: -6,
                top: topOffset,
                width: 9,
                height: 9,
                background: '#15803d',
                border: '2px solid #fff',
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

export default JoinNodeComponent;

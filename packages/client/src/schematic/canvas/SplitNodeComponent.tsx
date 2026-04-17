/**
 * SplitNodeComponent — React Flow custom node for a cable split point (FR-CS-01 – FR-CS-06).
 *
 * Visual model:
 *   ──●── [SP] ──┬── fan-out 1
 *                ├── fan-out 2
 *                └── fan-out N
 *
 * Left handles (pin-{N}-left):  incoming cable conductors
 * Right handles (pin-{N}-right): outgoing fan-out wires
 * Performance: memoized (NFR-P-01).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface SplitNodeData {
  label: string;
  conductorCount: number;
  fanOutLengthMm: number;
}

const PIN_SPACING = 16;
const NODE_WIDTH = 64;
const HEADER_H = 22;

const SplitNodeComponent = memo(function SplitNodeComponent({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as SplitNodeData;
  const count = Math.max(1, nodeData.conductorCount);
  const bodyH = count * PIN_SPACING;
  const totalH = HEADER_H + bodyH + 8;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: totalH,
        background: selected ? '#fef9c3' : '#fffbeb',
        border: `2px solid ${selected ? '#d97706' : '#92400e'}`,
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 3px rgba(217,119,6,0.25)' : '0 1px 4px rgba(0,0,0,0.12)',
        fontFamily: 'sans-serif',
        fontSize: 9,
        userSelect: 'none',
        position: 'relative',
      }}
      title={`Split node — ${count} conductors`}
    >
      {/* Header */}
      <div
        style={{
          background: selected ? '#d97706' : '#92400e',
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
        {nodeData.label || 'SP'}
      </div>

      {/* Fan-out length annotation */}
      {nodeData.fanOutLengthMm > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 8,
            color: '#92400e',
            padding: '1px 4px',
          }}
        >
          {nodeData.fanOutLengthMm}mm
        </div>
      )}

      {/* Per-conductor handles */}
      {Array.from({ length: count }, (_, i) => {
        const pinNumber = i + 1;
        const topOffset = HEADER_H + i * PIN_SPACING + PIN_SPACING / 2;
        return (
          <div key={pinNumber} style={{ position: 'relative', height: PIN_SPACING }}>
            {/* Left: incoming from cable */}
            <Handle
              type="target"
              position={Position.Left}
              id={`pin-${pinNumber}-left`}
              style={{
                left: -6,
                top: topOffset,
                width: 9,
                height: 9,
                background: '#92400e',
                border: '2px solid #fff',
              }}
            />
            {/* Right: fan-out to downstream */}
            <Handle
              type="source"
              position={Position.Right}
              id={`pin-${pinNumber}-right`}
              style={{
                right: -6,
                top: topOffset,
                width: 9,
                height: 9,
                background: '#d97706',
                border: '2px solid #fff',
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

export default SplitNodeComponent;

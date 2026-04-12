/**
 * ConnectorNode — React Flow custom node for a ConnectorInstance (FR-SE-02).
 *
 * Renders a box with one Handle per pin. Handles are used as wire endpoints (FR-SE-03).
 * Performance: memoized so it only re-renders when its data changes (NFR-P-01).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConnectorPin } from '@kicable/shared';

export interface ConnectorNodeData {
  label: string;
  pinCount: number;
  pins: ConnectorPin[];
  selected?: boolean;
}

export type ConnectorNodeType = {
  id: string;
  type: 'connector';
  position: { x: number; y: number };
  data: ConnectorNodeData;
};

const PIN_HEIGHT = 24;
const NODE_WIDTH = 120;
const HEADER_HEIGHT = 28;

const ConnectorNode = memo(function ConnectorNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as ConnectorNodeData;
  const pins = nodeData.pins ?? [];
  const nodeHeight = HEADER_HEIGHT + Math.max(1, pins.length) * PIN_HEIGHT + 8;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: nodeHeight,
        background: '#fff',
        border: `2px solid ${selected ? '#6366f1' : '#334155'}`,
        borderRadius: 6,
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.25)' : '0 1px 4px rgba(0,0,0,0.12)',
        fontFamily: 'sans-serif',
        fontSize: 11,
        userSelect: 'none',
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: selected ? '#6366f1' : '#1e293b',
          color: '#f1f5f9',
          padding: '4px 8px',
          borderRadius: '4px 4px 0 0',
          fontWeight: 700,
          fontSize: 11,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {nodeData.label || 'J?'}
      </div>

      {/* Pins */}
      <div style={{ position: 'relative', padding: '4px 0' }}>
        {pins.map((pin, i) => (
          <div
            key={pin.number}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: PIN_HEIGHT,
              paddingLeft: 8,
              paddingRight: 8,
              gap: 4,
              position: 'relative',
            }}
          >
            {/* Left handle (source side) */}
            <Handle
              type="source"
              position={Position.Left}
              id={`pin-${pin.number}-left`}
              style={{
                left: -6,
                top: i * PIN_HEIGHT + HEADER_HEIGHT + PIN_HEIGHT / 2,
                width: 10,
                height: 10,
                background: '#6366f1',
                border: '2px solid #fff',
              }}
            />

            <span style={{ color: '#64748b', minWidth: 16, textAlign: 'right' }}>
              {pin.number}
            </span>
            <span
              style={{
                color: '#1e293b',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pin.label || pin.function || '—'}
            </span>

            {/* Right handle (target side) */}
            <Handle
              type="target"
              position={Position.Right}
              id={`pin-${pin.number}-right`}
              style={{
                right: -6,
                top: i * PIN_HEIGHT + HEADER_HEIGHT + PIN_HEIGHT / 2,
                width: 10,
                height: 10,
                background: '#0ea5e9',
                border: '2px solid #fff',
              }}
            />
          </div>
        ))}
        {pins.length === 0 && (
          <div style={{ padding: '4px 8px', color: '#94a3b8', fontStyle: 'italic' }}>
            No pins
          </div>
        )}
      </div>
    </div>
  );
});

export default ConnectorNode;

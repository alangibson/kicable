/**
 * SpliceNodeComponent — React Flow custom node for 3-way and 4-way junctions (FR-SE-05).
 *
 * A splice node has handles on all sides. Wires can connect from any direction.
 * Performance: memoized (NFR-P-01).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface SpliceNodeData {
  label: string;
  type: '3way' | '4way';
}

const SIZE = 36;

const SpliceNodeComponent = memo(function SpliceNodeComponent({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as SpliceNodeData;
  const is4way = nodeData.type === '4way';

  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background: selected ? '#6366f1' : '#f1f5f9',
        border: `2px solid ${selected ? '#4f46e5' : '#334155'}`,
        boxShadow: selected ? '0 0 0 3px rgba(99,102,241,0.25)' : '0 1px 4px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        fontSize: 9,
        fontWeight: 700,
        color: selected ? '#fff' : '#334155',
        userSelect: 'none',
        position: 'relative',
      }}
      title={is4way ? '4-way junction' : '3-way junction'}
    >
      {/* Left */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ left: -6, width: 10, height: 10, background: '#6366f1', border: '2px solid #fff' }}
      />
      {/* Right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ right: -6, width: 10, height: 10, background: '#6366f1', border: '2px solid #fff' }}
      />
      {/* Top (always present — used for 3-way and 4-way) */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={{ top: -6, width: 10, height: 10, background: '#6366f1', border: '2px solid #fff' }}
      />
      {/* Bottom — only on 4-way */}
      {is4way && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ bottom: -6, width: 10, height: 10, background: '#6366f1', border: '2px solid #fff' }}
        />
      )}
      {is4way ? '✕' : 'T'}
    </div>
  );
});

export default SpliceNodeComponent;

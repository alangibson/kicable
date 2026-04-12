/**
 * SchematicCanvas — React Flow canvas for the schematic editor.
 *
 * FR-SE-01: Infinite, pannable, zoomable canvas
 * FR-SE-02: Drop connectors from library panel onto canvas
 * FR-SE-03: Draw wires by dragging between pin handles
 * FR-SE-04: Add waypoints by double-clicking a wire segment
 * FR-SE-05: Insert splice nodes via toolbar
 * FR-SE-06: Select node/wire → fires onSelectionChange
 * FR-SE-07: Multi-select via rubber-band drag + group move
 * FR-SE-08: Undo/redo (managed by parent useEditorState)
 * FR-SE-10: Keyboard shortcuts (delete, undo, redo, zoom in/out)
 * NFR-P-01: React Flow virtualises off-screen nodes
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
  type FC,
} from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  SelectionMode,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Component, ConnectorInstance, Schematic, SpliceNode, Wire } from '@kicable/shared';
import { makeId } from '@kicable/shared';
import ConnectorNode, { type ConnectorNodeData } from './ConnectorNode.js';
import SpliceNodeComponent, { type SpliceNodeData } from './SpliceNodeComponent.js';
import WireEdge, { type WireEdgeData } from './WireEdge.js';
import type { UseEditorStateReturn } from '../useEditorState.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CanvasSelection =
  | { kind: 'connector'; id: string }
  | { kind: 'splice'; id: string }
  | { kind: 'wire'; id: string }
  | null;

interface Props {
  schematic: Schematic;
  /** All components available for rendering nodes (global library) */
  components: Component[];
  editor: UseEditorStateReturn;
  onSelectionChange: (sel: CanvasSelection) => void;
  /** Called when a component is dropped that isn't yet in project.components */
  onAddComponentToProject: (comp: Component) => void;
}

// ---------------------------------------------------------------------------
// Static nodeTypes / edgeTypes — defined outside component to avoid recreation
// ---------------------------------------------------------------------------

const nodeTypes = {
  connector: ConnectorNode,
  splice: SpliceNodeComponent,
};

const edgeTypes = {
  wire: WireEdge,
};

// ---------------------------------------------------------------------------
// Helpers: schematic ↔ React Flow conversion
// ---------------------------------------------------------------------------

function schematicToRFNodes(
  schematic: Schematic,
  components: Component[],
): Node[] {
  const compMap = new Map(components.map((c) => [c.id, c]));

  const connectorNodes: Node[] = schematic.connectors.map((c) => {
    const comp = compMap.get(c.componentId);
    return {
      id: c.id,
      type: 'connector',
      position: { x: c.x, y: c.y },
      data: {
        label: c.label,
        pinCount: comp?.pinCount ?? 0,
        pins: comp?.pins ?? [],
      } satisfies ConnectorNodeData,
    };
  });

  const spliceNodes: Node[] = schematic.spliceNodes.map((s) => ({
    id: s.id,
    type: 'splice',
    position: { x: s.x, y: s.y },
    data: {
      label: s.label,
      type: s.type,
    } satisfies SpliceNodeData,
  }));

  return [...connectorNodes, ...spliceNodes];
}

function schematicToRFEdges(
  schematic: Schematic,
  onAddWaypoint: (edgeId: string, x: number, y: number) => void,
): Edge[] {
  return schematic.wires.map((w) => ({
    id: w.id,
    type: 'wire',
    source: w.fromEnd.connectorId,
    sourceHandle: `pin-${w.fromEnd.pinNumber}-left`,
    target: w.toEnd.connectorId,
    targetHandle: `pin-${w.toEnd.pinNumber}-right`,
    data: {
      label: w.label,
      colorHex: w.colorHex,
      signalName: w.signalName,
      waypoints: w.waypoints,
      onAddWaypoint,
    } satisfies WireEdgeData,
  }));
}

// ---------------------------------------------------------------------------
// SchematicCanvas
// ---------------------------------------------------------------------------

const SchematicCanvas: FC<Props> = ({
  schematic,
  components,
  editor,
  onSelectionChange,
  onAddComponentToProject,
}) => {
  const {
    upsertConnector,
    removeConnector,
    upsertWire,
    removeWire,
    upsertSplice,
    removeSplice,
    undo,
    redo,
    canUndo,
    canRedo,
    setSchematic,
  } = editor;

  // ── Waypoint add callback (stable ref so it doesn't rebuild edges constantly) ──
  const addWaypointRef = useRef<(edgeId: string, x: number, y: number) => void>(
    () => undefined,
  );

  // ── Derive RF state from schematic ──
  const initialNodes = useMemo(
    () => schematicToRFNodes(schematic, components),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialEdges = useMemo(
    () => schematicToRFEdges(schematic, (id, x, y) => addWaypointRef.current(id, x, y)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ── Sync schematic → RF when schematic changes from outside (undo/redo) ──
  const lastSchematicRef = useRef(schematic);
  useEffect(() => {
    if (schematic === lastSchematicRef.current) return;
    lastSchematicRef.current = schematic;
    setNodes(schematicToRFNodes(schematic, components));
    setEdges(schematicToRFEdges(schematic, (id, x, y) => addWaypointRef.current(id, x, y)));
  }, [schematic, components, setNodes, setEdges]);

  // ── Waypoint add implementation ──
  const handleAddWaypoint = useCallback(
    (edgeId: string, wx: number, wy: number) => {
      const wire = schematic.wires.find((w) => w.id === edgeId);
      if (!wire) return;
      const updated: Wire = {
        ...wire,
        waypoints: [...wire.waypoints, { x: wx, y: wy }],
      };
      upsertWire(updated);
    },
    [schematic.wires, upsertWire],
  );
  addWaypointRef.current = handleAddWaypoint;

  // ── Node position changes ──
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Persist position changes to schematic
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { id, position } = change;
          const connector = schematic.connectors.find((c) => c.id === id);
          if (connector) {
            upsertConnector({ ...connector, x: position.x, y: position.y });
            continue;
          }
          const splice = schematic.spliceNodes.find((s) => s.id === id);
          if (splice) {
            upsertSplice({ ...splice, x: position.x, y: position.y });
          }
        }
      }
    },
    [setNodes, schematic, upsertConnector, upsertSplice],
  );

  // ── Edge changes ──
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges],
  );

  // ── New connection (draw wire between pins) — FR-SE-03 ──
  const handleConnect = useCallback(
    (params: Connection) => {
      const { source, sourceHandle, target, targetHandle } = params;
      if (!source || !target || !sourceHandle || !targetHandle) return;

      // Parse pin numbers from handle IDs like "pin-2-left" or "pin-2-right"
      const srcPinMatch = /^pin-(\d+)-/.exec(sourceHandle);
      const tgtPinMatch = /^pin-(\d+)-/.exec(targetHandle);
      if (!srcPinMatch || !tgtPinMatch) return;

      const wireId = makeId<'Wire'>();
      const newWire: Wire = {
        id: wireId,
        label: '',
        fromEnd: { connectorId: source, pinNumber: Number(srcPinMatch[1]) },
        toEnd: { connectorId: target, pinNumber: Number(tgtPinMatch[1]) },
        gaugeAwg: null,
        gaugeMm2: null,
        colorHex: '#888888',
        colorName: '',
        signalName: '',
        notes: '',
        cableId: null,
        waypoints: [],
      };
      upsertWire(newWire);
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            id: wireId,
            type: 'wire',
            data: {
              label: '',
              colorHex: '#888888',
              signalName: '',
              waypoints: [],
              onAddWaypoint: (id: string, x: number, y: number) =>
                addWaypointRef.current(id, x, y),
            } satisfies WireEdgeData,
          },
          eds,
        ),
      );
    },
    [upsertWire, setEdges],
  );

  // ── Delete selected nodes/edges — FR-SE-10 ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when focus is in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    },
    [canUndo, canRedo, undo, redo],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Delete key for selected nodes/edges ──
  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const n of deletedNodes) {
        if (schematic.connectors.some((c) => c.id === n.id)) {
          removeConnector(n.id);
        } else if (schematic.spliceNodes.some((s) => s.id === n.id)) {
          removeSplice(n.id);
        }
      }
    },
    [schematic, removeConnector, removeSplice],
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const e of deletedEdges) {
        removeWire(e.id);
      }
    },
    [removeWire],
  );

  // ── Selection change ──
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      if (selNodes.length === 1 && selEdges.length === 0) {
        const n = selNodes[0]!;
        if (n.type === 'connector') onSelectionChange({ kind: 'connector', id: n.id });
        else if (n.type === 'splice') onSelectionChange({ kind: 'splice', id: n.id });
        else onSelectionChange(null);
      } else if (selEdges.length === 1 && selNodes.length === 0) {
        onSelectionChange({ kind: 'wire', id: selEdges[0]!.id });
      } else {
        onSelectionChange(null);
      }
    },
    [onSelectionChange],
  );

  // ── Drop connector from library panel — FR-SE-02 ──
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/kicable-component');
      if (!raw) return;
      let comp: Component;
      try {
        comp = JSON.parse(raw) as Component;
      } catch {
        return;
      }
      const reactFlowBounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - reactFlowBounds.left;
      const y = e.clientY - reactFlowBounds.top;

      // Copy component into project if not already present (for CHD portability)
      onAddComponentToProject(comp);

      const instance: ConnectorInstance = {
        id: makeId<'ConnectorInstance'>(),
        componentId: comp.id,
        componentVersion: comp.version,
        label: '',
        x,
        y,
      };
      upsertConnector(instance);
      setNodes((nds) => [
        ...nds,
        {
          id: instance.id,
          type: 'connector',
          position: { x, y },
          data: {
            label: '',
            pinCount: comp.pinCount,
            pins: comp.pins,
          } satisfies ConnectorNodeData,
        },
      ]);
    },
    [upsertConnector, setNodes, onAddComponentToProject],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ── Insert splice node (called from toolbar) ──
  const insertSplice = useCallback(
    (type: '3way' | '4way', x: number, y: number) => {
      const splice: SpliceNode = {
        id: makeId<'SpliceNode'>(),
        x,
        y,
        type,
        label: '',
      };
      upsertSplice(splice);
      setNodes((nds) => [
        ...nds,
        {
          id: splice.id,
          type: 'splice',
          position: { x, y },
          data: { label: '', type } satisfies SpliceNodeData,
        },
      ]);
    },
    [upsertSplice, setNodes],
  );
  // Expose insertSplice via ref so parent can call it
  const insertSpliceRef = useRef(insertSplice);
  insertSpliceRef.current = insertSplice;

  // ── Also sync schematic mutations back to RF edges when wires change ──
  useEffect(() => {
    setEdges(schematicToRFEdges(schematic, (id, x, y) => addWaypointRef.current(id, x, y)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schematic.wires, setEdges]);

  void setSchematic; // available via editor prop if needed

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Splice insert toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 5,
          display: 'flex',
          gap: 4,
        }}
      >
        <button
          onClick={() => insertSpliceRef.current('3way', 200, 200)}
          title="Insert 3-way splice"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: '#fff',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          + T-splice
        </button>
        <button
          onClick={() => insertSpliceRef.current('4way', 200, 200)}
          title="Insert 4-way splice"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: '#fff',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          + X-splice
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onSelectionChange={handleSelectionChange}
        selectionMode={SelectionMode.Partial}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnDrag={[1, 2]}
        zoomOnScroll
        zoomOnPinch
        minZoom={0.05}
        maxZoom={4}
        snapToGrid
        snapGrid={[16, 16]}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{ background: '#f8fafc' }}
        />
      </ReactFlow>
    </div>
  );
};

export default SchematicCanvas;
export { SchematicCanvas };

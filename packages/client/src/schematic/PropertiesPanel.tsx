/**
 * PropertiesPanel — right sidebar showing properties of the selected entity (FR-SE-06).
 *
 * Shows editable fields for:
 *  - ConnectorInstance (label)
 *  - SpliceNode (label)
 *  - Wire (label, colorHex, colorName, signalName, gauge, notes)
 */

import { useEffect, useState, type ChangeEvent, type FC } from 'react';
import type { ConnectorInstance, Schematic, SpliceNode, Wire } from '@kicable/shared';
import type { CanvasSelection } from './canvas/SchematicCanvas.js';
import type { UseEditorStateReturn } from './useEditorState.js';

interface Props {
  selection: CanvasSelection;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}

// ── Shared input styles ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '3px 6px',
  fontSize: 11,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  outline: 'none',
  marginTop: 2,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const fieldStyle: React.CSSProperties = { marginBottom: 10 };

// ── Connector properties ─────────────────────────────────────────────────────
const ConnectorProps: FC<{
  connector: ConnectorInstance;
  editor: UseEditorStateReturn;
}> = ({ connector, editor }) => {
  const [label, setLabel] = useState(connector.label);
  useEffect(() => setLabel(connector.label), [connector.label]);

  function save() {
    if (label !== connector.label) {
      editor.upsertConnector({ ...connector, label });
    }
  }

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Connector
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Ref designator</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="J1, P2…"
        />
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Component ID</div>
        <div style={{ fontSize: 10, color: '#94a3b8', wordBreak: 'break-all' }}>
          {connector.componentId}
        </div>
      </div>
    </>
  );
};

// ── Splice node properties ────────────────────────────────────────────────────
const SpliceProps: FC<{
  splice: SpliceNode;
  editor: UseEditorStateReturn;
}> = ({ splice, editor }) => {
  const [label, setLabel] = useState(splice.label);
  useEffect(() => setLabel(splice.label), [splice.label]);

  function save() {
    if (label !== splice.label) {
      editor.upsertSplice({ ...splice, label });
    }
  }

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Splice ({splice.type})
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Label</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="SP1…"
        />
      </div>
    </>
  );
};

// ── Wire properties ──────────────────────────────────────────────────────────
const WireProps: FC<{
  wire: Wire;
  editor: UseEditorStateReturn;
}> = ({ wire, editor }) => {
  const [label, setLabel] = useState(wire.label);
  const [colorHex, setColorHex] = useState(wire.colorHex);
  const [colorName, setColorName] = useState(wire.colorName);
  const [signalName, setSignalName] = useState(wire.signalName);
  const [notes, setNotes] = useState(wire.notes);

  useEffect(() => {
    setLabel(wire.label);
    setColorHex(wire.colorHex);
    setColorName(wire.colorName);
    setSignalName(wire.signalName);
    setNotes(wire.notes);
  }, [wire]);

  function save() {
    editor.upsertWire({
      ...wire,
      label,
      colorHex,
      colorName,
      signalName,
      notes,
    });
  }

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Wire
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Wire label / number</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="W1…"
        />
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Signal</div>
        <input
          style={inputStyle}
          value={signalName}
          onChange={(e) => setSignalName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="GND, VCC…"
        />
      </div>
      <div style={{ ...fieldStyle, display: 'flex', gap: 6 }}>
        <div style={{ flex: '0 0 36px' }}>
          <div style={labelStyle}>Color</div>
          <input
            type="color"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            onBlur={save}
            style={{ width: 36, height: 28, padding: 1, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
            title="Wire color"
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Color name</div>
          <input
            style={inputStyle}
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Red, GN/YE…"
          />
        </div>
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Notes</div>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56, fontFamily: 'sans-serif' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Notes…"
        />
      </div>
      <div style={fieldStyle}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {wire.fromEnd.connectorId.slice(0, 8)}… pin {wire.fromEnd.pinNumber}
          {' → '}
          {wire.toEnd.connectorId.slice(0, 8)}… pin {wire.toEnd.pinNumber}
        </div>
      </div>
    </>
  );
};

// ── Main panel ───────────────────────────────────────────────────────────────
const PropertiesPanel: FC<Props> = ({ selection, schematic, editor }) => {
  return (
    <div
      style={{
        width: 220,
        height: '100%',
        background: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        padding: '10px 12px',
        overflowY: 'auto',
        fontFamily: 'sans-serif',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
        PROPERTIES
      </div>

      {!selection && (
        <p style={{ fontSize: 11, color: '#94a3b8' }}>Select a node or wire to edit properties.</p>
      )}

      {selection?.kind === 'connector' && (() => {
        const c = schematic.connectors.find((x) => x.id === selection.id);
        return c ? <ConnectorProps connector={c} editor={editor} /> : null;
      })()}

      {selection?.kind === 'splice' && (() => {
        const s = schematic.spliceNodes.find((x) => x.id === selection.id);
        return s ? <SpliceProps splice={s} editor={editor} /> : null;
      })()}

      {selection?.kind === 'wire' && (() => {
        const w = schematic.wires.find((x) => x.id === selection.id);
        return w ? <WireProps wire={w} editor={editor} /> : null;
      })()}
    </div>
  );
};

export default PropertiesPanel;

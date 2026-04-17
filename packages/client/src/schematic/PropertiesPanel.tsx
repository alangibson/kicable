/**
 * PropertiesPanel — right sidebar showing properties of the selected entity (FR-SE-06).
 *
 * Wire panel covers §6.4 Wire & Cable Dimensional Definitions:
 *   - §6.4.2 Overall Length (mode, override, formula, slack opt-out)
 *   - §6.4.3 Named Segments (ordered list, discrepancy indicator)
 *   - §6.4.4 Strip Definitions per end (End A / End B accordion)
 *   - §6.4.6 DRC rule display (LEN-01 – LEN-07)
 */

import {
  useEffect,
  useState,
  useCallback,
  type ChangeEvent,
  type FC,
} from 'react';
import type {
  Bundle,
  Cable,
  CableEnd,
  ConnectorInstance,
  JoinNode,
  Project,
  Schematic,
  SpliceNode,
  SplitNode,
  Wire,
  WireEnd,
  WireSegment,
} from '@kicable/shared';
import {
  COMMON_AWG_GAUGES,
  COMMON_MM2_GAUGES,
  computeBundleOuterDiameterMm,
  computeWireSchematicLengthMm,
  formatLength,
  getColorStandardEntries,
  getEffectiveLengthMm,
  makeId,
  runSplitJoinDrc,
  runWireDrc,
  wireInsulationOdMm,
  type DrcViolation,
  type WireColorStandard,
} from '@kicable/shared';
import type { CanvasSelection } from './canvas/SchematicCanvas.js';
import type { UseEditorStateReturn } from './useEditorState.js';

interface Props {
  selection: CanvasSelection;
  schematic: Schematic;
  editor: UseEditorStateReturn;
  project: Project;
}

// ── Shared primitives ────────────────────────────────────────────────────────

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

const fieldStyle: React.CSSProperties = { marginBottom: 8 };

// ── Accordion ────────────────────────────────────────────────────────────────

const Accordion: FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: '#f1f5f9',
          border: 'none',
          padding: '5px 8px',
          fontSize: 10,
          fontWeight: 700,
          color: '#475569',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          borderRadius: open ? '4px 4px 0 0' : 4,
        }}
      >
        <span>{title}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '8px 8px 4px' }}>{children}</div>
      )}
    </div>
  );
};

// ── Split node properties (FR-CS-03, FR-CS-07) ───────────────────────────────

const SplitNodeProps: FC<{
  splitNode: SplitNode;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}> = ({ splitNode, schematic, editor }) => {
  const [label, setLabel] = useState(splitNode.label);
  const [fanOutLengthMm, setFanOutLengthMm] = useState(splitNode.fanOutLengthMm);
  useEffect(() => {
    setLabel(splitNode.label);
    setFanOutLengthMm(splitNode.fanOutLengthMm);
  }, [splitNode]);

  function save() {
    editor.upsertSplitNode({ ...splitNode, label, fanOutLengthMm });
  }

  const incomingWires = schematic.wires.filter((w) => w.toEnd.connectorId === splitNode.id);
  const fanOutWires = schematic.wires.filter((w) => w.fromEnd.connectorId === splitNode.id);
  const cable = splitNode.cableId ? schematic.cables.find((c) => c.id === splitNode.cableId) : null;

  const drcViolations = runSplitJoinDrc(schematic).filter(
    (v) => v.code.startsWith('SPLIT'),
  );

  // Re-merge: restore conductor wires' toEnds from fan-out wires, delete fan-out wires and split node
  function handleRemerge() {
    const restoredConductors = incomingWires.map((c) => {
      const matching = fanOutWires.find((f) => f.fromEnd.pinNumber === c.toEnd.pinNumber);
      return matching ? { ...c, cableId: cable?.id ?? c.cableId, toEnd: matching.toEnd } : c;
    });
    const fanOutIds = new Set(fanOutWires.map((f) => f.id));
    const incomingIds = new Set(incomingWires.map((c) => c.id));
    editor.commitSchematic({
      ...schematic,
      splitNodes: schematic.splitNodes.filter((s) => s.id !== splitNode.id),
      wires: [
        ...schematic.wires.filter((w) => !fanOutIds.has(w.id) && !incomingIds.has(w.id)),
        ...restoredConductors,
      ],
    });
  }

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Split Node
      </div>

      <DrcBadge violations={drcViolations} />

      <div style={fieldStyle}>
        <div style={labelStyle}>Label</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="SP1…"
        />
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Fan-out length (mm)</div>
        <input
          type="number"
          min={0}
          step={1}
          style={inputStyle}
          value={fanOutLengthMm}
          onChange={(e) => setFanOutLengthMm(parseFloat(e.target.value) || 0)}
          onBlur={save}
        />
      </div>

      {cable && (
        <div style={{ ...fieldStyle, fontSize: 10, color: '#64748b' }}>
          Cable: {cable.label || cable.id.slice(0, 8)}
        </div>
      )}

      <div style={fieldStyle}>
        <div style={labelStyle}>Conductors in ({incomingWires.length})</div>
        {incomingWires.map((w) => (
          <div key={w.id} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: w.colorHex, border: '1px solid #e2e8f0', flexShrink: 0 }} />
            <span>{w.label || w.id.slice(0, 8)}</span>
          </div>
        ))}
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Fan-out wires ({fanOutWires.length})</div>
        {fanOutWires.map((w) => (
          <div key={w.id} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: w.colorHex, border: '1px solid #e2e8f0', flexShrink: 0 }} />
            <span>{w.label || w.id.slice(0, 8)}</span>
          </div>
        ))}
      </div>

      {/* FR-CS-07: re-merge option */}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={handleRemerge}
          title="Re-merge fan-out wires back into the cable"
          style={{
            fontSize: 10,
            padding: '3px 8px',
            border: '1px solid #92400e',
            borderRadius: 3,
            background: '#fffbeb',
            color: '#92400e',
            cursor: 'pointer',
          }}
        >
          Re-merge into cable
        </button>
        <button
          onClick={() => editor.removeSplitNode(splitNode.id)}
          title="Delete split node (leave fan-out wires as standalone)"
          style={{
            fontSize: 10,
            padding: '3px 8px',
            border: '1px solid #fca5a5',
            borderRadius: 3,
            background: '#fff1f2',
            color: '#dc2626',
            cursor: 'pointer',
          }}
        >
          Delete (leave standalone)
        </button>
      </div>
    </>
  );
};

// ── Join node properties (FR-CJ-02, FR-CJ-05) ────────────────────────────────

const JoinNodeProps: FC<{
  joinNode: JoinNode;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}> = ({ joinNode, schematic, editor }) => {
  const [label, setLabel] = useState(joinNode.label);
  const [fanInLengthMm, setFanInLengthMm] = useState(joinNode.fanInLengthMm);
  useEffect(() => {
    setLabel(joinNode.label);
    setFanInLengthMm(joinNode.fanInLengthMm);
  }, [joinNode]);

  function save() {
    editor.upsertJoinNode({ ...joinNode, label, fanInLengthMm });
  }

  const incomingWires = schematic.wires.filter((w) => w.toEnd.connectorId === joinNode.id);
  const outgoingWires = schematic.wires.filter((w) => w.fromEnd.connectorId === joinNode.id);
  const cable = joinNode.cableId ? schematic.cables.find((c) => c.id === joinNode.cableId) : null;

  const drcViolations = runSplitJoinDrc(schematic).filter(
    (v) => v.code.startsWith('JOIN'),
  );

  // Dissolve join: remove join node, cable, and output conductor wires (FR-CJ-05)
  function handleDissolve() {
    const outIds = new Set(outgoingWires.map((w) => w.id));
    editor.commitSchematic({
      ...schematic,
      joinNodes: schematic.joinNodes.filter((j) => j.id !== joinNode.id),
      cables: joinNode.cableId
        ? schematic.cables.filter((c) => c.id !== joinNode.cableId)
        : schematic.cables,
      wires: schematic.wires.filter(
        (w) => !outIds.has(w.id) && w.toEnd.connectorId !== joinNode.id,
      ),
    });
  }

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Join Node
      </div>

      <DrcBadge violations={drcViolations} />

      <div style={fieldStyle}>
        <div style={labelStyle}>Label</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="JN1…"
        />
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Fan-in length (mm)</div>
        <input
          type="number"
          min={0}
          step={1}
          style={inputStyle}
          value={fanInLengthMm}
          onChange={(e) => setFanInLengthMm(parseFloat(e.target.value) || 0)}
          onBlur={save}
        />
      </div>

      {cable && (
        <div style={{ ...fieldStyle, fontSize: 10, color: '#64748b' }}>
          Cable out: {cable.label || cable.id.slice(0, 8)}
        </div>
      )}

      <div style={fieldStyle}>
        <div style={labelStyle}>Incoming wires ({incomingWires.length})</div>
        {incomingWires.map((w) => (
          <div key={w.id} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: w.colorHex, border: '1px solid #e2e8f0', flexShrink: 0 }} />
            <span>{w.label || w.id.slice(0, 8)}</span>
            {w.signalName && <span style={{ color: '#64748b' }}>· {w.signalName}</span>}
          </div>
        ))}
      </div>

      {outgoingWires.length > 0 && (
        <div style={fieldStyle}>
          <div style={labelStyle}>Outgoing conductors ({outgoingWires.length})</div>
          {outgoingWires.map((w) => (
            <div key={w.id} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: w.colorHex, border: '1px solid #e2e8f0', flexShrink: 0 }} />
              <span>{w.label || w.id.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}

      {/* FR-CJ-05: dissolve join node */}
      <button
        onClick={handleDissolve}
        title="Dissolve join node — cable removed, wires become standalone"
        style={{
          marginTop: 8,
          fontSize: 10,
          padding: '3px 8px',
          border: '1px solid #fca5a5',
          borderRadius: 3,
          background: '#fff1f2',
          color: '#dc2626',
          cursor: 'pointer',
        }}
      >
        Dissolve join node
      </button>
    </>
  );
};

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

// ── Cable end strip editor (FR-WG-06) ────────────────────────────────────────

const CableEndEditor: FC<{
  end: CableEnd;
  label: string;
  onChange: (updated: CableEnd) => void;
}> = ({ end, label: endLabel, onChange }) => {
  const set = useCallback(
    (patch: Partial<CableEnd>) => onChange({ ...end, ...patch }),
    [end, onChange],
  );

  return (
    <>
      <div style={fieldStyle}>
        <div style={labelStyle}>{endLabel} — jacket strip (mm)</div>
        <input
          type="number"
          min={0}
          step={1}
          style={inputStyle}
          value={end.outerJacketStripLengthMm}
          onChange={(e) =>
            set({ outerJacketStripLengthMm: parseFloat(e.target.value) || 0 })
          }
          placeholder="0"
        />
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>{endLabel} — shield treatment</div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={end.shieldTreatment}
          onChange={(e) =>
            set({ shieldTreatment: e.target.value as CableEnd['shieldTreatment'] })
          }
        >
          <option value="none">None</option>
          <option value="fold_back">Fold back</option>
          <option value="cut_flush">Cut flush</option>
          <option value="pigtail">Pigtail</option>
          <option value="drain_wire_only">Drain wire only</option>
        </select>
      </div>
      {end.shieldTreatment === 'pigtail' && (
        <div style={fieldStyle}>
          <div style={labelStyle}>{endLabel} — pigtail length (mm)</div>
          <input
            type="number"
            min={0}
            step={1}
            style={inputStyle}
            value={end.pigtailLengthMm ?? ''}
            onChange={(e) =>
              set({ pigtailLengthMm: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })
            }
            placeholder="—"
          />
        </div>
      )}
      {end.shieldTreatment === 'drain_wire_only' && (
        <div style={fieldStyle}>
          <div style={labelStyle}>{endLabel} — drain wire length (mm)</div>
          <input
            type="number"
            min={0}
            step={1}
            style={inputStyle}
            value={end.drainWireLengthMm ?? ''}
            onChange={(e) =>
              set({ drainWireLengthMm: e.target.value === '' ? null : parseFloat(e.target.value) || 0 })
            }
            placeholder="—"
          />
        </div>
      )}
    </>
  );
};

// ── Cable properties (FR-WG-05, FR-WG-06) ────────────────────────────────────

const CableProps: FC<{
  cable: Cable;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}> = ({ cable, schematic, editor }) => {
  const [label, setLabel] = useState(cable.label);
  const [notes, setNotes] = useState(cable.notes);
  const [endA, setEndA] = useState<CableEnd>(cable.endA);
  const [endB, setEndB] = useState<CableEnd>(cable.endB);

  useEffect(() => {
    setLabel(cable.label);
    setNotes(cable.notes);
    setEndA(cable.endA);
    setEndB(cable.endB);
  }, [cable]);

  function save(patch?: Partial<typeof cable>) {
    editor.upsertCable({ ...cable, label, notes, endA, endB, ...patch });
  }

  const saveEndA = useCallback(
    (updated: CableEnd) => {
      setEndA(updated);
      editor.upsertCable({ ...cable, endA: updated });
    },
    [cable, editor],
  );

  const saveEndB = useCallback(
    (updated: CableEnd) => {
      setEndB(updated);
      editor.upsertCable({ ...cable, endB: updated });
    },
    [cable, editor],
  );

  const conductors = schematic.wires.filter((w) => w.cableId === cable.id);

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Cable
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Label</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => save()}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="CAB1…"
        />
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Notes</div>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 40, fontFamily: 'sans-serif' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => save()}
          placeholder="Notes…"
        />
      </div>

      {/* Jacket strip-back per end (FR-WG-06) */}
      <Accordion title="END A — JACKET STRIP">
        <CableEndEditor end={endA} label="End A" onChange={saveEndA} />
      </Accordion>
      <Accordion title="END B — JACKET STRIP">
        <CableEndEditor end={endB} label="End B" onChange={saveEndB} />
      </Accordion>

      <div style={fieldStyle}>
        <div style={labelStyle}>Conductors ({conductors.length})</div>
        {conductors.length === 0 ? (
          <div style={{ fontSize: 10, color: '#94a3b8' }}>No wires assigned yet.</div>
        ) : (
          <div style={{ fontSize: 10 }}>
            {conductors.map((w) => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: w.colorHex,
                    border: '1px solid #e2e8f0',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#1e293b' }}>{w.label || w.id.slice(0, 8)}</span>
                {w.signalName && (
                  <span style={{ color: '#64748b' }}>· {w.signalName}</span>
                )}
                <button
                  onClick={() => editor.upsertWire({ ...w, cableId: null })}
                  title="Remove from cable"
                  style={{
                    marginLeft: 'auto',
                    border: 'none',
                    background: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '0 2px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ── Bundle properties (FR-WG-03) ─────────────────────────────────────────────

const BundleProps: FC<{
  bundle: Bundle;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}> = ({ bundle, schematic, editor }) => {
  const [label, setLabel] = useState(bundle.label);
  const [fillRatio, setFillRatio] = useState(bundle.fillRatio);
  const [notes, setNotes] = useState(bundle.notes);
  useEffect(() => {
    setLabel(bundle.label);
    setFillRatio(bundle.fillRatio);
    setNotes(bundle.notes);
  }, [bundle]);

  function save() {
    editor.upsertBundle({ ...bundle, label, fillRatio, notes });
  }

  const members = schematic.wires.filter((w) => w.bundleId === bundle.id);
  const wireOds = members.map((w) => wireInsulationOdMm(w) ?? 0);
  const outerDiameter = computeBundleOuterDiameterMm(wireOds, fillRatio);

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Bundle
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Label</div>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="BUN1…"
        />
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Fill ratio (0–1)</div>
        <input
          type="number"
          min={0.01}
          max={1}
          step={0.05}
          style={inputStyle}
          value={fillRatio}
          onChange={(e) => setFillRatio(parseFloat(e.target.value) || 0.6)}
          onBlur={save}
        />
      </div>
      <div style={{ ...fieldStyle, fontSize: 11, color: '#64748b' }}>
        Outer diameter:{' '}
        <span style={{ fontWeight: 600, color: '#1e293b' }}>
          {outerDiameter != null ? `${outerDiameter.toFixed(2)} mm` : '—'}
        </span>
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Members ({members.length})</div>
        {members.length === 0 ? (
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            No wires assigned. Set Bundle on a wire to add it.
          </div>
        ) : (
          <div style={{ fontSize: 10 }}>
            {members.map((w) => (
              <div
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: w.colorHex,
                    border: '1px solid #e2e8f0',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#1e293b' }}>{w.label || w.id.slice(0, 8)}</span>
                <button
                  onClick={() => editor.upsertWire({ ...w, bundleId: null })}
                  title="Remove from bundle"
                  style={{
                    marginLeft: 'auto',
                    border: 'none',
                    background: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '0 2px',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={fieldStyle}>
        <div style={labelStyle}>Notes</div>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 40, fontFamily: 'sans-serif' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Notes…"
        />
      </div>
      <button
        onClick={() => editor.removeBundle(bundle.id)}
        style={{
          fontSize: 10,
          padding: '3px 8px',
          border: '1px solid #fca5a5',
          borderRadius: 3,
          background: '#fff1f2',
          color: '#dc2626',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Delete bundle
      </button>
    </>
  );
};

// ── DRC badge ────────────────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  error: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

const DrcBadge: FC<{ violations: DrcViolation[] }> = ({ violations }) => {
  if (violations.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      {violations.map((v, i) => (
        <div
          key={i}
          style={{
            fontSize: 10,
            color: severityColor[v.severity] ?? '#475569',
            background: `${severityColor[v.severity] ?? '#475569'}18`,
            border: `1px solid ${severityColor[v.severity] ?? '#cbd5e1'}`,
            borderRadius: 3,
            padding: '3px 6px',
            marginBottom: 3,
          }}
        >
          <span style={{ fontWeight: 700 }}>{v.code}</span> {v.message}
        </div>
      ))}
    </div>
  );
};

// ── Strip end editor (End A / End B) ─────────────────────────────────────────

const WireEndEditor: FC<{
  end: WireEnd;
  onChange: (updated: WireEnd) => void;
}> = ({ end, onChange }) => {
  const set = useCallback(
    (patch: Partial<WireEnd>) => onChange({ ...end, ...patch }),
    [end, onChange],
  );

  return (
    <>
      <div style={fieldStyle}>
        <div style={labelStyle}>Strip length (mm)</div>
        <input
          type="number"
          min={0}
          step={0.1}
          style={inputStyle}
          value={end.stripLengthMm}
          onChange={(e) => set({ stripLengthMm: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Strip type</div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={end.stripType}
          onChange={(e) =>
            set({ stripType: e.target.value as WireEnd['stripType'] })
          }
        >
          <option value="full">Full</option>
          <option value="window">Window</option>
          <option value="step">Step</option>
        </select>
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Insulation OD (mm)</div>
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="—"
          style={inputStyle}
          value={end.insulationOdMm ?? ''}
          onChange={(e) =>
            set({
              insulationOdMm: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
            })
          }
        />
      </div>

      <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          id={`tin-req-${end.label}`}
          type="checkbox"
          checked={end.tinningRequired}
          onChange={(e) => set({ tinningRequired: e.target.checked })}
        />
        <label htmlFor={`tin-req-${end.label}`} style={{ fontSize: 10, color: '#64748b' }}>
          Tinning required
        </label>
      </div>

      {end.tinningRequired && (
        <div style={fieldStyle}>
          <div style={labelStyle}>Tinning length (mm)</div>
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="—"
            style={inputStyle}
            value={end.tinningLengthMm ?? ''}
            onChange={(e) =>
              set({
                tinningLengthMm:
                  e.target.value === '' ? null : parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>
      )}

      <div style={fieldStyle}>
        <div style={labelStyle}>Terminal insertion depth (mm)</div>
        <input
          type="number"
          min={0}
          step={0.1}
          placeholder="—"
          style={inputStyle}
          value={end.terminalInsertionDepthMm ?? ''}
          onChange={(e) =>
            set({
              terminalInsertionDepthMm:
                e.target.value === '' ? null : parseFloat(e.target.value) || 0,
            })
          }
        />
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Terminal (component ID)</div>
        <input
          style={inputStyle}
          value={end.terminalComponentId ?? ''}
          onChange={(e) =>
            set({ terminalComponentId: e.target.value || null })
          }
          placeholder="—"
        />
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Notes</div>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 40, fontFamily: 'sans-serif' }}
          value={end.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Notes…"
        />
      </div>

      {/* Step strip layers sub-table (FR-WP-12) */}
      {end.stripType === 'step' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Step layers</div>
          {end.stepLayers.map((layer, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <input
                style={{ ...inputStyle, flex: 2, marginTop: 0 }}
                placeholder="Label"
                value={layer.label}
                onChange={(e) => {
                  const layers = [...end.stepLayers];
                  layers[idx] = { ...layer, label: e.target.value };
                  set({ stepLayers: layers });
                }}
              />
              <input
                type="number"
                min={0}
                step={0.1}
                style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                placeholder="mm"
                value={layer.stripLengthMm}
                onChange={(e) => {
                  const layers = [...end.stepLayers];
                  layers[idx] = {
                    ...layer,
                    stripLengthMm: parseFloat(e.target.value) || 0,
                  };
                  set({ stepLayers: layers });
                }}
              />
              <button
                onClick={() => {
                  const layers = end.stepLayers.filter((_, i) => i !== idx);
                  set({ stepLayers: layers });
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '0 2px',
                }}
                title="Remove layer"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              set({
                stepLayers: [...end.stepLayers, { label: '', stripLengthMm: 0 }],
              })
            }
            style={{
              fontSize: 10,
              padding: '2px 6px',
              border: '1px solid #cbd5e1',
              borderRadius: 3,
              background: '#f8fafc',
              cursor: 'pointer',
              color: '#475569',
            }}
          >
            + Add layer
          </button>
        </div>
      )}
    </>
  );
};

// ── Wire segments editor ──────────────────────────────────────────────────────

const SegmentsEditor: FC<{
  segments: WireSegment[];
  effectiveLengthMm: number | null;
  unit: string;
  onChange: (segs: WireSegment[]) => void;
}> = ({ segments, effectiveLengthMm, unit, onChange }) => {
  const segSum = segments.reduce((a, s) => a + s.lengthMm, 0);
  const mismatch =
    effectiveLengthMm != null &&
    segments.length > 0 &&
    Math.abs(segSum - effectiveLengthMm) > 0.5;

  function move(from: number, to: number) {
    const copy = [...segments];
    const [item] = copy.splice(from, 1);
    if (item !== undefined) copy.splice(to, 0, item);
    onChange(copy);
  }

  return (
    <>
      {mismatch && (
        <div
          style={{
            fontSize: 10,
            color: '#d97706',
            background: '#fef3c718',
            border: '1px solid #d97706',
            borderRadius: 3,
            padding: '3px 6px',
            marginBottom: 6,
          }}
        >
          Segment sum {segSum.toFixed(1)} mm ≠ overall {effectiveLengthMm!.toFixed(1)} mm
        </div>
      )}

      {segments.map((seg, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            padding: '4px 6px',
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
            <input
              style={{ ...inputStyle, flex: 2, marginTop: 0 }}
              placeholder="Segment name"
              value={seg.name}
              onChange={(e) => {
                const copy = [...segments];
                copy[idx] = { ...seg, name: e.target.value };
                onChange(copy);
              }}
            />
            <input
              type="number"
              min={0}
              step={0.1}
              style={{ ...inputStyle, flex: 1, marginTop: 0 }}
              placeholder="mm"
              value={seg.lengthMm}
              onChange={(e) => {
                const copy = [...segments];
                copy[idx] = { ...seg, lengthMm: parseFloat(e.target.value) || 0 };
                onChange(copy);
              }}
            />
          </div>
          <input
            style={{ ...inputStyle, marginTop: 0, marginBottom: 3 }}
            placeholder="Note (optional)"
            value={seg.note}
            onChange={(e) => {
              const copy = [...segments];
              copy[idx] = { ...seg, note: e.target.value };
              onChange(copy);
            }}
          />
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={() => move(idx, idx - 1)}
              disabled={idx === 0}
              style={miniBtn}
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => move(idx, idx + 1)}
              disabled={idx === segments.length - 1}
              style={miniBtn}
              title="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => onChange(segments.filter((_, i) => i !== idx))}
              style={{ ...miniBtn, color: '#ef4444' }}
              title="Remove segment"
            >
              ×
            </button>
          </div>
        </div>
      ))}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        <button
          onClick={() =>
            onChange([...segments, { name: `Seg ${segments.length + 1}`, lengthMm: 0, note: '' }])
          }
          style={{
            fontSize: 10,
            padding: '2px 6px',
            border: '1px solid #cbd5e1',
            borderRadius: 3,
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          + Add segment
        </button>
        {segments.length > 0 && (
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            Σ {segSum.toFixed(1)} {unit}
          </span>
        )}
      </div>
    </>
  );
};

const miniBtn: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  background: 'none',
  cursor: 'pointer',
  fontSize: 11,
  borderRadius: 3,
  padding: '0 4px',
  color: '#64748b',
};

// ── Wire properties ──────────────────────────────────────────────────────────

const WireProps: FC<{
  wire: Wire;
  schematic: Schematic;
  editor: UseEditorStateReturn;
  project: Project;
}> = ({ wire, schematic, editor, project }) => {
  const unit = project.preferredUnit;

  // ── Basic fields ──
  const [label, setLabel] = useState(wire.label);
  const [colorHex, setColorHex] = useState(wire.colorHex);
  const [colorName, setColorName] = useState(wire.colorName);
  const [colorStandard, setColorStandard] = useState<WireColorStandard>('custom');
  const [signalName, setSignalName] = useState(wire.signalName);
  const [notes, setNotes] = useState(wire.notes);
  const [gaugeAwg, setGaugeAwg] = useState<number | null>(wire.gaugeAwg);
  const [gaugeMm2, setGaugeMm2] = useState<number | null>(wire.gaugeMm2);
  const [bundleId, setBundleId] = useState<string | null>(wire.bundleId);
  const [cableId, setCableId] = useState<string | null>(wire.cableId);

  // ── §6.4.2 Length fields ──
  const [lengthMode, setLengthMode] = useState(wire.lengthMode);
  const [overrideLengthMm, setOverrideLengthMm] = useState<number | null>(
    wire.overrideLengthMm,
  );
  const [formulaExpr, setFormulaExpr] = useState(wire.formulaExpr ?? '');
  const [routingSlackOptOut, setRoutingSlackOptOut] = useState(
    wire.routingSlackOptOut,
  );

  // ── §6.4.3 Segments ──
  const [segments, setSegments] = useState(wire.segments);

  // ── §6.4.4 Strip ends ──
  const [endA, setEndA] = useState<WireEnd>(wire.endA);
  const [endB, setEndB] = useState<WireEnd>(wire.endB);

  // Sync when selection changes
  useEffect(() => {
    setLabel(wire.label);
    setColorHex(wire.colorHex);
    setColorName(wire.colorName);
    setSignalName(wire.signalName);
    setNotes(wire.notes);
    setGaugeAwg(wire.gaugeAwg);
    setGaugeMm2(wire.gaugeMm2);
    setBundleId(wire.bundleId);
    setCableId(wire.cableId);
    setLengthMode(wire.lengthMode);
    setOverrideLengthMm(wire.overrideLengthMm);
    setFormulaExpr(wire.formulaExpr ?? '');
    setRoutingSlackOptOut(wire.routingSlackOptOut);
    setSegments(wire.segments);
    setEndA(wire.endA);
    setEndB(wire.endB);
  }, [wire]);

  // Computed schematic length from canvas geometry
  const schematicLengthMm = computeWireSchematicLengthMm(
    wire,
    schematic.connectors,
    project.scaleMmPerPx,
  );

  // Effective length for DRC and display
  const effectiveLengthMm = getEffectiveLengthMm(
    { lengthMode, overrideLengthMm, routingSlackOptOut },
    schematicLengthMm,
    project.routingSlackPct,
  );

  // Save all fields at once
  const save = useCallback(() => {
    editor.upsertWire({
      ...wire,
      label,
      colorHex,
      colorName,
      signalName,
      notes,
      gaugeAwg,
      gaugeMm2,
      bundleId,
      cableId,
      lengthMode,
      overrideLengthMm,
      formulaExpr: formulaExpr || null,
      routingSlackOptOut,
      segments,
      endA,
      endB,
    });
  }, [
    wire,
    editor,
    label,
    colorHex,
    colorName,
    signalName,
    notes,
    gaugeAwg,
    gaugeMm2,
    bundleId,
    cableId,
    lengthMode,
    overrideLengthMm,
    formulaExpr,
    routingSlackOptOut,
    segments,
    endA,
    endB,
  ]);

  // FR-WG-04: propagate signal name to all wires sharing the same signal
  const propagateSignal = useCallback(() => {
    if (!signalName) return;
    for (const w of schematic.wires) {
      if (w.id !== wire.id && w.signalName === wire.signalName && wire.signalName) {
        editor.upsertWire({ ...w, signalName });
      }
    }
    save();
  }, [signalName, wire, schematic.wires, editor, save]);

  // Auto-save whenever derived state changes (segments, ends)
  const saveSegments = useCallback(
    (segs: WireSegment[]) => {
      setSegments(segs);
      editor.upsertWire({ ...wire, segments: segs });
    },
    [wire, editor],
  );

  const saveEndA = useCallback(
    (updated: WireEnd) => {
      setEndA(updated);
      editor.upsertWire({ ...wire, endA: updated });
    },
    [wire, editor],
  );

  const saveEndB = useCallback(
    (updated: WireEnd) => {
      setEndB(updated);
      editor.upsertWire({ ...wire, endB: updated });
    },
    [wire, editor],
  );

  // DRC
  const violations = runWireDrc(
    { ...wire, lengthMode, overrideLengthMm, routingSlackOptOut, segments, endA, endB },
    { effectiveLengthMm, schematicLengthMm },
  );

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Wire
      </div>

      {/* DRC violations (inline, above fields) */}
      <DrcBadge violations={violations} />

      {/* Basic identity fields */}
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

      {/* Signal name + propagate button (FR-WG-01, FR-WG-04) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Signal</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={signalName}
            onChange={(e) => setSignalName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="GND, VCC…"
          />
          <button
            onClick={propagateSignal}
            title="Propagate this signal name to all wires with the same current signal"
            style={{
              padding: '3px 6px',
              fontSize: 10,
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              background: '#f1f5f9',
              cursor: 'pointer',
              color: '#475569',
              flexShrink: 0,
            }}
          >
            ↗
          </button>
        </div>
      </div>

      {/* Gauge (FR-WG-01) */}
      <div style={{ ...fieldStyle, display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>AWG</div>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={gaugeAwg ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setGaugeAwg(v);
              if (v != null) setGaugeMm2(null);
            }}
            onBlur={save}
          >
            <option value="">—</option>
            {COMMON_AWG_GAUGES.map((g) => (
              <option key={g} value={g}>{g} AWG</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>mm²</div>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={gaugeMm2 ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setGaugeMm2(v);
              if (v != null) setGaugeAwg(null);
            }}
            onBlur={save}
          >
            <option value="">—</option>
            {COMMON_MM2_GAUGES.map((g) => (
              <option key={g} value={g}>{g} mm²</option>
            ))}
          </select>
        </div>
      </div>

      {/* Color standard + picker (FR-WG-02) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Color standard</div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={colorStandard}
          onChange={(e) => setColorStandard(e.target.value as WireColorStandard)}
        >
          <option value="custom">Custom</option>
          <option value="ISO_6722">ISO 6722</option>
          <option value="SAE_J1128">SAE J1128</option>
        </select>
      </div>
      {colorStandard !== 'custom' ? (
        <div style={fieldStyle}>
          <div style={labelStyle}>Color</div>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={colorName}
            onChange={(e) => {
              const entry = getColorStandardEntries(colorStandard).find(
                (c) => c.code === e.target.value,
              );
              if (entry) {
                setColorName(entry.code);
                setColorHex(entry.hex);
              }
            }}
            onBlur={save}
          >
            <option value="">— select —</option>
            {getColorStandardEntries(colorStandard).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ ...fieldStyle, display: 'flex', gap: 6 }}>
          <div style={{ flex: '0 0 36px' }}>
            <div style={labelStyle}>Color</div>
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              onBlur={save}
              style={{
                width: 36,
                height: 28,
                padding: 1,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                cursor: 'pointer',
              }}
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
      )}

      {/* Bundle assignment (FR-WG-03) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Bundle</div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={bundleId ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            setBundleId(v);
            editor.upsertWire({ ...wire, bundleId: v });
          }}
        >
          <option value="">— none —</option>
          {schematic.bundles.map((b) => (
            <option key={b.id} value={b.id}>{b.label || b.id.slice(0, 8)}</option>
          ))}
        </select>
      </div>

      {/* Cable assignment (FR-WG-05) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Cable</div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={cableId ?? ''}
          onChange={(e) => {
            const v = e.target.value || null;
            setCableId(v);
            editor.upsertWire({ ...wire, cableId: v });
          }}
        >
          <option value="">— none —</option>
          {schematic.cables.map((c) => (
            <option key={c.id} value={c.id}>{c.label || c.id.slice(0, 8)}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Notes</div>
        <textarea
          style={{
            ...inputStyle,
            resize: 'vertical',
            minHeight: 40,
            fontFamily: 'sans-serif',
          }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          placeholder="Notes…"
        />
      </div>
      <div style={{ ...fieldStyle, fontSize: 10, color: '#94a3b8' }}>
        {wire.fromEnd.connectorId.slice(0, 8)}… pin {wire.fromEnd.pinNumber}
        {' → '}
        {wire.toEnd.connectorId.slice(0, 8)}… pin {wire.toEnd.pinNumber}
      </div>

      {/* §6.4.2 Overall Length */}
      <Accordion title="OVERALL LENGTH" defaultOpen>
        <div style={fieldStyle}>
          <div style={labelStyle}>Length mode</div>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={lengthMode}
            onChange={(e) => {
              setLengthMode(e.target.value as typeof lengthMode);
            }}
            onBlur={save}
          >
            <option value="schematic">Schematic (canvas)</option>
            <option value="override">Override</option>
            <option value="formula">Formula</option>
          </select>
        </div>

        {/* Schematic mode: show computed length read-only */}
        {lengthMode === 'schematic' && (
          <div style={{ ...fieldStyle, fontSize: 11, color: '#64748b' }}>
            Canvas length:{' '}
            <span style={{ fontWeight: 600, color: '#1e293b' }}>
              {schematicLengthMm != null
                ? formatLength(schematicLengthMm, unit)
                : '—'}
            </span>
          </div>
        )}

        {/* Override mode */}
        {lengthMode === 'override' && (
          <div style={fieldStyle}>
            <div style={labelStyle}>Override length (mm)</div>
            <input
              type="number"
              min={0}
              step={1}
              style={inputStyle}
              value={overrideLengthMm ?? ''}
              onChange={(e) =>
                setOverrideLengthMm(
                  e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                )
              }
              onBlur={save}
            />
          </div>
        )}

        {/* Formula mode */}
        {lengthMode === 'formula' && (
          <div style={fieldStyle}>
            <div style={labelStyle}>Formula expression</div>
            <input
              style={inputStyle}
              value={formulaExpr}
              onChange={(e) => setFormulaExpr(e.target.value)}
              onBlur={save}
              placeholder="e.g. 350 + 2*50"
            />
          </div>
        )}

        {/* Effective length display */}
        <div style={{ ...fieldStyle, fontSize: 11, color: '#64748b' }}>
          Effective:{' '}
          <span style={{ fontWeight: 600, color: '#1e293b' }}>
            {effectiveLengthMm != null
              ? formatLength(effectiveLengthMm, unit)
              : '—'}
          </span>
          {project.routingSlackPct > 0 && !routingSlackOptOut && (
            <span style={{ color: '#94a3b8' }}>
              {' '}(+{project.routingSlackPct}% slack)
            </span>
          )}
        </div>

        {/* Routing slack opt-out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <input
            id={`slack-opt-${wire.id}`}
            type="checkbox"
            checked={routingSlackOptOut}
            onChange={(e) => {
              setRoutingSlackOptOut(e.target.checked);
              editor.upsertWire({ ...wire, routingSlackOptOut: e.target.checked });
            }}
          />
          <label
            htmlFor={`slack-opt-${wire.id}`}
            style={{ fontSize: 10, color: '#64748b' }}
          >
            Opt out of global routing slack
          </label>
        </div>
      </Accordion>

      {/* §6.4.3 Named Segments */}
      <Accordion title="SEGMENTS">
        <SegmentsEditor
          segments={segments}
          effectiveLengthMm={effectiveLengthMm}
          unit={unit}
          onChange={saveSegments}
        />
      </Accordion>

      {/* §6.4.4 Strip Definitions — End A */}
      <Accordion title="END A — STRIP">
        <WireEndEditor end={endA} onChange={saveEndA} />
      </Accordion>

      {/* §6.4.4 Strip Definitions — End B */}
      <Accordion title="END B — STRIP">
        <WireEndEditor end={endB} onChange={saveEndB} />
      </Accordion>
    </>
  );
};

// ── Main panel ───────────────────────────────────────────────────────────────

const PropertiesPanel: FC<Props> = ({ selection, schematic, editor, project }) => {
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);
  const [activeCableId, setActiveCableId] = useState<string | null>(null);

  const activeBundle = schematic.bundles.find((b) => b.id === activeBundleId) ?? null;
  const activeCable = schematic.cables.find((c) => c.id === activeCableId) ?? null;

  function addBundle() {
    const b = {
      id: makeId(),
      label: `Bundle ${schematic.bundles.length + 1}`,
      notes: '',
      fillRatio: 0.6,
    };
    editor.upsertBundle(b);
    setActiveBundleId(b.id);
    setActiveCableId(null);
  }

  function addCable() {
    const c = {
      id: makeId(),
      label: `Cable ${schematic.cables.length + 1}`,
      notes: '',
      overallLengthMm: null,
      endA: {
        outerJacketStripLengthMm: 0,
        shieldTreatment: 'none' as const,
        drainWireLengthMm: null,
        pigtailLengthMm: null,
        tapeShrinkStartMm: null,
        tapeShrinkLengthMm: null,
      },
      endB: {
        outerJacketStripLengthMm: 0,
        shieldTreatment: 'none' as const,
        drainWireLengthMm: null,
        pigtailLengthMm: null,
        tapeShrinkStartMm: null,
        tapeShrinkLengthMm: null,
      },
    };
    editor.upsertCable(c);
    setActiveCableId(c.id);
    setActiveBundleId(null);
  }

  return (
    <div
      style={{
        width: 240,
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

      {/* Canvas selection */}
      {!selection && !activeBundle && !activeCable && (
        <p style={{ fontSize: 11, color: '#94a3b8' }}>
          Select a node or wire to edit properties.
        </p>
      )}

      {selection?.kind === 'connector' &&
        (() => {
          const c = schematic.connectors.find((x) => x.id === selection.id);
          return c ? <ConnectorProps connector={c} editor={editor} /> : null;
        })()}

      {selection?.kind === 'splice' &&
        (() => {
          const s = schematic.spliceNodes.find((x) => x.id === selection.id);
          return s ? <SpliceProps splice={s} editor={editor} /> : null;
        })()}

      {selection?.kind === 'splitNode' &&
        (() => {
          const sn = schematic.splitNodes.find((x) => x.id === selection.id);
          return sn ? <SplitNodeProps splitNode={sn} schematic={schematic} editor={editor} /> : null;
        })()}

      {selection?.kind === 'joinNode' &&
        (() => {
          const jn = schematic.joinNodes.find((x) => x.id === selection.id);
          return jn ? <JoinNodeProps joinNode={jn} schematic={schematic} editor={editor} /> : null;
        })()}

      {selection?.kind === 'wire' &&
        (() => {
          const w = schematic.wires.find((x) => x.id === selection.id);
          return w ? (
            <WireProps
              wire={w}
              schematic={schematic}
              editor={editor}
              project={project}
            />
          ) : null;
        })()}

      {/* Bundle / Cable management (FR-WG-03, FR-WG-05) */}
      <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          BUNDLES
        </div>
        {schematic.bundles.map((b) => (
          <div
            key={b.id}
            onClick={() => { setActiveBundleId(b.id); setActiveCableId(null); }}
            style={{
              fontSize: 10,
              padding: '3px 6px',
              borderRadius: 3,
              marginBottom: 2,
              cursor: 'pointer',
              background: activeBundleId === b.id ? '#e0e7ff' : '#f1f5f9',
              color: activeBundleId === b.id ? '#3730a3' : '#334155',
              border: activeBundleId === b.id ? '1px solid #a5b4fc' : '1px solid transparent',
            }}
          >
            {b.label || b.id.slice(0, 8)} ({schematic.wires.filter((w) => w.bundleId === b.id).length} wires)
          </div>
        ))}
        <button
          onClick={addBundle}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            border: '1px solid #cbd5e1',
            borderRadius: 3,
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#475569',
            marginTop: 4,
          }}
        >
          + New bundle
        </button>
        {activeBundle && (
          <div style={{ marginTop: 10 }}>
            <BundleProps bundle={activeBundle} schematic={schematic} editor={editor} />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          CABLES
        </div>
        {schematic.cables.map((c) => (
          <div
            key={c.id}
            onClick={() => { setActiveCableId(c.id); setActiveBundleId(null); }}
            style={{
              fontSize: 10,
              padding: '3px 6px',
              borderRadius: 3,
              marginBottom: 2,
              cursor: 'pointer',
              background: activeCableId === c.id ? '#e0e7ff' : '#f1f5f9',
              color: activeCableId === c.id ? '#3730a3' : '#334155',
              border: activeCableId === c.id ? '1px solid #a5b4fc' : '1px solid transparent',
            }}
          >
            {c.label || c.id.slice(0, 8)} ({schematic.wires.filter((w) => w.cableId === c.id).length} conductors)
          </div>
        ))}
        <button
          onClick={addCable}
          style={{
            fontSize: 10,
            padding: '2px 8px',
            border: '1px solid #cbd5e1',
            borderRadius: 3,
            background: '#f8fafc',
            cursor: 'pointer',
            color: '#475569',
            marginTop: 4,
          }}
        >
          + New cable
        </button>
        {activeCable && (
          <div style={{ marginTop: 10 }}>
            <CableProps cable={activeCable} schematic={schematic} editor={editor} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;

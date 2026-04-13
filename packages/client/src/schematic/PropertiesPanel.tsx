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
  ConnectorInstance,
  Project,
  Schematic,
  SpliceNode,
  Wire,
  WireEnd,
  WireSegment,
} from '@kicable/shared';
import {
  computeWireSchematicLengthMm,
  formatLength,
  getEffectiveLengthMm,
  runWireDrc,
  type DrcViolation,
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
  const [signalName, setSignalName] = useState(wire.signalName);
  const [notes, setNotes] = useState(wire.notes);

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
    lengthMode,
    overrideLengthMm,
    formulaExpr,
    routingSlackOptOut,
    segments,
    endA,
    endB,
  ]);

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

      {!selection && (
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
    </div>
  );
};

export default PropertiesPanel;

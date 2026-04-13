/**
 * PropertiesPanel — right sidebar showing properties of the selected entity (FR-SE-06).
 *
 * Shows editable fields for:
 *  - ConnectorInstance (label)
 *  - SpliceNode (label)
 *  - Wire (label, gauge, color + standard presets, signalName, notes,
 *           bundle assignment, cable assignment)
 */

import { useEffect, useMemo, useState, type ChangeEvent, type FC } from 'react';
import type { Bundle, Cable, ConnectorInstance, Schematic, SpliceNode, Wire } from '@kicable/shared';
import {
  COMMON_AWG_GAUGES,
  COMMON_MM2_GAUGES,
  ISO_6722_COLORS,
  SAE_J1128_COLORS,
  calcBundleDiameter,
  makeId,
} from '@kicable/shared';
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#fff',
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const fieldStyle: React.CSSProperties = { marginBottom: 10 };

const sectionStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid #e2e8f0',
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

// ── Wire properties ──────────────────────────────────────────────────────────
const WireProps: FC<{
  wire: Wire;
  schematic: Schematic;
  editor: UseEditorStateReturn;
}> = ({ wire, schematic, editor }) => {
  const [label, setLabel] = useState(wire.label);
  const [colorHex, setColorHex] = useState(wire.colorHex);
  const [colorName, setColorName] = useState(wire.colorName);
  const [signalName, setSignalName] = useState(wire.signalName);
  const [notes, setNotes] = useState(wire.notes);
  const [gaugeMode, setGaugeMode] = useState<'none' | 'awg' | 'mm2'>(
    wire.gaugeAwg != null ? 'awg' : wire.gaugeMm2 != null ? 'mm2' : 'none',
  );
  const [gaugeAwg, setGaugeAwg] = useState<number | null>(wire.gaugeAwg);
  const [gaugeMm2, setGaugeMm2] = useState<number | null>(wire.gaugeMm2);

  useEffect(() => {
    setLabel(wire.label);
    setColorHex(wire.colorHex);
    setColorName(wire.colorName);
    setSignalName(wire.signalName);
    setNotes(wire.notes);
    setGaugeMode(wire.gaugeAwg != null ? 'awg' : wire.gaugeMm2 != null ? 'mm2' : 'none');
    setGaugeAwg(wire.gaugeAwg);
    setGaugeMm2(wire.gaugeMm2);
  }, [wire]);

  function save() {
    editor.upsertWire({
      ...wire,
      label,
      colorHex,
      colorName,
      signalName,
      notes,
      gaugeAwg: gaugeMode === 'awg' ? gaugeAwg : null,
      gaugeMm2: gaugeMode === 'mm2' ? gaugeMm2 : null,
    });
  }

  function applyColorPreset(code: string) {
    const preset = [...ISO_6722_COLORS, ...SAE_J1128_COLORS].find(
      (c) => c.code === code,
    );
    if (!preset) return;
    setColorHex(preset.hex);
    setColorName(preset.name);
    editor.upsertWire({ ...wire, colorHex: preset.hex, colorName: preset.name });
  }

  // ── Cable assignment ──
  function assignCable(cableId: string | null) {
    editor.upsertWire({ ...wire, label, colorHex, colorName, signalName, notes, cableId });
  }

  function createCable() {
    const cable: Cable = {
      id: makeId<'Cable'>(),
      label: `Cable ${schematic.cables.length + 1}`,
      notes: '',
      fromConnectorId: null,
      toConnectorId: null,
      waypoints: [],
    };
    editor.upsertCable(cable);
    editor.upsertWire({ ...wire, label, colorHex, colorName, signalName, notes, cableId: cable.id });
  }

  // ── Bundle assignment ──
  function assignBundle(bundleId: string | null) {
    editor.upsertWire({ ...wire, label, colorHex, colorName, signalName, notes, bundleId });
  }

  function createBundle() {
    const bundle: Bundle = {
      id: makeId<'Bundle'>(),
      label: `Bundle ${schematic.bundles.length + 1}`,
      notes: '',
      fillRatio: 0.6,
    };
    editor.upsertBundle(bundle);
    editor.upsertWire({ ...wire, label, colorHex, colorName, signalName, notes, bundleId: bundle.id });
  }

  // Bundle outer diameter (if wire is in a bundle)
  const bundleDiameter = useMemo(() => {
    if (!wire.bundleId) return null;
    const bundleWires = schematic.wires.filter((w) => w.bundleId === wire.bundleId);
    return calcBundleDiameter(bundleWires);
  }, [wire.bundleId, schematic.wires]);

  const currentBundle = wire.bundleId
    ? schematic.bundles.find((b) => b.id === wire.bundleId)
    : null;

  const currentCable = wire.cableId
    ? schematic.cables.find((c) => c.id === wire.cableId)
    : null;

  return (
    <>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10, color: '#1e293b' }}>
        Wire
      </div>

      {/* Wire ID (FR-WG-01) */}
      <div style={{ ...fieldStyle, marginBottom: 6 }}>
        <div style={labelStyle}>Wire ID</div>
        <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {wire.id}
        </div>
      </div>

      {/* Label */}
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

      {/* Signal */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Signal (auto-propagates to shared pins)</div>
        <input
          style={inputStyle}
          value={signalName}
          onChange={(e) => setSignalName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="GND, VCC…"
        />
      </div>

      {/* Gauge (FR-WG-01) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Gauge</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2, marginBottom: 4 }}>
          {(['none', 'awg', 'mm2'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setGaugeMode(mode); }}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                border: '1px solid #cbd5e1',
                borderRadius: 3,
                cursor: 'pointer',
                background: gaugeMode === mode ? '#3b82f6' : '#fff',
                color: gaugeMode === mode ? '#fff' : '#374151',
              }}
            >
              {mode === 'none' ? '—' : mode === 'awg' ? 'AWG' : 'mm²'}
            </button>
          ))}
        </div>
        {gaugeMode === 'awg' && (
          <select
            style={selectStyle}
            value={gaugeAwg ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setGaugeAwg(v);
              editor.upsertWire({ ...wire, gaugeAwg: v, gaugeMm2: null });
            }}
          >
            <option value="">— select AWG —</option>
            {COMMON_AWG_GAUGES.map((g) => (
              <option key={g} value={g}>{g} AWG</option>
            ))}
          </select>
        )}
        {gaugeMode === 'mm2' && (
          <select
            style={selectStyle}
            value={gaugeMm2 ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              setGaugeMm2(v);
              editor.upsertWire({ ...wire, gaugeMm2: v, gaugeAwg: null });
            }}
          >
            <option value="">— select mm² —</option>
            {COMMON_MM2_GAUGES.map((g) => (
              <option key={g} value={g}>{g} mm²</option>
            ))}
          </select>
        )}
      </div>

      {/* Color (FR-WG-02) */}
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

      {/* Color standard presets (FR-WG-02) */}
      <div style={fieldStyle}>
        <div style={labelStyle}>Standard color preset</div>
        <select
          style={selectStyle}
          value=""
          onChange={(e) => applyColorPreset(e.target.value)}
        >
          <option value="">— ISO 6722 / SAE J1128 —</option>
          <optgroup label="ISO 6722">
            {ISO_6722_COLORS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="SAE J1128">
            {SAE_J1128_COLORS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Notes */}
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

      {/* Endpoints */}
      <div style={fieldStyle}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {wire.fromEnd.connectorId.slice(0, 8)}… pin {wire.fromEnd.pinNumber}
          {' → '}
          {wire.toEnd.connectorId.slice(0, 8)}… pin {wire.toEnd.pinNumber}
        </div>
      </div>

      {/* ── Cable assignment (FR-WG-05) ── */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, fontSize: 11, color: '#1e293b', marginBottom: 6 }}>
          Cable
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Assign to cable</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <select
              style={{ ...selectStyle, flex: 1 }}
              value={wire.cableId ?? ''}
              onChange={(e) => assignCable(e.target.value || null)}
            >
              <option value="">— none —</option>
              {schematic.cables.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || c.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button
              onClick={createCable}
              title="Create new cable and assign"
              style={{
                padding: '3px 8px',
                fontSize: 10,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                cursor: 'pointer',
                background: '#f8fafc',
                flexShrink: 0,
              }}
            >
              + New
            </button>
          </div>
          {currentCable && (
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
              Cable: {currentCable.label}
              {currentCable.fromConnectorId && currentCable.toConnectorId && (
                <> · routed</>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bundle assignment (FR-WG-03) ── */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, fontSize: 11, color: '#1e293b', marginBottom: 6 }}>
          Bundle
        </div>
        <div style={fieldStyle}>
          <div style={labelStyle}>Assign to bundle</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <select
              style={{ ...selectStyle, flex: 1 }}
              value={wire.bundleId ?? ''}
              onChange={(e) => assignBundle(e.target.value || null)}
            >
              <option value="">— none —</option>
              {schematic.bundles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label || b.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <button
              onClick={createBundle}
              title="Create new bundle and assign"
              style={{
                padding: '3px 8px',
                fontSize: 10,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                cursor: 'pointer',
                background: '#f8fafc',
                flexShrink: 0,
              }}
            >
              + New
            </button>
          </div>
          {currentBundle && (
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>
              {currentBundle.label} · fill {Math.round(currentBundle.fillRatio * 100)}%
              {bundleDiameter != null && (
                <> · OD ≈ {bundleDiameter.toFixed(1)} mm</>
              )}
            </div>
          )}
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
        return w ? <WireProps wire={w} schematic={schematic} editor={editor} /> : null;
      })()}
    </div>
  );
};

export default PropertiesPanel;

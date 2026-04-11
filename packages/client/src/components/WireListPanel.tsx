/**
 * WireListPanel — FR-SN-02
 *
 * Displays all wires in a table with live filter by any column value.
 * Clicking a row calls onSelectWire(wireId) so the canvas can highlight it.
 */

import { type FC, useMemo, useState } from 'react';
import type { ConnectorInstance, Schematic, Wire } from '@kicable/shared';

interface WireRow {
  id: string;
  label: string;
  fromConnectorLabel: string;
  fromPin: string;
  toConnectorLabel: string;
  toPin: string;
  gauge: string;
  colorName: string;
  colorHex: string;
  signalName: string;
  cableLabel: string;
}

function buildRows(schematic: Schematic): WireRow[] {
  const connectorMap = new Map<string, ConnectorInstance>(
    schematic.connectors.map((c) => [c.id, c]),
  );
  const cableMap = new Map(schematic.cables.map((c) => [c.id, c]));

  return schematic.wires.map((w: Wire) => {
    const fromC = connectorMap.get(w.fromEnd.connectorId);
    const toC = connectorMap.get(w.toEnd.connectorId);
    const cable = w.cableId ? cableMap.get(w.cableId) : null;

    return {
      id: w.id,
      label: w.label || w.id.slice(0, 8),
      fromConnectorLabel: fromC?.label || w.fromEnd.connectorId.slice(0, 8),
      fromPin: String(w.fromEnd.pinNumber),
      toConnectorLabel: toC?.label || w.toEnd.connectorId.slice(0, 8),
      toPin: String(w.toEnd.pinNumber),
      gauge: w.gaugeAwg != null ? `${w.gaugeAwg} AWG` : w.gaugeMm2 != null ? `${w.gaugeMm2} mm²` : '—',
      colorName: w.colorName || '—',
      colorHex: w.colorHex,
      signalName: w.signalName || '—',
      cableLabel: cable?.label || '—',
    };
  });
}

function rowMatchesFilter(row: WireRow, filter: string): boolean {
  const f = filter.toLowerCase();
  return (
    row.label.toLowerCase().includes(f) ||
    row.fromConnectorLabel.toLowerCase().includes(f) ||
    row.fromPin.includes(f) ||
    row.toConnectorLabel.toLowerCase().includes(f) ||
    row.toPin.includes(f) ||
    row.gauge.toLowerCase().includes(f) ||
    row.colorName.toLowerCase().includes(f) ||
    row.signalName.toLowerCase().includes(f) ||
    row.cableLabel.toLowerCase().includes(f)
  );
}

interface Props {
  schematic: Schematic;
  /** Currently highlighted wire ID (from canvas selection or search navigation) */
  selectedWireId?: string | null;
  /** Called when user clicks a row */
  onSelectWire: (wireId: string) => void;
}

const COL_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const WireListPanel: FC<Props> = ({ schematic, selectedWireId, onSelectWire }) => {
  const [filter, setFilter] = useState('');

  const allRows = useMemo(() => buildRows(schematic), [schematic]);
  const rows = useMemo(
    () => (filter.trim() ? allRows.filter((r) => rowMatchesFilter(r, filter)) : allRows),
    [allRows, filter],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header + filter */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151' }}>
          Wires
          {rows.length !== allRows.length
            ? ` (${rows.length} / ${allRows.length})`
            : ` (${allRows.length})`}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 7px' }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="8.5" cy="8.5" r="5.5" stroke="#9ca3af" strokeWidth="2" />
            <line x1="13" y1="13" x2="18" y2="18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by any column…"
            aria-label="Filter wires"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8125rem', color: '#111827' }}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, lineHeight: 1, fontSize: '1rem' }}
              aria-label="Clear filter"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {allRows.length === 0 ? (
          <p style={{ padding: '16px', color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
            No wires in schematic yet.
          </p>
        ) : rows.length === 0 ? (
          <p style={{ padding: '16px', color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
            No wires match &ldquo;{filter}&rdquo;.
          </p>
        ) : (
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'auto' }}
            aria-label="Wire list"
          >
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>ID / Label</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>From</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Pin</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>To</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Pin</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Gauge</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Color</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Signal</th>
                <th style={{ ...COL_STYLE, color: '#6b7280', fontWeight: 600 }}>Cable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = row.id === selectedWireId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectWire(row.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    aria-selected={isSelected}
                  >
                    <td style={{ ...COL_STYLE, fontFamily: 'monospace', color: '#374151', maxWidth: 120 }}>{row.label}</td>
                    <td style={{ ...COL_STYLE, color: '#374151', maxWidth: 100 }}>{row.fromConnectorLabel}</td>
                    <td style={{ ...COL_STYLE, color: '#6b7280' }}>{row.fromPin}</td>
                    <td style={{ ...COL_STYLE, color: '#374151', maxWidth: 100 }}>{row.toConnectorLabel}</td>
                    <td style={{ ...COL_STYLE, color: '#6b7280' }}>{row.toPin}</td>
                    <td style={{ ...COL_STYLE, color: '#6b7280' }}>{row.gauge}</td>
                    <td style={{ ...COL_STYLE }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: row.colorHex,
                            border: '1px solid rgba(0,0,0,0.15)',
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        />
                        <span style={{ color: '#374151' }}>{row.colorName}</span>
                      </span>
                    </td>
                    <td style={{ ...COL_STYLE, color: '#374151', maxWidth: 120 }}>{row.signalName}</td>
                    <td style={{ ...COL_STYLE, color: '#6b7280' }}>{row.cableLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WireListPanel;

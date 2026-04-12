/**
 * ComponentEditor — create or edit a component (FR-CL-02, FR-CL-03)
 *
 * Handles:
 *  - Part number, manufacturer, pin count, gender, description
 *  - Per-pin label and function fields
 */

import { useState, type FC, type FormEvent, useEffect } from 'react';
import type { Component, ConnectorPin } from '@kicable/shared';
import type { ComponentId } from '@kicable/shared';

const PIN_FUNCTIONS = ['', 'SIGNAL', 'GND', 'PWR', 'NC', 'SHIELD', 'DATA+', 'DATA-', 'CAN_H', 'CAN_L', 'LIN', 'POWER_IN', 'POWER_OUT'];

interface Props {
  initial?: Component;
  onSave: (draft: Omit<Component, 'id' | 'version' | 'createdAt' | 'updatedAt'> & { id?: string; version?: number; createdAt?: string }) => Promise<void>;
  onCancel: () => void;
}

export const ComponentEditor: FC<Props> = ({ initial, onSave, onCancel }) => {
  const [partNumber, setPartNumber] = useState(initial?.partNumber ?? '');
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '');
  const [pinCount, setPinCount] = useState(initial?.pinCount ?? 2);
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>(initial?.gender ?? 'neutral');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [pins, setPins] = useState<ConnectorPin[]>(
    initial?.pins ?? Array.from({ length: 2 }, (_, i) => ({ number: i + 1, label: '', function: '' })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync pins array length when pinCount changes
  useEffect(() => {
    setPins((prev) => {
      if (pinCount > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: pinCount - prev.length }, (_, i) => ({
            number: prev.length + i + 1,
            label: '',
            function: '',
          })),
        ];
      }
      return prev.slice(0, pinCount);
    });
  }, [pinCount]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!partNumber.trim()) { setError('Part number is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const base = {
        partNumber: partNumber.trim(),
        manufacturer: manufacturer.trim(),
        pinCount,
        pins,
        gender,
        description: description.trim(),
        images: initial?.images ?? [],
        stepFile: initial?.stepFile ?? null,
      } as const;
      await onSave(
        initial
          ? { ...base, id: initial.id as ComponentId, version: initial.version, createdAt: initial.createdAt }
          : base,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updatePin(idx: number, field: 'label' | 'function', value: string) {
    setPins((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#475569', marginBottom: 2, display: 'block' };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'sans-serif' }}
    >
      {/* Part Number + Manufacturer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Part Number *</label>
          <input
            style={inputStyle}
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="e.g. DT04-4P"
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Manufacturer</label>
          <input
            style={inputStyle}
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g. Deutsch"
          />
        </div>
      </div>

      {/* Pin Count + Gender */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Pin Count</label>
          <input
            type="number"
            style={inputStyle}
            min={1}
            max={256}
            value={pinCount}
            onChange={(e) => setPinCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
        <div>
          <label style={labelStyle}>Gender</label>
          <select
            style={{ ...inputStyle }}
            value={gender}
            onChange={(e) => setGender(e.target.value as typeof gender)}
          >
            <option value="neutral">Neutral</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description…"
        />
      </div>

      {/* Per-pin labels (FR-CL-03) */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          Pin Assignments
        </div>
        <div
          style={{
            maxHeight: 240,
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr',
              gap: '4px 8px',
              fontSize: 11,
              color: '#94a3b8',
              marginBottom: 4,
              paddingBottom: 4,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span>#</span>
            <span>Label</span>
            <span>Function</span>
          </div>
          {pins.map((pin, idx) => (
            <div
              key={pin.number}
              style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: '4px 8px', marginBottom: 3 }}
            >
              <span style={{ fontSize: 12, color: '#64748b', paddingTop: 5 }}>{pin.number}</span>
              <input
                style={{ ...inputStyle, fontSize: 12 }}
                value={pin.label}
                onChange={(e) => updatePin(idx, 'label', e.target.value)}
                placeholder="Label"
                maxLength={64}
              />
              <select
                style={{ ...inputStyle, fontSize: 12 }}
                value={pin.function}
                onChange={(e) => updatePin(idx, 'function', e.target.value)}
              >
                {PIN_FUNCTIONS.map((fn) => (
                  <option key={fn} value={fn}>{fn || '—'}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{ padding: '6px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 13 }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 16px',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '6px 16px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Component'}
        </button>
      </div>
    </form>
  );
};

export default ComponentEditor;

/**
 * StepFilePanel — attach / inspect / download a STEP file (FR-CL-15 – FR-CL-19)
 *
 * FR-CL-15  Attach one .step / .stp per component (max 200 MB)
 * FR-CL-16  Warn user when file > 50 MB
 * FR-CL-17  Display filename, size, upload date
 * FR-CL-18  Download button — MIME type model/step, Content-Disposition: attachment
 * FR-CL-19  No in-browser rendering; link to external viewer provided
 */

import { useState, useRef, type FC, type ChangeEvent } from 'react';
import type { Component } from '@kicable/shared';
import type { ComponentId } from '@kicable/shared';
import type { UseLibraryReturn } from './useLibrary.js';

const EXTERNAL_VIEWER_URL = 'https://3dviewer.net/';

interface Props {
  component: Component;
  library: UseLibraryReturn;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const StepFilePanel: FC<Props> = ({ component, library }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const compId = component.id as ComponentId;
  const stepFile = component.stepFile;

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    setWarning(null);
    setUploading(true);
    try {
      const { warnLarge } = await library.attachStep(compId, file);
      if (warnLarge) {
        setWarning(
          `File is ${formatBytes(file.size)} — larger than 50 MB. ` +
            'IndexedDB quota may be affected on some browsers.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Remove the attached STEP file?')) return;
    setError(null);
    try {
      await library.removeStep(compId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    }
  }

  async function handleDownload() {
    setError(null);
    setDownloading(true);
    try {
      await library.downloadStep(compId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#64748b' };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: '#1e293b', fontWeight: 500 };

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 10 }}>
        STEP File
      </div>

      {error && (
        <div
          role="alert"
          style={{ padding: '5px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 12, marginBottom: 8 }}
        >
          {error}
        </div>
      )}

      {warning && (
        <div
          role="status"
          style={{ padding: '5px 8px', background: '#fef9c3', color: '#92400e', borderRadius: 4, fontSize: 12, marginBottom: 8 }}
        >
          {warning}
        </div>
      )}

      {stepFile ? (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '10px 12px',
            background: '#f8fafc',
          }}
        >
          {/* FR-CL-17: metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 8px', marginBottom: 10 }}>
            <span style={labelStyle}>Filename</span>
            <span style={valueStyle}>{stepFile.filename}</span>

            <span style={labelStyle}>Size</span>
            <span style={valueStyle}>{formatBytes(stepFile.sizeBytes)}</span>

            <span style={labelStyle}>Uploaded</span>
            <span style={valueStyle}>{formatDate(stepFile.uploadedAt)}</span>
          </div>

          {/* FR-CL-18: download; FR-CL-19: external viewer link */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownload()}
              style={{
                padding: '5px 14px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: downloading ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {downloading ? 'Downloading…' : 'Download .step'}
            </button>
            <a
              href={EXTERNAL_VIEWER_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '5px 14px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                fontSize: 12,
                color: '#374151',
                textDecoration: 'none',
                display: 'inline-block',
                lineHeight: '1.4',
              }}
              title="Open 3dviewer.net to view STEP files (download first)"
            >
              View externally ↗
            </a>
            <button
              type="button"
              onClick={() => void handleRemove()}
              style={{
                padding: '5px 12px',
                background: '#fff',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '5px 14px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {uploading ? 'Uploading…' : 'Attach .step / .stp'}
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Max 200 MB · warns at 50 MB</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".step,.stp"
        onChange={(e) => void handleUpload(e)}
        style={{ display: 'none' }}
        aria-label="Attach STEP file"
      />
    </div>
  );
};

export default StepFilePanel;

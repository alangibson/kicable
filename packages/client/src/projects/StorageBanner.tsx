/**
 * StorageBanner — dismissable warning when IndexedDB quota is near (FR-PM-04)
 *
 * Listens for the `kicable:storage-near-quota` custom event dispatched by
 * IndexedDBAdapter#warnIfNearQuota.
 */

import { useState, useEffect, type FC } from 'react';

const StorageBanner: FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('kicable:storage-near-quota', handler);
    return () => window.removeEventListener('kicable:storage-near-quota', handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#7c3aed',
        color: '#fff',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1000,
        fontSize: '0.875rem',
      }}
    >
      <span>
        Browser storage is almost full. Export your projects to avoid losing work.
      </span>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss storage warning"
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.5)',
          color: '#fff',
          borderRadius: '0.25rem',
          padding: '0.25rem 0.75rem',
          cursor: 'pointer',
          marginLeft: '1rem',
          fontSize: '0.875rem',
        }}
      >
        Dismiss
      </button>
    </div>
  );
};

export default StorageBanner;

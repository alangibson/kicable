/**
 * GlobalSearch — FR-SN-01
 *
 * Keyboard shortcut: Ctrl+K / Cmd+K opens the search bar.
 * Results are categorised by entity kind and clicking a result calls
 * onNavigateTo(kind, id) so the canvas can pan/zoom to that element.
 */

import {
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type Schematic,
  type SearchResult,
  type SearchResultKind,
  searchSchematic,
} from '@kicable/shared';

interface Props {
  schematic: Schematic;
  /** Called when the user selects a search result */
  onNavigateTo: (kind: SearchResultKind, id: string) => void;
}

const KIND_LABELS: Record<SearchResultKind, string> = {
  connector: 'Connector',
  wire: 'Wire',
  cable: 'Cable',
  signal: 'Signal',
  protective_span: 'Protective Span',
};

const KIND_COLORS: Record<SearchResultKind, string> = {
  connector: '#2563eb',
  wire: '#d97706',
  cable: '#7c3aed',
  signal: '#059669',
  protective_span: '#dc2626',
};

export const GlobalSearch: FC<Props> = ({ schematic, onNavigateTo }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = query.trim() ? searchSchematic(schematic, query) : [];

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    setOpen(true);
    setActiveIdx(0);
  }

  function handleSelect(result: SearchResult) {
    onNavigateTo(result.kind, result.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIdx]) handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const li = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div
      style={{ position: 'relative', flex: '0 1 400px', minWidth: 200 }}
      role="search"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6', borderRadius: 6, padding: '5px 10px', border: '1px solid #e5e7eb' }}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="#9ca3af" strokeWidth="2" />
          <line x1="13" y1="13" x2="18" y2="18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-activedescendant={
            open && results[activeIdx] ? `gsr-${results[activeIdx].id}` : undefined
          }
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search connectors, wires, cables… (Ctrl+K)"
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '0.875rem',
            color: '#111827',
          }}
        />
        {query && (
          <button
            tabIndex={-1}
            onClick={() => { setQuery(''); setOpen(false); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, lineHeight: 1, fontSize: '1rem' }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id="global-search-results"
          role="listbox"
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {results.map((r, idx) => (
            <li
              key={r.id}
              id={`gsr-${r.id}`}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 12px',
                cursor: 'pointer',
                background: idx === activeIdx ? '#eff6ff' : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: KIND_COLORS[r.kind],
                  background: `${KIND_COLORS[r.kind]}18`,
                  borderRadius: 4,
                  padding: '1px 6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {KIND_LABELS[r.kind]}
              </span>
              <span style={{ minWidth: 0, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.subtitle}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim() && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: '12px 16px',
            fontSize: '0.875rem',
            color: '#6b7280',
          }}
        >
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

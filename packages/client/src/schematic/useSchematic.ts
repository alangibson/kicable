import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Cable,
  type ConnectorInstance,
  EMPTY_SCHEMATIC,
  type Project,
  type ProtectiveMaterialSpan,
  type Schematic,
  SchematicSchema,
  type Signal,
  type Wire,
  makeId,
} from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface UseSchematicReturn {
  schematic: Schematic;
  /** Overwrite the entire schematic (e.g. after initial load) */
  setSchematic: (s: Schematic) => void;
  /** Add or update a connector instance */
  upsertConnector: (c: ConnectorInstance) => void;
  removeConnector: (id: string) => void;
  /** Add or update a wire */
  upsertWire: (w: Wire) => void;
  removeWire: (id: string) => void;
  /** Add or update a cable */
  upsertCable: (c: Cable) => void;
  removeCable: (id: string) => void;
  /** Add or update a signal */
  upsertSignal: (s: Signal) => void;
  removeSignal: (id: string) => void;
  /** Add or update a protective span */
  upsertSpan: (p: ProtectiveMaterialSpan) => void;
  removeSpan: (id: string) => void;
  /** True while an auto-save is pending */
  saving: boolean;
  /** Last save error, if any */
  saveError: string | null;
}

function parseSchematic(raw: unknown): Schematic {
  if (!raw) return { ...EMPTY_SCHEMATIC };
  const result = SchematicSchema.safeParse(raw);
  return result.success ? result.data : { ...EMPTY_SCHEMATIC };
}

export function useSchematic(
  project: Project,
  storage: StorageAdapter,
): UseSchematicReturn {
  const [schematic, setSchematicState] = useState<Schematic>(() =>
    parseSchematic(project.schematic),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep a ref to the latest project so the debounced save uses current data
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Debounced auto-save
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = useCallback(
    (nextSchematic: Schematic) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        setSaving(true);
        setSaveError(null);
        try {
          await storage.saveProject({
            ...projectRef.current,
            schematic: nextSchematic,
            meta: {
              ...projectRef.current.meta,
              updatedAt: new Date().toISOString(),
            },
          });
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : 'Auto-save failed');
        } finally {
          setSaving(false);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [storage],
  );

  const setSchematic = useCallback(
    (s: Schematic) => {
      setSchematicState(s);
      scheduleAutoSave(s);
    },
    [scheduleAutoSave],
  );

  // Generic upsert helper
  function upsertIn<T extends { id: string }>(
    list: T[],
    item: T,
  ): T[] {
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx === -1) return [...list, item];
    const copy = [...list];
    copy[idx] = item;
    return copy;
  }

  function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
    return list.filter((x) => x.id !== id);
  }

  const upsertConnector = useCallback(
    (c: ConnectorInstance) => {
      setSchematic({ ...schematic, connectors: upsertIn(schematic.connectors, c) });
    },
    [schematic, setSchematic],
  );
  const removeConnector = useCallback(
    (id: string) => {
      setSchematic({ ...schematic, connectors: removeFrom(schematic.connectors, id) });
    },
    [schematic, setSchematic],
  );

  const upsertWire = useCallback(
    (w: Wire) => {
      setSchematic({ ...schematic, wires: upsertIn(schematic.wires, w) });
    },
    [schematic, setSchematic],
  );
  const removeWire = useCallback(
    (id: string) => {
      setSchematic({ ...schematic, wires: removeFrom(schematic.wires, id) });
    },
    [schematic, setSchematic],
  );

  const upsertCable = useCallback(
    (c: Cable) => {
      setSchematic({ ...schematic, cables: upsertIn(schematic.cables, c) });
    },
    [schematic, setSchematic],
  );
  const removeCable = useCallback(
    (id: string) => {
      setSchematic({ ...schematic, cables: removeFrom(schematic.cables, id) });
    },
    [schematic, setSchematic],
  );

  const upsertSignal = useCallback(
    (s: Signal) => {
      setSchematic({ ...schematic, signals: upsertIn(schematic.signals, s) });
    },
    [schematic, setSchematic],
  );
  const removeSignal = useCallback(
    (id: string) => {
      setSchematic({ ...schematic, signals: removeFrom(schematic.signals, id) });
    },
    [schematic, setSchematic],
  );

  const upsertSpan = useCallback(
    (p: ProtectiveMaterialSpan) => {
      setSchematic({ ...schematic, protectiveSpans: upsertIn(schematic.protectiveSpans, p) });
    },
    [schematic, setSchematic],
  );
  const removeSpan = useCallback(
    (id: string) => {
      setSchematic({ ...schematic, protectiveSpans: removeFrom(schematic.protectiveSpans, id) });
    },
    [schematic, setSchematic],
  );

  return {
    schematic,
    setSchematic,
    upsertConnector,
    removeConnector,
    upsertWire,
    removeWire,
    upsertCable,
    removeCable,
    upsertSignal,
    removeSignal,
    upsertSpan,
    removeSpan,
    saving,
    saveError,
  };
}

// Re-export makeId for use in editor screens
export { makeId };

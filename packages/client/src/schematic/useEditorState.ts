/**
 * useEditorState — schematic state with undo/redo and worker-backed auto-save.
 *
 * FR-SE-08: Undo/redo stack with ≥ 100 steps
 * FR-SE-09: Auto-save on every user action, debounced at 2 s
 * NFR-R-01: Auto-save runs in a background Web Worker
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_SCHEMATIC,
  SchematicSchema,
  propagateSignalName,
  type Bundle,
  type Cable,
  type ConnectorInstance,
  type Project,
  type ProtectiveMaterialSpan,
  type Schematic,
  type Signal,
  type SpliceNode,
  type Wire,
  makeId,
} from '@kicable/shared';
import type { StorageAdapter } from '@kicable/shared';

export { makeId };

const AUTOSAVE_DEBOUNCE_MS = 2000;
const HISTORY_MAX = 100;

export interface UseEditorStateReturn {
  schematic: Schematic;
  /** Replace entire schematic (e.g. after undo/redo or initial load) */
  setSchematic: (s: Schematic) => void;
  /** Mutators — each pushes a history entry */
  upsertConnector: (c: ConnectorInstance) => void;
  removeConnector: (id: string) => void;
  upsertWire: (w: Wire) => void;
  removeWire: (id: string) => void;
  upsertCable: (c: Cable) => void;
  removeCable: (id: string) => void;
  upsertBundle: (b: Bundle) => void;
  removeBundle: (id: string) => void;
  upsertSignal: (s: Signal) => void;
  removeSignal: (id: string) => void;
  upsertSpan: (p: ProtectiveMaterialSpan) => void;
  removeSpan: (id: string) => void;
  upsertSplice: (s: SpliceNode) => void;
  removeSplice: (id: string) => void;
  /** True while an auto-save is in-flight */
  saving: boolean;
  saveError: string | null;
  /** Undo/redo */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function parseSchematic(raw: unknown): Schematic {
  if (!raw) return { ...EMPTY_SCHEMATIC };
  const result = SchematicSchema.safeParse(raw);
  return result.success ? result.data : { ...EMPTY_SCHEMATIC };
}

function upsertIn<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export function useEditorState(
  project: Project,
  storage: StorageAdapter,
): UseEditorStateReturn {
  const [schematic, setSchematicState] = useState<Schematic>(() =>
    parseSchematic(project.schematic),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Undo/redo stacks — entries are schematic snapshots before the change
  const pastRef = useRef<Schematic[]>([]);
  const futureRef = useRef<Schematic[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // trigger re-render for canUndo/canRedo

  // Worker for background saves (NFR-R-01)
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/autosave.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.addEventListener('message', (e: MessageEvent<{ ok: boolean; error?: string }>) => {
      setSaving(false);
      if (!e.data.ok) {
        setSaveError(e.data.error ?? 'Auto-save failed');
      } else {
        setSaveError(null);
      }
    });
    worker.addEventListener('error', () => {
      setSaving(false);
      setSaveError('Auto-save worker error');
    });
    workerRef.current = worker;
    return () => {
      worker.terminate();
    };
  }, []);

  // Keep project ref current so debounced save uses up-to-date meta
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Debounced auto-save timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback: if worker is unavailable, use storage directly
  const scheduleAutoSave = useCallback((nextSchematic: Schematic) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const updatedProject: Project = {
        ...projectRef.current,
        schematic: nextSchematic,
        meta: {
          ...projectRef.current.meta,
          updatedAt: new Date().toISOString(),
        },
      };
      setSaving(true);
      setSaveError(null);
      if (workerRef.current) {
        workerRef.current.postMessage({ project: updatedProject });
      } else {
        // Fallback to direct save if worker is unavailable
        storage
          .saveProject(updatedProject)
          .then(() => {
            setSaving(false);
          })
          .catch((err: unknown) => {
            setSaving(false);
            setSaveError(err instanceof Error ? err.message : 'Auto-save failed');
          });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [storage]);

  /** Commit a change: push current state to history, then update */
  const commit = useCallback(
    (next: Schematic) => {
      pastRef.current = [schematic, ...pastRef.current].slice(0, HISTORY_MAX);
      futureRef.current = [];
      setHistoryVersion((v) => v + 1);
      setSchematicState(next);
      scheduleAutoSave(next);
    },
    [schematic, scheduleAutoSave],
  );

  /** Replace schematic without touching history (used by undo/redo) */
  const setSchematic = useCallback(
    (s: Schematic) => {
      setSchematicState(s);
      scheduleAutoSave(s);
    },
    [scheduleAutoSave],
  );

  const undo = useCallback(() => {
    const [prev, ...rest] = pastRef.current;
    if (!prev) return;
    futureRef.current = [schematic, ...futureRef.current];
    pastRef.current = rest;
    setHistoryVersion((v) => v + 1);
    setSchematicState(prev);
    scheduleAutoSave(prev);
  }, [schematic, scheduleAutoSave]);

  const redo = useCallback(() => {
    const [next, ...rest] = futureRef.current;
    if (!next) return;
    pastRef.current = [schematic, ...pastRef.current].slice(0, HISTORY_MAX);
    futureRef.current = rest;
    setHistoryVersion((v) => v + 1);
    setSchematicState(next);
    scheduleAutoSave(next);
  }, [schematic, scheduleAutoSave]);

  // Mutators
  const upsertConnector = useCallback(
    (c: ConnectorInstance) =>
      commit({ ...schematic, connectors: upsertIn(schematic.connectors, c) }),
    [schematic, commit],
  );
  const removeConnector = useCallback(
    (id: string) =>
      commit({ ...schematic, connectors: removeFrom(schematic.connectors, id) }),
    [schematic, commit],
  );

  const upsertWire = useCallback(
    (w: Wire) => {
      // FR-WG-04: propagate signal name to wires sharing the same connector+pin
      const withWire = { ...schematic, wires: upsertIn(schematic.wires, w) };
      const existing = schematic.wires.find((x) => x.id === w.id);
      const signalChanged = w.signalName !== (existing?.signalName ?? '');
      commit(signalChanged ? propagateSignalName(withWire, w) : withWire);
    },
    [schematic, commit],
  );
  const removeWire = useCallback(
    (id: string) => commit({ ...schematic, wires: removeFrom(schematic.wires, id) }),
    [schematic, commit],
  );

  const upsertCable = useCallback(
    (c: Cable) => commit({ ...schematic, cables: upsertIn(schematic.cables, c) }),
    [schematic, commit],
  );
  const removeCable = useCallback(
    (id: string) => commit({ ...schematic, cables: removeFrom(schematic.cables, id) }),
    [schematic, commit],
  );

  const upsertBundle = useCallback(
    (b: Bundle) => commit({ ...schematic, bundles: upsertIn(schematic.bundles, b) }),
    [schematic, commit],
  );
  const removeBundle = useCallback(
    (id: string) => commit({ ...schematic, bundles: removeFrom(schematic.bundles, id) }),
    [schematic, commit],
  );

  const upsertSignal = useCallback(
    (s: Signal) => commit({ ...schematic, signals: upsertIn(schematic.signals, s) }),
    [schematic, commit],
  );
  const removeSignal = useCallback(
    (id: string) => commit({ ...schematic, signals: removeFrom(schematic.signals, id) }),
    [schematic, commit],
  );

  const upsertSpan = useCallback(
    (p: ProtectiveMaterialSpan) =>
      commit({ ...schematic, protectiveSpans: upsertIn(schematic.protectiveSpans, p) }),
    [schematic, commit],
  );
  const removeSpan = useCallback(
    (id: string) =>
      commit({ ...schematic, protectiveSpans: removeFrom(schematic.protectiveSpans, id) }),
    [schematic, commit],
  );

  const upsertSplice = useCallback(
    (s: SpliceNode) =>
      commit({ ...schematic, spliceNodes: upsertIn(schematic.spliceNodes, s) }),
    [schematic, commit],
  );
  const removeSplice = useCallback(
    (id: string) =>
      commit({ ...schematic, spliceNodes: removeFrom(schematic.spliceNodes, id) }),
    [schematic, commit],
  );

  // historyVersion is read to derive canUndo/canRedo without stale closures
  void historyVersion;

  return {
    schematic,
    setSchematic,
    upsertConnector,
    removeConnector,
    upsertWire,
    removeWire,
    upsertCable,
    removeCable,
    upsertBundle,
    removeBundle,
    upsertSignal,
    removeSignal,
    upsertSpan,
    removeSpan,
    upsertSplice,
    removeSplice,
    saving,
    saveError,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}

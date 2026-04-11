import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import ProjectListScreen from '../../projects/ProjectListScreen.js';
import { IndexedDBAdapter } from '../../storage/IndexedDBAdapter.js';
import type { StorageAdapter } from '@kicable/shared';

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

function renderScreen(storage: StorageAdapter) {
  return render(<ProjectListScreen storage={storage} />);
}

describe('ProjectListScreen', () => {
  it('renders the app title and empty state', async () => {
    renderScreen(new IndexedDBAdapter());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cable Harness Designer');
    await waitFor(() => expect(screen.getByText(/No projects yet/)).toBeInTheDocument());
  });

  it('creates a new project and shows it in the list', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'My Harness' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));

    await waitFor(() => expect(screen.getByText('My Harness')).toBeInTheDocument());
  });

  it('delete button prompts and removes the project', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'Doomed Project' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    await waitFor(() => expect(screen.getByText('Doomed Project')).toBeInTheDocument());

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    await waitFor(() => expect(screen.queryByText('Doomed Project')).not.toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('cancel on delete dialog keeps the project', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'Kept Project' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    await waitFor(() => expect(screen.getByText('Kept Project')).toBeInTheDocument());

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(screen.getByText('Kept Project')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('rename flow updates the project name', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'Old Name' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Rename/i }));
    fireEvent.change(screen.getByDisplayValue('Old Name'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => expect(screen.getByText('New Name')).toBeInTheDocument());
    expect(screen.queryByText('Old Name')).not.toBeInTheDocument();
  });

  it('duplicate creates a copy suffixed with (copy)', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'Original' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    await waitFor(() => expect(screen.getByText('Original')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Duplicate/i }));
    await waitFor(() => expect(screen.getByText('Original (copy)')).toBeInTheDocument());
  });

  it('shows prominent Export .chd button per project', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    fireEvent.change(screen.getByPlaceholderText('New project name…'), {
      target: { value: 'Exportable' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Project/i }));
    await waitFor(() => expect(screen.getByText('Exportable')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Export \.chd/i })).toBeInTheDocument();
  });

  it('shows storage quota warning banner when event fires', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    window.dispatchEvent(new CustomEvent('kicable:storage-near-quota'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is almost full/i);
  });

  it('dismisses the storage warning banner', async () => {
    renderScreen(new IndexedDBAdapter());
    await waitFor(() => screen.getByText(/No projects yet/));

    window.dispatchEvent(new CustomEvent('kicable:storage-near-quota'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

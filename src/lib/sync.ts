import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiFetch } from '@/lib/api';
import { LEGACY_STORAGE_PREFIX, getState, setState } from '@/lib/store';
import { supabase } from '@/lib/supabase/client';
import type { ChatMessage, Note } from '@/lib/types';

/**
 * Cloud sync. The in-memory store stays the source for the UI (so typing is
 * instant). Changes are written in the background:
 *   - notes   → Supabase Postgres table `notes` (protected by row level security)
 *   - chats   → MongoDB through /api/chats (the MongoDB URL never leaves the server)
 */

type NoteRow = {
  id: string;
  title: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

const toRow = (note: Note): NoteRow => ({
  id: note.id,
  title: note.title,
  content: note.content,
  parent_id: note.parentId,
  created_at: note.createdAt,
  updated_at: note.updatedAt,
});

const fromRow = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  content: row.content,
  parentId: row.parent_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Each queue runs one write at a time, so writes arrive in the order they were
// made (for example a sub-note after its parent).
let noteQueue: Promise<void> = Promise.resolve();
let chatQueue: Promise<void> = Promise.resolve();

function reportError(what: string) {
  return (error: unknown) => {
    console.warn(`[sync] ${what}:`, error instanceof Error ? error.message : error);
    setState({ syncError: `Couldn't ${what}. Check your connection.` });
  };
}

function enqueueNote(task: () => Promise<void>) {
  noteQueue = noteQueue.then(task).catch(reportError('save notes'));
}

function enqueueChat(task: () => Promise<void>) {
  chatQueue = chatQueue.then(task).catch(reportError('save chat'));
}

async function checkResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`HTTP ${response.status} ${body?.error ?? ''}`.trim());
  }
}

// Notes

/** Typing into a note fires many updates; wait for a pause before saving. */
const NOTE_SAVE_DELAY_MS = 700;
const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function upsertNoteNow(id: string) {
  const timer = noteTimers.get(id);
  if (timer) clearTimeout(timer);
  noteTimers.delete(id);
  enqueueNote(async () => {
    const note = getState().notes.find((n) => n.id === id);
    if (!note) return; // Deleted before the save ran.
    const { error } = await supabase.from('notes').upsert(toRow(note));
    if (error) throw error;
    setState({ syncError: null });
  });
}

export function syncNoteCreated(id: string) {
  upsertNoteNow(id);
}

export function syncNoteChanged(id: string) {
  const existing = noteTimers.get(id);
  if (existing) clearTimeout(existing);
  noteTimers.set(
    id,
    setTimeout(() => upsertNoteNow(id), NOTE_SAVE_DELAY_MS)
  );
}

/** Children are removed by the database too (ON DELETE CASCADE). */
export function syncNotesDeleted(ids: string[]) {
  for (const id of ids) {
    const timer = noteTimers.get(id);
    if (timer) clearTimeout(timer);
    noteTimers.delete(id);
  }
  enqueueNote(async () => {
    const { error } = await supabase.from('notes').delete().in('id', ids);
    if (error) throw error;
  });
}

// Chat

export function syncMessageAdded(message: ChatMessage) {
  enqueueChat(async () => {
    await checkResponse(await apiFetch('/api/chats', { method: 'POST', body: JSON.stringify({ message }) }));
    setState({ syncError: null });
  });
}

export function syncChatCleared() {
  enqueueChat(async () => {
    await checkResponse(await apiFetch('/api/chats', { method: 'DELETE' }));
  });
}

// Loading and signing out

/** Notes and chats saved on this device before accounts existed. Uploaded once, then removed. */
async function importLegacyData(): Promise<{ notes: Note[]; messages: ChatMessage[] }> {
  const notesKey = `${LEGACY_STORAGE_PREFIX}notes`;
  const messagesKey = `${LEGACY_STORAGE_PREFIX}messages`;
  const [[, rawNotes], [, rawMessages]] = await AsyncStorage.multiGet([notesKey, messagesKey]);
  const parse = <T,>(raw: string | null): T[] => {
    try {
      const value = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const notes = parse<Note>(rawNotes);
  const messages = parse<ChatMessage>(rawMessages);

  if (notes.length) {
    const ids = new Set(notes.map((n) => n.id));
    // Drop links to parents that no longer exist so the foreign key accepts them.
    const rows = notes.map((n) => toRow({ ...n, parentId: n.parentId && ids.has(n.parentId) ? n.parentId : null }));
    const { error } = await supabase.from('notes').upsert(rows);
    if (error) throw error;
    await AsyncStorage.removeItem(notesKey);
  }
  if (messages.length) {
    await checkResponse(
      await apiFetch('/api/chats', { method: 'POST', body: JSON.stringify({ messages: messages.slice(-300) }) })
    );
    await AsyncStorage.removeItem(messagesKey);
  }
  return { notes, messages };
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const localIds = new Set(local.map((item) => item.id));
  return [...remote.filter((item) => !localIds.has(item.id)), ...local];
}

/** Load the signed-in user's notes and chats into the store. */
export async function loadUserData() {
  try {
    const legacy = await importLegacyData().catch((error) => {
      reportError('import notes saved on this device')(error);
      return { notes: [], messages: [] };
    });

    const [notesResult, chatsResponse] = await Promise.all([
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      apiFetch('/api/chats'),
    ]);
    if (notesResult.error) throw notesResult.error;
    await checkResponse(chatsResponse);
    const { messages } = (await chatsResponse.json()) as { messages: ChatMessage[] };

    // Keep anything created locally while the load was in flight.
    setState((s) => ({
      notes: mergeById((notesResult.data as NoteRow[]).map(fromRow), mergeById(legacy.notes, s.notes)),
      messages: mergeById(messages, mergeById(legacy.messages, s.messages)).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      ),
      syncError: null,
    }));
  } catch (error) {
    reportError('load your notes and chats')(error);
  }
}

/** Save anything still waiting, so signing out doesn't lose the last edits. */
export async function flushPendingWrites() {
  for (const id of [...noteTimers.keys()]) upsertNoteNow(id);
  await Promise.all([noteQueue, chatQueue]);
}

/** Forget the previous user's data when they sign out. */
export function clearUserData() {
  for (const timer of noteTimers.values()) clearTimeout(timer);
  noteTimers.clear();
  setState({ notes: [], messages: [], pending: null, syncError: null, assistantMode: null });
}

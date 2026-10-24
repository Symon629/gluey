import type { Note } from '@/lib/types';

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(my|the|a|an|note|notes|list)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find the note a user most likely means by a spoken title ("my groceries note" → "Groceries"). */
export function findNoteByTitle(notes: Note[], title: string | null | undefined): Note | null {
  if (!title) return null;
  const wanted = normalize(title);
  if (!wanted) return null;
  const scored = notes
    .map((note) => {
      const name = normalize(note.title);
      let score = 0;
      if (name === wanted) score = 100;
      else if (name.startsWith(wanted) || wanted.startsWith(name)) score = 70;
      else if (name.includes(wanted) || wanted.includes(name)) score = 50;
      else {
        const a = new Set(name.split(' '));
        const b = wanted.split(' ');
        const overlap = b.filter((word) => a.has(word)).length;
        score = overlap > 0 ? (overlap / Math.max(a.size, b.length)) * 40 : 0;
      }
      return { note, score };
    })
    .filter(({ score }) => score >= 20)
    .sort((x, y) => y.score - x.score || y.note.updatedAt.localeCompare(x.note.updatedAt));
  return scored[0]?.note ?? null;
}

export function childrenOf(notes: Note[], parentId: string | null): Note[] {
  return notes
    .filter((note) => note.parentId === parentId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function descendantIds(notes: Note[], id: string): string[] {
  const result: string[] = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const note of notes) {
      if (note.parentId === current) {
        result.push(note.id);
        stack.push(note.id);
      }
    }
  }
  return result;
}

export function ancestors(notes: Note[], id: string): Note[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const chain: Note[] = [];
  let current = byId.get(id)?.parentId ?? null;
  while (current && chain.length < 20) {
    const parent = byId.get(current);
    if (!parent) break;
    chain.unshift(parent);
    current = parent.parentId;
  }
  return chain;
}

/** First line of content, for list previews. */
export function preview(note: Note): string {
  return note.content.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Pick a short title from free text when the user didn't name the note. */
export function titleFromContent(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  const words = firstLine.split(/\s+/).slice(0, 6).join(' ');
  const title = words.length < firstLine.length ? `${words}…` : words;
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Untitled';
}

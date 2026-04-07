import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const DEFAULT_NOTE_BODY = `## Subheading

Use **bold**, *italic*, \`inline code\`, and lists.

- First item
- Second item

\`\`\`js
// Fenced blocks
console.log("hello");
\`\`\`
`;

interface NotesState {
  notes: NoteItem[];
  todos: TodoItem[];
  /** Set when opening Notes from chat so the new note is selected after navigation. */
  pendingSelectNoteId: string | null;
  addNote: () => string;
  createNoteWithTitle: (title: string) => string;
  /** Create a note from assistant markdown (body only); title derived from first line. */
  createNoteFromAssistantResponse: (markdownBody: string) => string;
  setPendingSelectNoteId: (id: string | null) => void;
  updateNote: (id: string, partial: Partial<Pick<NoteItem, "title" | "body">>) => void;
  removeNote: (id: string) => void;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
}

function deriveNoteTitleFromMarkdown(body: string): string {
  const firstLine =
    body
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  let t = firstLine.replace(/^#{1,6}\s+/, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  if (!t) return "From chat";
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
}

function newId(): string {
  return crypto.randomUUID();
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      todos: [],
      pendingSelectNoteId: null,

      addNote: () => {
        const id = newId();
        const now = Date.now();
        set((s) => ({
          notes: [
            { id, title: "Untitled", body: "", updatedAt: now },
            ...s.notes,
          ],
        }));
        return id;
      },

      createNoteFromAssistantResponse: (markdownBody) => {
        const id = newId();
        const now = Date.now();
        const body = markdownBody.trim();
        const title = deriveNoteTitleFromMarkdown(body);
        set((s) => ({
          notes: [
            {
              id,
              title,
              body: body || "",
              updatedAt: now,
            },
            ...s.notes,
          ],
        }));
        return id;
      },

      setPendingSelectNoteId: (pendingSelectNoteId) => set({ pendingSelectNoteId }),

      createNoteWithTitle: (title) => {
        const id = newId();
        const now = Date.now();
        const t = title.trim() || "Untitled";
        set((s) => ({
          notes: [
            {
              id,
              title: t,
              body: DEFAULT_NOTE_BODY,
              updatedAt: now,
            },
            ...s.notes,
          ],
        }));
        return id;
      },

      updateNote: (id, partial) => {
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...partial,
                  updatedAt: Date.now(),
                }
              : n,
          ),
        }));
      },

      removeNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      },

      addTodo: (text) => {
        const t = text.trim();
        if (!t) return;
        set((s) => ({
          todos: [...s.todos, { id: newId(), text: t, done: false }],
        }));
      },

      toggleTodo: (id) => {
        set((s) => ({
          todos: s.todos.map((x) =>
            x.id === id ? { ...x, done: !x.done } : x,
          ),
        }));
      },

      removeTodo: (id) => {
        set((s) => ({ todos: s.todos.filter((x) => x.id !== id) }));
      },
    }),
    {
      name: "athena-notes-v1",
      partialize: (s) => ({ notes: s.notes, todos: s.todos }),
    },
  ),
);

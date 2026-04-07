import * as Dialog from "@radix-ui/react-dialog";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Bold,
  Code,
  FileCode,
  Heading2,
  Heading3,
  Italic,
  List,
  Eye,
  PencilLine,
  PanelRight,
  Plus,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  glassModalContentPositionWideClasses,
  glassModalOverlayClasses,
  glassModalPanelClasses,
} from "../../lib/appCanvasGlass";
import { cn } from "../../lib/utils";
import { useNotesStore } from "../../store/notesStore";
import { useUiStore } from "../../store/uiStore";
import { NoteMarkdownPreview } from "./NoteMarkdownPreview";
import { useMediaQuery, usePanelResize } from "./usePanelResize";
import { readTextFile } from "@tauri-apps/plugin-fs";

const LS_TODO_W = "athena-notes-todo-width";
const LS_LIST_W = "athena-notes-list-width";
const LS_TODO_STACK_H = "athena-notes-todo-stack-height";

function loadNum(key: string, fallback: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  } catch {
    /* ignore */
  }
  return fallback;
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function CreateNoteModal({
  open: modalOpen,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (modalOpen) setTitle("");
  }, [modalOpen]);

  const submit = () => {
    onCreate(title.trim() || "Untitled");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={modalOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={glassModalOverlayClasses} />
        <Dialog.Content
          className={glassModalContentPositionWideClasses}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn(glassModalPanelClasses, "overflow-hidden px-5 pb-5 pt-6")}>
            <Dialog.Title className="text-center text-[1.05rem] font-medium tracking-[-0.02em] text-[var(--app-text)]">
              New note
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-center text-[12px] leading-relaxed text-[var(--app-muted)]">
              Choose a title — you’ll write in the note canvas with formatting tools.
            </Dialog.Description>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  Title
                </span>
                <input
                  type="text"
                  className={cn(
                    "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[14px] text-[var(--app-text)] outline-none transition",
                    "border-[var(--app-text)]/10 placeholder:text-[var(--app-muted)]/70",
                    "focus:border-[var(--app-text)]/22 focus:ring-1 focus:ring-[var(--app-text)]/10",
                  )}
                  placeholder="Note title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  autoComplete="off"
                  autoFocus
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--app-muted)] transition hover:bg-[var(--app-text)]/[0.06] hover:text-[var(--app-text)]"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  className="rounded-lg bg-black px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-neutral-900 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  onClick={submit}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function NotesPanel() {
  const notes = useNotesStore((s) => s.notes);
  const todos = useNotesStore((s) => s.todos);
  const createNoteWithTitle = useNotesStore((s) => s.createNoteWithTitle);
  const updateNote = useNotesStore((s) => s.updateNote);
  const removeNote = useNotesStore((s) => s.removeNote);
  const addTodo = useNotesStore((s) => s.addTodo);
  const toggleTodo = useNotesStore((s) => s.toggleTodo);
  const removeTodo = useNotesStore((s) => s.removeTodo);
  const pushToast = useUiStore((s) => s.pushToast);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [todoInput, setTodoInput] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [todoExpanded, setTodoExpanded] = useState(true);
  const [noteMode, setNoteMode] = useState<"edit" | "preview">("edit");
  const [todoWidth, setTodoWidth] = useState(280);
  const [notesListWidth, setNotesListWidth] = useState(208);
  const [todoStackHeight, setTodoStackHeight] = useState(240);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  /** Preserved when toolbar steals focus (backup if selection reads as 0,0). */
  const savedSelRef = useRef({ start: 0, end: 0 });
  // Write mode uses a normal textarea so typing/deleting behaves like Obsidian/Sublime.

  useEffect(() => {
    setTodoWidth(loadNum(LS_TODO_W, 280, 200, 520));
    setNotesListWidth(loadNum(LS_LIST_W, 208, 160, 400));
    setTodoStackHeight(loadNum(LS_TODO_STACK_H, 240, 160, 480));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TODO_W, String(todoWidth));
    } catch {
      /* ignore */
    }
  }, [todoWidth]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_LIST_W, String(notesListWidth));
    } catch {
      /* ignore */
    }
  }, [notesListWidth]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_TODO_STACK_H, String(todoStackHeight));
    } catch {
      /* ignore */
    }
  }, [todoStackHeight]);

  const onTodoWidthDelta = useCallback((d: number) => {
    setTodoWidth((w) => Math.max(200, Math.min(520, w - d)));
  }, []);
  const onNotesListWidthDelta = useCallback((d: number) => {
    setNotesListWidth((w) => Math.max(160, Math.min(400, w + d)));
  }, []);
  const onTodoStackHeightDelta = useCallback((d: number) => {
    setTodoStackHeight((h) => Math.max(160, Math.min(480, h + d)));
  }, []);

  const todoColResize = usePanelResize("y", onTodoStackHeightDelta, {
    disabled: !todoExpanded,
  });
  const todoRowResize = usePanelResize("x", onTodoWidthDelta, {
    disabled: !todoExpanded,
  });
  const notesListResize = usePanelResize("x", onNotesListWidthDelta);
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isMd = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    const init = () => {
      const st = useNotesStore.getState();
      const pending = st.pendingSelectNoteId;
      if (pending && st.notes.some((n) => n.id === pending)) {
        st.setPendingSelectNoteId(null);
        setActiveId(pending);
        setCreateModalOpen(false);
        return;
      }
      if (st.notes.length === 0) {
        setActiveId(null);
        setCreateModalOpen(true);
      } else {
        setActiveId((prev) => prev ?? st.notes[0]!.id);
        setCreateModalOpen(false);
      }
    };
    if (useNotesStore.persist.hasHydrated()) {
      init();
    } else {
      return useNotesStore.persist.onFinishHydration(() => init());
    }
  }, []);

  useEffect(() => {
    if (noteMode !== "edit") return;
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
    });
  }, [noteMode, activeId]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const onWikiLink = useCallback(
    (page: string) => {
      const key = slugify(page);
      if (!key) return;
      const match = notes.find((n) => slugify(n.title) === key);
      if (match) {
        setActiveId(match.id);
        setNoteMode("preview");
        return;
      }
      pushToast(`No note found for "${page}"`, "info");
    },
    [notes, pushToast],
  );

  const onTagClick = useCallback(
    (tag: string) => {
      if (!tag.trim()) return;
      pushToast(`Tag: #${tag}`, "info");
    },
    [pushToast],
  );

  const importFromFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Markdown", extensions: ["md"] },
          { name: "JSON", extensions: ["json"] },
        ],
      });
      if (typeof selected !== "string" || !selected) return;

      const raw = await readTextFile(selected);
      const fileName = selected.split(/[\\/]/).pop() ?? "Imported";
      const base = fileName.replace(/\.(md|json)$/i, "") || "Imported";
      const ext = (fileName.split(".").pop() ?? "").toLowerCase();

      const body =
        ext === "json" ? `\`\`\`json\n${raw}\n\`\`\`` : raw;

      const id = createNoteWithTitle(base);
      updateNote(id, { title: base, body });
      setActiveId(id);
      setCreateModalOpen(false);
      setNoteMode("preview");
      pushToast(`Imported ${fileName}`, "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [createNoteWithTitle, pushToast, updateNote]);

  useEffect(() => {
    if (activeId && !notes.some((n) => n.id === activeId)) {
      setActiveId(notes[0]?.id ?? null);
    }
    if (!activeId && notes[0]) {
      setActiveId(notes[0].id);
    }
  }, [notes, activeId]);

  const mutateBodyAtSelection = useCallback(
    (compute: (body: string, start: number, end: number) => { next: string; cursor: number }) => {
      if (!active || !bodyRef.current) return;
      const el = bodyRef.current;
      const useSaved = document.activeElement !== el;
      const start = useSaved ? savedSelRef.current.start : el.selectionStart;
      const end = useSaved ? savedSelRef.current.end : el.selectionEnd;
      const { next, cursor } = compute(active.body, start, end);
      updateNote(active.id, { body: next });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(cursor, cursor);
        savedSelRef.current = { start: cursor, end: cursor };
      });
    },
    [active, updateNote],
  );

  const insertAtCursor = useCallback(
    (snippet: string) => {
      mutateBodyAtSelection((body, start, end) => ({
        next: body.slice(0, start) + snippet + body.slice(end),
        cursor: start + snippet.length,
      }));
    },
    [mutateBodyAtSelection],
  );

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      mutateBodyAtSelection((body, start, end) => {
        const sel = body.slice(start, end);
        const next = body.slice(0, start) + before + sel + after + body.slice(end);
        if (sel.length === 0) {
          const c = start + before.length;
          return { next, cursor: c };
        }
        return { next, cursor: start + before.length + sel.length + after.length };
      });
    },
    [mutateBodyAtSelection],
  );

  const insertCodeFence = useCallback(() => {
    mutateBodyAtSelection((body, start, end) => {
      const prefix = start > 0 && body[start - 1] !== "\n" ? "\n" : "";
      const snippet = `${prefix}\`\`\`\n\n\`\`\``;
      const at = start + prefix.length;
      const next = body.slice(0, start) + snippet + body.slice(end);
      const cursor = at + 4;
      return { next, cursor };
    });
  }, [mutateBodyAtSelection]);

  useEffect(() => {
    if (!active) return;
    const len = active.body.length;
    savedSelRef.current = { start: len, end: len };
  }, [active?.id]);

  const submitTodo = (e: React.FormEvent) => {
    e.preventDefault();
    addTodo(todoInput);
    setTodoInput("");
  };

  const openCreateModal = () => setCreateModalOpen(true);

  const handleCreated = (title: string) => {
    const id = createNoteWithTitle(title);
    setActiveId(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-0 overflow-hidden p-4 md:flex-row md:items-stretch">
      <CreateNoteModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreated}
      />

      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] md:min-w-[200px]",
          todoExpanded && !isMd && "rounded-b-none border-b-0",
          todoExpanded && isMd && "md:rounded-r-none md:border-r-0",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Notes</h2>
            <p className="mt-0.5 text-xs text-[var(--app-muted)]">
              One canvas — Markdown, with quick formatting when you need it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void importFromFile()}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] hover:bg-black/[0.04] dark:hover:bg-white/5"
              title="Import .md or .json"
            >
              <Code className="h-3.5 w-3.5" strokeWidth={2} />
              Import
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] hover:bg-black/[0.04] dark:hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New note
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside
            className={cn(
              "max-h-36 shrink-0 overflow-y-auto border-b border-[var(--app-border)]",
              "w-full lg:max-h-none lg:border-b-0 lg:border-r lg:shrink-0",
            )}
            style={isLg ? { width: notesListWidth, minWidth: 160, maxWidth: 400 } : undefined}
          >
            <ul className="p-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(n.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-mono text-[12px] transition",
                      n.id === active?.id
                        ? "bg-[var(--sidebar-active)] font-medium text-[var(--app-text)]"
                        : "text-[var(--app-muted)] hover:bg-black/[0.04] hover:text-[var(--app-text)] dark:hover:bg-white/5",
                    )}
                  >
                    <span className="truncate">{n.title.trim() || "Untitled"}</span>
                  </button>
                </li>
              ))}
            </ul>
            {notes.length === 0 ? (
              <p className="px-3 pb-3 text-center text-[11px] text-[var(--app-muted)]">
                No notes yet.
              </p>
            ) : null}
          </aside>

          <div
            role="separator"
            aria-orientation="vertical"
            title="Resize note list"
            className="group relative hidden shrink-0 cursor-col-resize self-stretch lg:block lg:w-3"
            {...notesListResize}
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--app-border)] group-hover:bg-accent/50" />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {active ? (
              <>
                <div className="border-b border-[var(--app-border)] px-4 py-3">
                  <input
                    value={active.title}
                    onChange={(e) => updateNote(active.id, { title: e.target.value })}
                    placeholder="Title"
                    className="w-full border-none bg-transparent text-2xl font-bold tracking-tight text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                  />
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-[var(--app-border)] px-2 py-2 md:px-3">
                    {(
                      [
                        { icon: Heading2, label: "Heading 2", onClick: () => insertAtCursor("## ") },
                        { icon: Heading3, label: "Heading 3", onClick: () => insertAtCursor("### ") },
                        { icon: Bold, label: "Bold", onClick: () => wrapSelection("**", "**") },
                        { icon: Italic, label: "Italic", onClick: () => wrapSelection("*", "*") },
                        { icon: List, label: "List", onClick: () => insertAtCursor("- ") },
                        { icon: Code, label: "Inline code", onClick: () => wrapSelection("`", "`") },
                        {
                          icon: FileCode,
                          label: "Code block",
                          onClick: () => insertCodeFence(),
                        },
                      ] as const
                    ).map(({ icon: Icon, label, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        title={label}
                      disabled={noteMode !== "edit"}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onClick();
                          bodyRef.current?.focus();
                        }}
                      className="rounded-lg p-2 text-[var(--app-muted)] transition hover:bg-black/[0.06] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10"
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ))}

                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setNoteMode("edit")}
                      className={cn(
                        "rounded-lg p-2 transition hover:bg-black/[0.06] hover:text-[var(--app-text)]",
                        noteMode === "edit" ? "text-[var(--app-text)]" : "text-[var(--app-muted)]",
                      )}
                      aria-label="Write mode"
                      title="Write"
                    >
                      <PencilLine className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setNoteMode("preview")}
                      className={cn(
                        "rounded-lg p-2 transition hover:bg-black/[0.06] hover:text-[var(--app-text)]",
                        noteMode === "preview" ? "text-[var(--app-text)]" : "text-[var(--app-muted)]",
                      )}
                      aria-label="Preview mode"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {noteMode === "edit" ? (
                      <textarea
                        ref={bodyRef}
                        value={active.body}
                        onChange={(e) => updateNote(active.id, { body: e.target.value })}
                        onSelect={(e) => {
                          const t = e.currentTarget;
                          savedSelRef.current = { start: t.selectionStart, end: t.selectionEnd };
                        }}
                        onBlur={(e) => {
                          const t = e.currentTarget;
                          savedSelRef.current = { start: t.selectionStart, end: t.selectionEnd };
                        }}
                        onKeyUp={(e) => {
                          const t = e.currentTarget;
                          savedSelRef.current = { start: t.selectionStart, end: t.selectionEnd };
                        }}
                        placeholder="Start writing…"
                        spellCheck
                        className={cn(
                          "note-writing-canvas min-h-0 h-full w-full resize-none bg-transparent px-4 py-6 text-[15px] leading-[1.65] text-[var(--app-text)] outline-none",
                          "placeholder:text-[var(--app-muted)] selection:bg-accent/15 md:px-8 md:py-8",
                          "focus-visible:ring-0",
                        )}
                      />
                    ) : (
                      <div className="min-h-0 h-full overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                        <NoteMarkdownPreview
                          markdown={active.body}
                          className="text-[15px] leading-[1.65]"
                          onWikiLink={onWikiLink}
                          onTagClick={onTagClick}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t border-[var(--app-border)] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const i = notes.findIndex((n) => n.id === active.id);
                      const nextId = notes[i + 1]?.id ?? notes[i - 1]?.id ?? null;
                      removeNote(active.id);
                      setActiveId(nextId);
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dropdown-danger)] hover:bg-[var(--dropdown-danger)]/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete note
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="max-w-sm text-sm text-[var(--app-muted)]">
                  Create a note to get started. Your notes stay on this device.
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-900 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Create note
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-2xl border shadow-sm transition-[width,height] duration-300 ease-out",
          todoExpanded
            ? "w-full min-h-0 md:w-auto"
            : "h-14 w-full md:h-full md:min-h-0 md:w-[72px] md:min-w-[72px] md:max-w-[72px]",
          todoExpanded && !isMd && "rounded-t-none",
          todoExpanded && isMd && "md:rounded-l-none",
        )}
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
          ...(todoExpanded && isMd ? { width: todoWidth, minWidth: 200, maxWidth: 520 } : {}),
          ...(todoExpanded && !isMd ? { height: todoStackHeight, minHeight: 160, maxHeight: 480 } : {}),
        }}
      >
        {todoExpanded ? (
          <>
            <div
              role="separator"
              aria-orientation="horizontal"
              title="Resize notes / to-do"
              className="group absolute left-0 right-0 top-0 z-10 h-3 -translate-y-1/2 cursor-row-resize md:hidden"
              {...todoColResize}
            >
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--app-border)] group-hover:bg-accent/50" />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              title="Resize notes / to-do"
              className="group absolute bottom-0 left-0 top-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize md:block"
              {...todoRowResize}
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--app-border)] group-hover:bg-accent/50" />
            </div>
            <div
              className="flex shrink-0 items-center gap-2 border-b px-3 py-3"
              style={{ borderColor: "var(--sidebar-border)" }}
            >
              <div className="min-w-0 flex-1">
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--sidebar-text)" }}
                >
                  To-do
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: "var(--sidebar-muted)" }}>
                  Quick tasks — stored on this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTodoExpanded(false)}
                className="shrink-0 rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
                style={{ color: "var(--sidebar-muted)" }}
                title="Collapse to-do"
                aria-label="Collapse to-do"
              >
                <PanelRight className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <ul className="space-y-1">
                {todos.map((t) => (
                  <li
                    key={t.id}
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTodo(t.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--sidebar-border)] text-accent"
                      aria-label={t.done ? "Mark incomplete" : "Mark done"}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        t.done
                          ? "text-[var(--sidebar-muted)] line-through"
                          : "text-[var(--sidebar-text)]",
                      )}
                    >
                      {t.text}
                    </span>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeTodo(t.id)}
                      className="shrink-0 rounded p-1 text-[var(--sidebar-muted)] opacity-0 transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--dropdown-danger)] group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
              {todos.length === 0 ? (
                <p
                  className="px-2 py-4 text-center text-xs"
                  style={{ color: "var(--sidebar-muted)" }}
                >
                  No tasks yet. Add one below.
                </p>
              ) : null}
            </div>
            <form
              onSubmit={submitTodo}
              className="border-t p-3"
              style={{ borderColor: "var(--sidebar-border)" }}
            >
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                placeholder="Add a task…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none placeholder:text-[var(--sidebar-muted)] focus:border-[var(--sidebar-muted)]"
                style={{
                  borderColor: "var(--sidebar-input-border)",
                  background: "var(--sidebar-input-bg)",
                  color: "var(--sidebar-text)",
                }}
              />
            </form>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 py-3">
            <button
              type="button"
              onClick={() => setTodoExpanded(true)}
              className="rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
              style={{ color: "var(--sidebar-muted)" }}
              title="Expand to-do"
              aria-label="Expand to-do"
            >
              <PanelRight className="h-5 w-5" />
            </button>
            <SquareCheck
              className="hidden h-[18px] w-[18px] shrink-0 stroke-[1.75] md:block"
              style={{ color: "var(--sidebar-muted)" }}
              aria-hidden
            />
            <span className="sr-only">To-do</span>
          </div>
        )}
      </section>
    </div>
  );
}

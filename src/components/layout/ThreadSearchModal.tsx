import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpDown, CornerDownLeft, PlusCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Thread } from "../../types/chat";
import {
  glassModalContentPositionClasses,
  glassModalOverlayClasses,
  glassModalPanelClasses,
} from "../../lib/appCanvasGlass";
import { cn } from "../../lib/utils";

type Row =
  | { kind: "new" }
  | { kind: "thread"; thread: Thread };

export function ThreadSearchModal({
  open,
  onOpenChange,
  threads,
  onSelectThread,
  onNewChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threads: Thread[];
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  const rows: Row[] = useMemo(
    () => [{ kind: "new" }, ...filtered.map((t) => ({ kind: "thread" as const, thread: t }))],
    [filtered],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const activate = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      if (row.kind === "new") {
        onNewChat();
      } else {
        onSelectThread(row.thread.id);
      }
      close();
    },
    [rows, onNewChat, onSelectThread, close],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        activate(highlight);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows.length, highlight, activate]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={glassModalOverlayClasses} />
        <Dialog.Content
          className={glassModalContentPositionClasses}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn(glassModalPanelClasses, "overflow-hidden p-0")}>
            <Dialog.Title className="sr-only">Search threads</Dialog.Title>
            <Dialog.Description className="sr-only">
              Filter chats or start a new conversation. Use arrow keys to navigate, Enter to select,
              Escape to close.
            </Dialog.Description>

            <div className="flex items-center gap-2.5 border-b border-[var(--app-text)]/[0.08] px-3 py-2.5 dark:border-white/12">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--app-muted)] opacity-80"
                strokeWidth={1.75}
              />
              <input
                ref={inputRef}
                type="text"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] placeholder:opacity-70"
                placeholder="Search threads…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

            <div className="max-h-[min(42vh,280px)] overflow-y-auto px-1.5 py-1.5">
              <ul className="space-y-0.5" role="listbox">
                {rows.map((row, i) => (
                  <li key={row.kind === "new" ? "__new__" : row.thread.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug transition",
                        i === highlight
                          ? "bg-[var(--app-text)]/[0.08] text-[var(--app-text)] dark:bg-white/[0.12]"
                          : "text-[var(--app-text)] hover:bg-[var(--app-text)]/[0.05] dark:hover:bg-white/[0.06]",
                      )}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => activate(i)}
                    >
                      {row.kind === "new" ? (
                        <>
                          <PlusCircle
                            className="h-4 w-4 shrink-0 text-[var(--app-muted)] opacity-80"
                            strokeWidth={1.75}
                          />
                          <span className="font-medium">New chat</span>
                        </>
                      ) : (
                        <span className="min-w-0 flex-1 truncate">{row.thread.title}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--app-text)]/[0.08] px-3 py-1.5 text-[10px] text-[var(--app-muted)] dark:border-white/10">
              <span className="inline-flex items-center gap-1 opacity-90">
                <ArrowUpDown className="h-3 w-3 shrink-0" strokeWidth={2} />
                navigate
              </span>
              <span className="inline-flex items-center gap-1 opacity-90">
                <CornerDownLeft className="h-3 w-3 shrink-0" strokeWidth={2} />
                open
              </span>
              <span className="inline-flex items-center gap-1 opacity-90">
                <kbd className="rounded border border-[var(--app-text)]/15 bg-[var(--app-text)]/[0.05] px-1 py-px font-mono text-[9px] dark:border-white/20 dark:bg-white/[0.06]">
                  esc
                </kbd>
                close
              </span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pencil, Pin, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Project } from "../../types/chat";
import {
  sidebarGlassMenuContent,
  sidebarGlassMenuItem,
  sidebarGlassMenuSeparator,
} from "../../lib/sidebarGlassMenu";
import { cn } from "../../lib/utils";
import { readThreadIdsFromDataTransfer } from "../../lib/threadDrag";
import { useChatStore } from "../../store/chatStore";
import { useUiStore } from "../../store/uiStore";

const menuIcon = "h-3.5 w-3.5 shrink-0 opacity-85";

type Props = {
  project: Project;
  filterActive: boolean;
  onToggleFilter: () => void;
  onDeleted: () => void;
  /** When true, this row accepts drops of chat threads. */
  threadDragActive?: boolean;
  onDropThreads?: (threadIds: string[]) => void;
};

export function ProjectSidebarRow({
  project: p,
  filterActive,
  onToggleFilter,
  onDeleted,
  threadDragActive = false,
  onDropThreads,
}: Props) {
  const pushToast = useUiStore((s) => s.pushToast);
  const updateProject = useChatStore((s) => s.updateProject);
  const toggleProjectStarred = useChatStore((s) => s.toggleProjectStarred);
  const toggleProjectPinned = useChatStore((s) => s.toggleProjectPinned);
  const deleteProject = useChatStore((s) => s.deleteProject);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(p.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dropOver, setDropOver] = useState(false);

  const starred = Boolean(p.starred);
  const pinned = Boolean(p.pinned);

  const openRename = () => {
    setMenuOpen(false);
    setRenameValue(p.name);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const next = renameValue.trim();
    if (!next) {
      pushToast("Name cannot be empty", "error");
      return;
    }
    try {
      await updateProject(p.id, next);
      setRenameOpen(false);
      pushToast("Project renamed", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onToggleStar = async () => {
    try {
      await toggleProjectStarred(p.id);
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onTogglePin = async () => {
    try {
      await toggleProjectPinned(p.id);
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const openDeleteDialog = () => {
    setMenuOpen(false);
    queueMicrotask(() => setDeleteOpen(true));
  };

  const confirmDelete = async () => {
    try {
      await deleteProject(p.id);
      setDeleteOpen(false);
      onDeleted();
      pushToast("Project deleted", "info");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  return (
    <>
      <ContextMenu.Root>
        <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <ContextMenu.Trigger asChild>
            <div
              className={cn(
                "group flex w-full items-center gap-0.5 rounded-lg pr-0.5 transition",
                filterActive && "bg-[var(--sidebar-active)]",
                threadDragActive && onDropThreads && "cursor-copy",
                dropOver && threadDragActive && "bg-accent/15 ring-1 ring-accent/50",
              )}
              onDragOver={(e) => {
                if (!threadDragActive || !onDropThreads) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(e) => {
                if (!threadDragActive || !onDropThreads) return;
                e.preventDefault();
                setDropOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropOver(false);
                }
              }}
              onDrop={(e) => {
                if (!onDropThreads) return;
                e.preventDefault();
                setDropOver(false);
                const ids = readThreadIdsFromDataTransfer(e.dataTransfer);
                if (ids.length > 0) onDropThreads(ids);
              }}
            >
              <button
                type="button"
                title={
                  filterActive
                    ? "Click again to show all chats"
                    : `Show chats in ${p.name}`
                }
                onClick={onToggleFilter}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pl-2 pr-1 text-left text-sm transition",
                  "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]",
                  filterActive && "font-medium",
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/15"
                  style={{ backgroundColor: p.color || "#7c6af7" }}
                  aria-hidden
                />
                {starred ? (
                  <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                ) : null}
                {pinned ? (
                  <Pin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </button>

              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Project options"
                  className={cn(
                    "rounded-md p-1.5 text-[var(--sidebar-muted)] outline-none transition",
                    "hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]",
                    "opacity-70 group-hover:opacity-100 data-[state=open]:opacity-100",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" strokeWidth={2} />
                </button>
              </DropdownMenu.Trigger>
            </div>
          </ContextMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={sidebarGlassMenuContent}
              sideOffset={6}
              align="end"
            >
              <DropdownMenu.Item
                className={sidebarGlassMenuItem}
                onSelect={(e) => {
                  e.preventDefault();
                  void onToggleStar();
                }}
              >
                <Star
                  className={cn(menuIcon, starred && "fill-amber-400 text-amber-500")}
                  strokeWidth={2}
                />
                {starred ? "Unstar" : "Star"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={sidebarGlassMenuItem}
                onSelect={(e) => {
                  e.preventDefault();
                  void onTogglePin();
                }}
              >
                <Pin className={cn(menuIcon, pinned && "text-accent")} strokeWidth={2} />
                {pinned ? "Unpin" : "Pin"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={sidebarGlassMenuItem}
                onSelect={(e) => {
                  e.preventDefault();
                  openRename();
                }}
              >
                <Pencil className={menuIcon} strokeWidth={2} />
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={sidebarGlassMenuSeparator} />
              <DropdownMenu.Item
                className={cn(
                  sidebarGlassMenuItem,
                  "text-[var(--dropdown-danger)] data-[highlighted]:text-[var(--dropdown-danger)]",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  openDeleteDialog();
                }}
              >
                <Trash2 className={menuIcon} strokeWidth={2} />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <ContextMenu.Portal>
          <ContextMenu.Content className={sidebarGlassMenuContent} alignOffset={-4}>
            <ContextMenu.Item
              className={sidebarGlassMenuItem}
              onSelect={(e) => {
                e.preventDefault();
                void onToggleStar();
              }}
            >
              <Star
                className={cn(menuIcon, starred && "fill-amber-400 text-amber-500")}
                strokeWidth={2}
              />
              {starred ? "Unstar" : "Star"}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={sidebarGlassMenuItem}
              onSelect={(e) => {
                e.preventDefault();
                void onTogglePin();
              }}
            >
              <Pin className={cn(menuIcon, pinned && "text-accent")} strokeWidth={2} />
              {pinned ? "Unpin" : "Pin"}
            </ContextMenu.Item>
            <ContextMenu.Item
              className={sidebarGlassMenuItem}
              onSelect={(e) => {
                e.preventDefault();
                openRename();
              }}
            >
              <Pencil className={menuIcon} strokeWidth={2} />
              Rename
            </ContextMenu.Item>
            <ContextMenu.Separator className={sidebarGlassMenuSeparator} />
            <ContextMenu.Item
              className={cn(
                sidebarGlassMenuItem,
                "text-[var(--dropdown-danger)] data-[highlighted]:text-[var(--dropdown-danger)]",
              )}
              onSelect={(e) => {
                e.preventDefault();
                openDeleteDialog();
              }}
            >
              <Trash2 className={menuIcon} strokeWidth={2} />
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[410] bg-black/50 data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[411] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
              Delete project?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-[var(--app-muted)]">
              Delete &ldquo;{p.name}&rdquo;? Chats in this project will be unassigned; nothing is deleted from disk.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[400] bg-black/50 data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[401] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
              Rename project
            </Dialog.Title>
            <Dialog.Description className="sr-only">Enter a new name for this project.</Dialog.Description>
            <input
              className="mt-3 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-accent"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitRename();
              }}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
                onClick={() => void submitRename()}
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

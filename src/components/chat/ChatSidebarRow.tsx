import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FolderInput,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Thread } from "../../types/chat";
import { cn } from "../../lib/utils";
import {
  sidebarGlassMenuContent,
  sidebarGlassMenuItem,
  sidebarGlassMenuSeparator,
  sidebarGlassMenuSubContent,
} from "../../lib/sidebarGlassMenu";
import { THREAD_DRAG_MIME } from "../../lib/threadDrag";
import { useChatStore } from "../../store/chatStore";
import { useUiStore } from "../../store/uiStore";

const menuIcon = "h-3.5 w-3.5 shrink-0 opacity-85";

export function ChatSidebarRow({
  thread: t,
  active,
  collapsed,
  onSelect,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  dragIdsForThread,
  onThreadDragStart,
  onThreadDragEnd,
  showProjectDropHint = false,
}: {
  thread: Thread;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  dragIdsForThread: (threadId: string) => string[];
  onThreadDragStart?: () => void;
  onThreadDragEnd?: () => void;
  showProjectDropHint?: boolean;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const loadProjects = useChatStore((s) => s.loadProjects);
  const projects = useChatStore((s) => s.projects);
  const toggleThreadPin = useChatStore((s) => s.toggleThreadPin);
  const renameThread = useChatStore((s) => s.renameThread);
  const deleteThread = useChatStore((s) => s.deleteThread);
  const assignThreadProject = useChatStore((s) => s.assignThreadProject);
  const createProject = useChatStore((s) => s.createProject);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(t.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pinned = Boolean(t.pinned);
  const accentColor = t.color?.trim() || "#64748b";

  const openRename = () => {
    setMenuOpen(false);
    setRenameValue(t.title);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const next = renameValue.trim();
    if (!next) {
      pushToast("Title cannot be empty", "error");
      return;
    }
    try {
      await renameThread(t.id, next);
      setRenameOpen(false);
      pushToast("Chat renamed", "success");
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
      await deleteThread(t.id);
      setDeleteOpen(false);
      pushToast("Chat deleted", "info");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onToggleStar = async () => {
    try {
      await toggleThreadPin(t.id);
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onAssignProject = async (projectId: string | null) => {
    try {
      await assignThreadProject(t.id, projectId);
      pushToast(projectId ? "Added to project" : "Removed from project", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const onNewProject = async () => {
    const name = window.prompt("Project name");
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      pushToast("Project name required", "error");
      return;
    }
    try {
      const p = await createProject(trimmed, {});
      await assignThreadProject(t.id, p.id);
      pushToast("Project created and chat assigned", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={t.title}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-center rounded-lg px-0 py-2 text-sm transition",
          "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]",
          active && "bg-[var(--sidebar-active)] font-medium",
        )}
      >
        <span className="max-w-[2ch] truncate">{pinned ? "★" : "•"}</span>
      </button>
    );
  }

  return (
    <>
      <ContextMenu.Root
        onOpenChange={(o) => {
          if (o) void loadProjects();
        }}
      >
        <DropdownMenu.Root
          open={menuOpen}
          onOpenChange={(o) => {
            setMenuOpen(o);
            if (o) void loadProjects();
          }}
        >
          <ContextMenu.Trigger asChild>
            <div
              title={
                showProjectDropHint && !collapsed
                  ? `${t.title} — drag onto a project`
                  : undefined
              }
              className={cn(
                "group flex w-full items-center gap-0.5 rounded-lg pr-0.5 transition",
                active && "bg-[var(--sidebar-active)]",
                selectionMode &&
                  selected &&
                  "ring-1 ring-[#7FFF00]/70 ring-offset-1 ring-offset-[var(--sidebar-bg)]",
              )}
              draggable={!collapsed}
              onDragStart={(e) => {
                if (collapsed) return;
                const ids = dragIdsForThread(t.id);
                e.dataTransfer.setData(THREAD_DRAG_MIME, JSON.stringify(ids));
                e.dataTransfer.effectAllowed = "move";
                onThreadDragStart?.();
              }}
              onDragEnd={() => onThreadDragEnd?.()}
            >
        {selectionMode ? (
          <label
            className="flex shrink-0 cursor-pointer items-center py-2 pl-1"
            onClick={(ev) => ev.stopPropagation()}
            onPointerDown={(ev) => ev.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.()}
              className="h-3.5 w-3.5 rounded border-[var(--sidebar-muted)] accent-[#7FFF00] focus:ring-[#7FFF00] focus:ring-offset-0"
              aria-label={`Select ${t.title}`}
            />
          </label>
        ) : null}
        <span
          className="my-1.5 w-1 shrink-0 self-stretch rounded-full opacity-90"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
        <button
          type="button"
          title={t.title}
          onClick={onSelect}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-2 pl-1 pr-1 text-left text-sm transition",
            "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]",
            active && "font-medium",
          )}
        >
          {pinned ? (
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
          ) : null}
          <span className="truncate">{t.title}</span>
        </button>

              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Chat options"
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
                  className={cn(menuIcon, pinned && "fill-amber-400 text-amber-500")}
                  strokeWidth={2}
                />
                {pinned ? "Unstar" : "Star"}
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
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger
                  className={cn(
                    sidebarGlassMenuItem,
                    "data-[state=open]:bg-black/[0.06] dark:data-[state=open]:bg-white/[0.1]",
                  )}
                >
                  <FolderInput className={menuIcon} strokeWidth={2} />
                  Add to project
                  <span className="ml-auto text-xs opacity-50">›</span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    className={sidebarGlassMenuSubContent}
                    sideOffset={6}
                    alignOffset={-4}
                  >
                    <DropdownMenu.Item
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onAssignProject(null);
                      }}
                    >
                      No project
                    </DropdownMenu.Item>
                    {projects.map((p) => (
                      <DropdownMenu.Item
                        key={p.id}
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void onAssignProject(p.id);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/15"
                            style={{ backgroundColor: p.color || "#7c6af7" }}
                            aria-hidden
                          />
                          <span className="truncate">{p.name}</span>
                        </span>
                      </DropdownMenu.Item>
                    ))}
                    <DropdownMenu.Separator className={sidebarGlassMenuSeparator} />
                    <DropdownMenu.Item
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onNewProject();
                      }}
                    >
                      New project…
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
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
                className={cn(menuIcon, pinned && "fill-amber-400 text-amber-500")}
                strokeWidth={2}
              />
              {pinned ? "Unstar" : "Star"}
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
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger
                className={cn(
                  sidebarGlassMenuItem,
                  "data-[state=open]:bg-black/[0.06] dark:data-[state=open]:bg-white/[0.1]",
                )}
              >
                <FolderInput className={menuIcon} strokeWidth={2} />
                Add to project
                <span className="ml-auto text-xs opacity-50">›</span>
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent className={sidebarGlassMenuSubContent} alignOffset={-4}>
                  <ContextMenu.Item
                    className={sidebarGlassMenuItem}
                    onSelect={(e) => {
                      e.preventDefault();
                      void onAssignProject(null);
                    }}
                  >
                    No project
                  </ContextMenu.Item>
                  {projects.map((p) => (
                    <ContextMenu.Item
                      key={p.id}
                      className={sidebarGlassMenuItem}
                      onSelect={(e) => {
                        e.preventDefault();
                        void onAssignProject(p.id);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10 dark:border-white/15"
                          style={{ backgroundColor: p.color || "#7c6af7" }}
                          aria-hidden
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </ContextMenu.Item>
                  ))}
                  <ContextMenu.Separator className={sidebarGlassMenuSeparator} />
                  <ContextMenu.Item
                    className={sidebarGlassMenuItem}
                    onSelect={(e) => {
                      e.preventDefault();
                      void onNewProject();
                    }}
                  >
                    New project…
                  </ContextMenu.Item>
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
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
              Delete chat?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-[var(--app-muted)]">
              Delete &ldquo;{t.title}&rdquo;? This cannot be undone.
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
              Rename chat
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Enter a new title for this conversation.
            </Dialog.Description>
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

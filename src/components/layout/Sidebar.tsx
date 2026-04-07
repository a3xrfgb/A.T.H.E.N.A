import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Home,
  LayoutGrid,
  MessageSquare,
  PanelLeft,
  Palette,
  Pencil,
  Search,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatSidebarRow } from "../chat/ChatSidebarRow";
import { ICONS, RemoteIcon } from "../../lib/icons";
import { cn } from "../../lib/utils";
import type { AppView } from "../../types/appView";
import type { Thread } from "../../types/chat";
import { useChatStore } from "../../store/chatStore";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { useLockStore } from "../../store/lockStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { ThemeAppearanceToggle } from "./ThemeAppearanceToggle";
import { AthenaLogo } from "./AthenaLogo";
import { ModelsGridIcon } from "./ModelsGridIcon";
import { NewProjectLordIcon } from "./NewProjectLordIcon";
import { StudyNavIcon } from "./StudyNavIcon";
import { SettingsCogIcon } from "./SettingsCogIcon";
import { ThreadSearchModal } from "./ThreadSearchModal";
import {
  CreateProjectModal,
  PROJECT_COLOR_PRESETS,
  projectSwatchBorderClass,
} from "../projects/CreateProjectModal";
import { ProjectSidebarRow } from "../projects/ProjectSidebarRow";
import { readThreadIdsFromDataTransfer } from "../../lib/threadDrag";
import { useTranslation } from "../../i18n/I18nContext";

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      className="ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        borderColor: "var(--sidebar-kbd-border)",
        background: "var(--sidebar-kbd-bg)",
        color: "var(--sidebar-muted)",
      }}
    >
      {children}
    </span>
  );
}

export function Sidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  view,
  onView,
  hasPin,
}: {
  threads: Thread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  view: AppView;
  onView: (v: AppView) => void;
  hasPin: boolean;
}) {
  const { t } = useTranslation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarProjectFilterToken = useUiStore((s) => s.sidebarProjectFilterToken);
  const sidebarProjectFilterTargetId = useUiStore((s) => s.sidebarProjectFilterTargetId);
  const pushToast = useUiStore((s) => s.pushToast);
  const setLocked = useLockStore((s) => s.setLocked);

  const saveSettings = useSettingsStore((s) => s.save);
  const effectiveDark = useEffectiveDark();

  const [searchOpen, setSearchOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectFilterId, setProjectFilterId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [threadDragActive, setThreadDragActive] = useState(false);
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false);
  const [bulkColorOpen, setBulkColorOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkSuffix, setBulkSuffix] = useState("");
  const [inboxDropOver, setInboxDropOver] = useState(false);

  const [projectsExpanded, setProjectsExpanded] = useState(() => {
    try {
      return localStorage.getItem("athena-sidebar-projects-expanded") !== "0";
    } catch {
      return true;
    }
  });
  const [chatsExpanded, setChatsExpanded] = useState(() => {
    try {
      return localStorage.getItem("athena-sidebar-chats-expanded") !== "0";
    } catch {
      return true;
    }
  });

  const projects = useChatStore((s) => s.projects);
  const assignThreadsToProject = useChatStore((s) => s.assignThreadsToProject);
  const renameThread = useChatStore((s) => s.renameThread);
  const setThreadsColor = useChatStore((s) => s.setThreadsColor);
  const deleteThreads = useChatStore((s) => s.deleteThreads);

  /** Inbox (no filter): only threads not assigned to a project. With filter: that project's threads. */
  const displayThreads =
    projectFilterId === null
      ? threads.filter((t) => t.projectId == null || t.projectId === "")
      : threads.filter((t) => t.projectId === projectFilterId);

  const focusSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "athena-sidebar-projects-expanded",
        projectsExpanded ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [projectsExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "athena-sidebar-chats-expanded",
        chatsExpanded ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [chatsExpanded]);

  useEffect(() => {
    if (collapsed) setProjectFilterId(null);
  }, [collapsed]);

  useEffect(() => {
    if (!chatsExpanded) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [chatsExpanded]);

  useEffect(() => {
    if (collapsed) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [collapsed]);

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const dragIdsForThread = useCallback(
    (id: string) => {
      if (selectionMode && selectedIds.has(id) && selectedIds.size > 0) {
        return Array.from(selectedIds);
      }
      return [id];
    },
    [selectionMode, selectedIds],
  );

  const toggleThreadSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(displayThreads.map((t) => t.id)));
  }, [displayThreads]);

  const handleDropThreadsOnProject = useCallback(
    async (projectId: string, ids: string[]) => {
      if (ids.length === 0) return;
      try {
        await assignThreadsToProject(ids, projectId);
        setThreadDragActive(false);
        pushToast(
          ids.length === 1
            ? t("sidebar.chatMoved")
            : t("sidebar.chatsMoved", { count: ids.length }),
          "success",
        );
        setSelectedIds(new Set());
      } catch (e) {
        pushToast(String(e), "error");
      }
    },
    [assignThreadsToProject, pushToast, t],
  );

  const handleDropThreadsInbox = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        await assignThreadsToProject(ids, null);
        setThreadDragActive(false);
        pushToast(
          ids.length === 1
            ? t("sidebar.chatRemoved")
            : t("sidebar.chatsRemoved", { count: ids.length }),
          "success",
        );
        setSelectedIds(new Set());
      } catch (e) {
        pushToast(String(e), "error");
      }
    },
    [assignThreadsToProject, pushToast, t],
  );

  const runBulkRename = async () => {
    const pre = bulkPrefix;
    const suf = bulkSuffix;
    if (!pre && !suf) {
      pushToast(t("sidebar.prefixSuffix"), "error");
      return;
    }
    try {
      for (const id of selectedList) {
        const t = threads.find((x) => x.id === id);
        if (!t) continue;
        await renameThread(id, `${pre}${t.title}${suf}`);
      }
      setBulkRenameOpen(false);
      setBulkPrefix("");
      setBulkSuffix("");
      setSelectedIds(new Set());
      pushToast(t("sidebar.chatsRenamed"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const runBulkColor = async (color: string) => {
    if (selectedList.length === 0) return;
    try {
      await setThreadsColor(selectedList, color);
      setBulkColorOpen(false);
      setSelectedIds(new Set());
      pushToast(t("sidebar.colorsUpdated"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const runBulkDelete = async () => {
    if (selectedList.length === 0) return;
    try {
      await deleteThreads(selectedList);
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      pushToast(t("sidebar.chatsDeleted"), "info");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  useEffect(() => {
    if (projectFilterId && !projects.some((p) => p.id === projectFilterId)) {
      setProjectFilterId(null);
    }
  }, [projects, projectFilterId]);

  const lastProjectFilterToken = useRef(0);
  useEffect(() => {
    if (sidebarProjectFilterToken === 0) return;
    if (sidebarProjectFilterToken === lastProjectFilterToken.current) return;
    lastProjectFilterToken.current = sidebarProjectFilterToken;
    setProjectFilterId(sidebarProjectFilterTargetId);
    setProjectsExpanded(true);
    setChatsExpanded(true);
  }, [sidebarProjectFilterToken, sidebarProjectFilterTargetId]);

  useEffect(() => {
    if (!threadDragActive) setInboxDropOver(false);
  }, [threadDragActive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
      if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCreateProjectOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  const remoteTint = effectiveDark ? "brightness-0 invert opacity-90" : "brightness-0 opacity-90";

  return (
    <>
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col rounded-2xl border shadow-sm transition-[width]",
        collapsed ? "w-[72px]" : "w-[280px]",
      )}
      style={{
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <div
        className={cn(
          "flex items-center py-3",
          collapsed ? "justify-center px-2" : "justify-between gap-2 px-3",
        )}
      >
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AthenaLogo className="h-8 w-8 shrink-0" />
            <span
              className="truncate font-bold tracking-tight"
              style={{ color: "var(--sidebar-text)" }}
            >
              {t("sidebar.brand")}
            </span>
          </div>
        )}
        <button
          type="button"
          className="rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
          style={{ color: "var(--sidebar-muted)" }}
          onClick={toggleSidebar}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        <NavRow
          collapsed={collapsed}
          icon={<Home className="h-[18px] w-[18px] stroke-[1.75]" />}
          label={t("sidebar.home")}
          active={view === "home"}
          onClick={() => onView("home")}
        />
        <NavRow
          collapsed={collapsed}
          icon={<MessageSquare className="h-[18px] w-[18px] stroke-[1.75]" />}
          label={t("sidebar.newChat")}
          shortcut={<Kbd>Ctrl N</Kbd>}
          active={false}
          onClick={() => {
            onNew();
            onView("chat");
          }}
        />
        <NavRow
          collapsed={collapsed}
          icon={<Search className="h-[18px] w-[18px] stroke-[1.75]" />}
          label={t("sidebar.search")}
          shortcut={<Kbd>Ctrl K</Kbd>}
          active={searchOpen}
          onClick={() => setSearchOpen(true)}
        />
        <NavRow
          collapsed={collapsed}
          icon={<NewProjectLordIcon className="h-[18px] w-[18px]" />}
          label={t("sidebar.createProject")}
          shortcut={<Kbd>Ctrl P</Kbd>}
          onClick={() => setCreateProjectOpen(true)}
        />
        <NavRow
          collapsed={collapsed}
          icon={<Globe className="h-[18px] w-[18px] stroke-[1.75]" />}
          label={t("sidebar.browser")}
          active={view === "browser"}
          onClick={() => onView("browser")}
        />
        <NavRow
          collapsed={collapsed}
          icon={
            <img
              src="/icons/gallery-icon.png"
              alt=""
              width={18}
              height={18}
              className={cn(
                "h-[18px] w-[18px] shrink-0 object-contain",
                effectiveDark ? "brightness-0 invert" : "brightness-0",
              )}
              draggable={false}
            />
          }
          label={t("sidebar.gallery")}
          active={view === "images"}
          onClick={() => onView("images")}
        />
        <NavRow
          collapsed={collapsed}
          icon={<StudyNavIcon className="h-[18px] w-[18px] shrink-0" />}
          label={t("sidebar.study")}
          active={view === "study"}
          onClick={() => onView("study")}
        />
        <NavRow
          collapsed={collapsed}
          icon={<ModelsGridIcon className="h-[18px] w-[18px]" />}
          label={t("sidebar.models")}
          active={view === "models"}
          onClick={() => onView("models")}
        />
        <NavRow
          collapsed={collapsed}
          icon={<LayoutGrid className="h-[18px] w-[18px] stroke-[1.75]" />}
          label={t("sidebar.canvas")}
          active={view === "canvas"}
          onClick={() => onView("canvas")}
        />
        <NavRow
          collapsed={collapsed}
          icon={<RemoteIcon src={ICONS.inspirationDraw} alt="" size={18} className={cn("h-[18px] w-[18px] shrink-0", remoteTint)} />}
          label={t("sidebar.inspiration")}
          trailing={<span className="ml-1 h-4 w-1 shrink-0 rounded-sm bg-[#e6c200]" aria-hidden />}
          active={view === "inspiration"}
          onClick={() => onView("inspiration")}
        />
        <NavRow
          collapsed={collapsed}
          icon={
            <RemoteIcon
              src={ICONS.notesPastel}
              alt=""
              size={18}
              className={cn("h-[18px] w-[18px] shrink-0", remoteTint)}
            />
          }
          label={t("sidebar.notes")}
          active={view === "notes"}
          onClick={() => onView("notes")}
        />
      </nav>

      {view !== "canvas" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!collapsed && projects.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-2 pb-1 pt-0.5">
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 transition hover:bg-[var(--sidebar-hover)]"
                  style={{ color: "var(--sidebar-muted)" }}
                  aria-expanded={projectsExpanded}
                  title={
                    projectsExpanded
                      ? t("sidebar.collapseProjectsSection")
                      : t("sidebar.expandProjectsSection")
                  }
                  onClick={() => setProjectsExpanded((e) => !e)}
                >
                  {projectsExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </button>
                <div
                  className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--sidebar-muted)" }}
                >
                  {t("sidebar.projects")}
                </div>
              </div>
              {projectsExpanded && (
                <>
                  {threadDragActive ? (
                    <div
                      className={cn(
                        "mb-2 rounded-lg border border-dashed px-2 py-2 text-center text-[11px] transition",
                        inboxDropOver
                          ? "border-accent bg-accent/10 text-[var(--sidebar-text)]"
                          : "border-[var(--sidebar-muted)] text-[var(--sidebar-muted)]",
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setInboxDropOver(true);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setInboxDropOver(false);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setInboxDropOver(false);
                        const ids = readThreadIdsFromDataTransfer(e.dataTransfer);
                        void handleDropThreadsInbox(ids);
                      }}
                    >
                      {t("sidebar.dropUnassign")}
                    </div>
                  ) : null}
                  <div className="mb-3 space-y-0.5">
                    {projects.map((p) => (
                      <ProjectSidebarRow
                        key={p.id}
                        project={p}
                        filterActive={projectFilterId === p.id}
                        onToggleFilter={() =>
                          setProjectFilterId((id) => (id === p.id ? null : p.id))
                        }
                        onDeleted={() =>
                          setProjectFilterId((f) => (f === p.id ? null : f))
                        }
                        threadDragActive={threadDragActive}
                        onDropThreads={(ids) =>
                          void handleDropThreadsOnProject(p.id, ids)
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {!collapsed && (
            <div
              className="flex items-center justify-between gap-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: "var(--sidebar-muted)" }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 transition hover:bg-[var(--sidebar-hover)]"
                  style={{ color: "var(--sidebar-muted)" }}
                  aria-expanded={chatsExpanded}
                  title={
                    chatsExpanded
                      ? t("sidebar.collapseChatsSection")
                      : t("sidebar.expandChatsSection")
                  }
                  onClick={() => setChatsExpanded((e) => !e)}
                >
                  {chatsExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </button>
                <span className="min-w-0 truncate">
                  {t("sidebar.chats")}
                  {projectFilterId ? (
                    <span className="ml-1.5 normal-case opacity-80">
                      {t("sidebar.filtered")}
                    </span>
                  ) : null}
                </span>
              </div>
              {chatsExpanded ? (
                selectionMode ? (
                  <span className="flex shrink-0 items-center gap-1 normal-case">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium hover:bg-[var(--sidebar-hover)]"
                      onClick={() => selectAllVisible()}
                    >
                      {t("sidebar.all")}
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium hover:bg-[var(--sidebar-hover)]"
                      onClick={() => {
                        setSelectionMode(false);
                        setSelectedIds(new Set());
                      }}
                    >
                      {t("sidebar.done")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    title={t("sidebar.selectChats")}
                    className="shrink-0 rounded p-0.5 normal-case hover:bg-[var(--sidebar-hover)]"
                    onClick={() => setSelectionMode(true)}
                  >
                    <SquareCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )
              ) : null}
            </div>
          )}
          {!collapsed && chatsExpanded && selectionMode && selectedIds.size > 0 ? (
            <div
              className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--sidebar-border)] px-1.5 py-1.5"
              style={{ background: "var(--sidebar-active)" }}
            >
              <span className="px-1 text-[10px] font-medium text-[var(--sidebar-text)]">
                {t("sidebar.selected", { count: selectedIds.size })}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                onClick={() => setBulkRenameOpen(true)}
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                {t("sidebar.rename")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                onClick={() => setBulkColorOpen(true)}
              >
                <Palette className="h-3 w-3" strokeWidth={2} />
                {t("sidebar.color")}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--dropdown-danger)] hover:bg-[var(--sidebar-hover)]"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                {t("sidebar.delete")}
              </button>
            </div>
          ) : null}
          <div className="space-y-0.5">
            {(collapsed || chatsExpanded) &&
              displayThreads.map((t) => (
                <ChatSidebarRow
                  key={t.id}
                  thread={t}
                  active={t.id === activeId}
                  collapsed={collapsed}
                  selectionMode={selectionMode && !collapsed && chatsExpanded}
                  selected={selectedIds.has(t.id)}
                  onToggleSelect={() => toggleThreadSelected(t.id)}
                  dragIdsForThread={dragIdsForThread}
                  onThreadDragStart={() => setThreadDragActive(true)}
                  onThreadDragEnd={() => setThreadDragActive(false)}
                  showProjectDropHint={projects.length > 0}
                  onSelect={() => {
                    onSelect(t.id);
                    onView("chat");
                  }}
                />
              ))}
          </div>
          {!collapsed &&
            chatsExpanded &&
            projectFilterId &&
            displayThreads.length === 0 && (
            <p
              className="px-2 py-3 text-center text-xs"
              style={{ color: "var(--sidebar-muted)" }}
            >
              {t("sidebar.noChatsInProject")}
            </p>
          )}
          {!collapsed &&
            chatsExpanded &&
            !projectFilterId &&
            displayThreads.length === 0 && (
            <p
              className="px-2 py-3 text-center text-xs"
              style={{ color: "var(--sidebar-muted)" }}
            >
              {t("sidebar.noInboxChats")}
            </p>
          )}
        </div>
      )}

      <div
        className="mt-auto border-t px-3 py-3"
        style={{
          borderColor: "var(--sidebar-border)",
          background: "var(--sidebar-footer)",
        }}
      >
        <div
          className="flex items-center justify-between gap-2"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <button
            type="button"
            className="rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
            style={{ color: "var(--sidebar-text)" }}
            title={t("sidebar.settings")}
            onClick={() => useUiStore.getState().setSettingsOpen(true)}
          >
            <SettingsCogIcon className="h-5 w-5" />
          </button>
          {!collapsed ? (
            <div className="flex min-w-0 flex-1 justify-center px-1">
              <ThemeAppearanceToggle />
            </div>
          ) : (
            <button
              type="button"
              className="rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
              title={effectiveDark ? t("sidebar.switchToLight") : t("sidebar.switchToDark")}
              onClick={() => void saveSettings({ theme: effectiveDark ? "light" : "dark" })}
            >
              <img
                src={effectiveDark ? ICONS.themeLight : ICONS.themeDark}
                alt=""
                width={24}
                height={24}
                className={cn("h-6 w-6", remoteTint)}
                draggable={false}
              />
            </button>
          )}
          <button
            type="button"
            className="rounded-lg p-2 transition hover:bg-[var(--sidebar-hover)]"
            style={{ color: "var(--sidebar-text)" }}
            title={hasPin ? t("sidebar.lockApp") : t("sidebar.setPinSecurity")}
            onClick={() => {
              if (hasPin) setLocked(true);
              else {
                useUiStore.getState().setSettingsOpen(true);
                pushToast(t("sidebar.pinToast"), "info");
              }
            }}
          >
            <img
              src={ICONS.lockLocked}
              alt=""
              width={22}
              height={22}
              className={cn("h-[22px] w-[22px]", remoteTint)}
              draggable={false}
            />
          </button>
        </div>
      </div>
    </aside>

    <ThreadSearchModal
      open={searchOpen}
      onOpenChange={setSearchOpen}
      threads={threads}
      onSelectThread={(id) => {
        onSelect(id);
        onView("chat");
      }}
      onNewChat={() => {
        onNew();
        onView("chat");
      }}
    />
    <CreateProjectModal open={createProjectOpen} onOpenChange={setCreateProjectOpen} />

    <Dialog.Root open={bulkRenameOpen} onOpenChange={setBulkRenameOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[420] bg-black/50 data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[421] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
          <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
            {t("sidebar.bulkRenameTitle", { count: selectedList.length })}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--app-muted)]">
            {t("sidebar.bulkRenameDesc")}
          </Dialog.Description>
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-accent"
              placeholder={t("sidebar.prefixPh")}
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-accent"
              placeholder={t("sidebar.suffixPh")}
              value={bulkSuffix}
              onChange={(e) => setBulkSuffix(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
              >
                {t("common.cancel")}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
              onClick={() => void runBulkRename()}
            >
              {t("common.apply")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <Dialog.Root open={bulkColorOpen} onOpenChange={setBulkColorOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[420] bg-black/50 data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[421] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
          <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
            {t("sidebar.colorBulkTitle", { count: selectedList.length })}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("sidebar.colorBulkDesc")}
          </Dialog.Description>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROJECT_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className={cn(
                  "h-9 w-9 rounded-full border-2 shadow-sm transition hover:scale-105",
                  projectSwatchBorderClass(c),
                )}
                style={{ backgroundColor: c }}
                onClick={() => void runBulkColor(c)}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
              >
                {t("common.cancel")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <Dialog.Root open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[420] bg-black/50 data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[421] w-[min(90vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl">
          <Dialog.Title className="text-sm font-semibold text-[var(--app-text)]">
            {t("sidebar.deleteBulkTitle", { count: selectedList.length })}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--app-muted)]">
            {t("sidebar.cannotUndo")}
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--app-muted)] hover:bg-[var(--app-bg)]"
              >
                {t("common.cancel")}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              onClick={() => void runBulkDelete()}
            >
              {t("sidebar.deleteAll")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}

function NavRow({
  icon,
  label,
  shortcut,
  trailing,
  active,
  collapsed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition",
        active ? "bg-[var(--sidebar-active)] font-medium" : "hover:bg-[var(--sidebar-hover)]",
        collapsed && "justify-center px-0",
      )}
      style={{ color: "var(--sidebar-text)" }}
    >
      <span className="flex shrink-0 items-center justify-center">{icon}</span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {trailing}
          {shortcut}
        </>
      )}
    </button>
  );
}

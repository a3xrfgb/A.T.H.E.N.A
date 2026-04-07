import { create } from "zustand";

export type Toast = { id: string; message: string; type: "info" | "error" | "success" };

interface UiState {
  sidebarCollapsed: boolean;
  /** Increment to apply `sidebarProjectFilterTargetId` in Sidebar (e.g. from Home). */
  sidebarProjectFilterToken: number;
  sidebarProjectFilterTargetId: string | null;
  rightPanelOpen: boolean;
  settingsOpen: boolean;
  /** When settings opens, navigate here once (e.g. `"runtime"` from llama.cpp update banner). */
  settingsEntryNavId: string | null;
  /** llama.cpp runtime update — glass banner instead of a toast. */
  runtimeUpdateBanner: { tag: string } | null;
  /** Incremented to ask the shell to switch to the Notes view (e.g. after saving a chat reply). */
  openNotesSignal: number;
  toasts: Toast[];
  toggleSidebar: () => void;
  expandSidebar: () => void;
  requestSidebarProjectFilter: (projectId: string | null) => void;
  setRightPanel: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsEntryNavId: (id: string | null) => void;
  openSettingsToRuntime: () => void;
  showRuntimeUpdateBanner: (tag: string) => void;
  dismissRuntimeUpdateBanner: () => void;
  signalOpenNotes: () => void;
  pushToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarProjectFilterToken: 0,
  sidebarProjectFilterTargetId: null,
  rightPanelOpen: false,
  settingsOpen: false,
  settingsEntryNavId: null,
  runtimeUpdateBanner: null,
  openNotesSignal: 0,
  toasts: [],
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  requestSidebarProjectFilter: (projectId) =>
    set((s) => ({
      sidebarProjectFilterTargetId: projectId,
      sidebarProjectFilterToken: s.sidebarProjectFilterToken + 1,
      sidebarCollapsed: false,
    })),
  setRightPanel: (open) => set({ rightPanelOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsEntryNavId: (id) => set({ settingsEntryNavId: id }),
  openSettingsToRuntime: () =>
    set({
      settingsOpen: true,
      settingsEntryNavId: "runtime",
      runtimeUpdateBanner: null,
    }),
  showRuntimeUpdateBanner: (tag) => set({ runtimeUpdateBanner: { tag } }),
  dismissRuntimeUpdateBanner: () => set({ runtimeUpdateBanner: null }),
  signalOpenNotes: () =>
    set((s) => ({ openNotesSignal: s.openNotesSignal + 1 })),
  pushToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

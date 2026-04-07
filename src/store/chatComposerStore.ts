import { create } from "zustand";

const STORAGE_KEY = "athena.chat.composer";
const COMPOSER_VERSION = 4;

function load(): { thinkEnabled: boolean; visionEnabled: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { thinkEnabled: false, visionEnabled: true };
    const p = JSON.parse(raw) as {
      v?: number;
      thinkEnabled?: boolean;
      visionEnabled?: boolean;
    };
    if ((p.v ?? 1) < 4) {
      const visionEnabled = p.visionEnabled !== false;
      const thinkEnabled = Boolean(p.thinkEnabled);
      persist({ thinkEnabled, visionEnabled });
      return { thinkEnabled, visionEnabled };
    }
    return {
      thinkEnabled: Boolean(p.thinkEnabled),
      visionEnabled: p.visionEnabled !== false,
    };
  } catch {
    return { thinkEnabled: false, visionEnabled: true };
  }
}

function persist(state: { thinkEnabled: boolean; visionEnabled: boolean }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: COMPOSER_VERSION, ...state }),
    );
  } catch {
    /* ignore */
  }
}

/** Per-session composer toggles (Think / Vision), persisted locally. */
export const useChatComposerStore = create<{
  thinkEnabled: boolean;
  visionEnabled: boolean;
  setThinkEnabled: (v: boolean) => void;
  setVisionEnabled: (v: boolean) => void;
  toggleThink: () => void;
  toggleVision: () => void;
  /** When sending, delete from this message (inclusive) first — edit / retry user message */
  editFromMessageId: string | null;
  setEditFromMessageId: (id: string | null) => void;
  /** One-shot: put text in the composer (e.g. edit message) */
  composerPrefill: { text: string; rev: number } | null;
  openComposerWithText: (text: string) => void;
  clearComposerPrefill: () => void;
}>((set, get) => ({
  ...load(),
  editFromMessageId: null,
  composerPrefill: null,
  setEditFromMessageId: (editFromMessageId) => set({ editFromMessageId }),
  openComposerWithText: (text) =>
    set({ composerPrefill: { text, rev: Date.now() } }),
  clearComposerPrefill: () => set({ composerPrefill: null }),
  setThinkEnabled: (thinkEnabled) => {
    set({ thinkEnabled });
    persist({
      thinkEnabled,
      visionEnabled: get().visionEnabled,
    });
  },
  setVisionEnabled: (visionEnabled) => {
    set({ visionEnabled });
    persist({
      thinkEnabled: get().thinkEnabled,
      visionEnabled,
    });
  },
  toggleThink: () => {
    const thinkEnabled = !get().thinkEnabled;
    set({ thinkEnabled });
    persist({
      thinkEnabled,
      visionEnabled: get().visionEnabled,
    });
  },
  toggleVision: () => {
    const visionEnabled = !get().visionEnabled;
    set({ visionEnabled });
    persist({
      thinkEnabled: get().thinkEnabled,
      visionEnabled,
    });
  },
}));

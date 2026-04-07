import { isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { DownloadProgress, ModelInfo } from "../types/model";
import {
  getPreferredDefaultChatModelId,
  resolveToInstalledMainModelId,
} from "../lib/chatModelPicker";
import { filterMainChatModels } from "../lib/modelDisk";
import { api } from "../lib/tauri";
import { useChatStore } from "./chatStore";
import { useSettingsStore } from "./settingsStore";
import { useUiStore } from "./uiStore";

interface ModelStore {
  localModels: ModelInfo[];
  activeModelId: string | null;
  downloadingModels: Record<string, DownloadProgress>;

  loadLocalModels: () => Promise<void>;
  downloadModel: (id: string, url: string) => Promise<void>;
  /**
   * Downloads into `models/<bundleSubdir>/`. When `bundleSubdir` is omitted, uses the first file's id
   * (same layout as General Qwen / Gemma).
   */
  downloadModelFiles: (
    files: { id: string; url: string }[],
    bundleSubdir?: string,
  ) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  /** Set active id only (e.g. after download). Prefer `selectChatModel` from UI. */
  setActiveModel: (id: string) => void;
  /** Validate id, persist as default, preload GGUF (single llama-server process). */
  selectChatModel: (id: string) => Promise<void>;
  setDownloadProgress: (modelId: string, p: DownloadProgress) => void;
  /** Remove progress rows (e.g. after complete or when refreshing UI). */
  clearDownloadProgress: (modelIds?: string[]) => void;
}

export const useModelStore = create<ModelStore>((set, get) => ({
  localModels: [],
  activeModelId: null,
  downloadingModels: {},

  loadLocalModels: async () => {
    const localModels = await api.listLocalModels();
    set({ localModels });
    const { activeModelId } = get();
    const mains = filterMainChatModels(localModels);
    const keep = resolveToInstalledMainModelId(mains, activeModelId);
    const next = keep ?? getPreferredDefaultChatModelId(mains) ?? mains[0]?.id ?? null;
    if (next !== activeModelId) {
      set({ activeModelId: next });
    }
  },

  downloadModel: async (id, url) => {
    await api.downloadModel(id, url);
    await get().loadLocalModels();
    get().clearDownloadProgress([id]);
    await get().selectChatModel(id);
  },

  downloadModelFiles: async (files, bundleSubdir) => {
    if (files.length === 0) return;
    const subdir = bundleSubdir ?? files[0].id;
    await api.downloadModelBundle(subdir, files);
    await get().loadLocalModels();
    get().clearDownloadProgress(files.map((f) => f.id));
    await get().selectChatModel(files[0].id);
  },

  deleteModel: async (id) => {
    await api.deleteModel(id);
    await get().loadLocalModels();
  },

  setActiveModel: (id) => set({ activeModelId: id }),

  selectChatModel: async (id) => {
    const mains = filterMainChatModels(get().localModels);
    const canonical = resolveToInstalledMainModelId(mains, id);
    if (!canonical) {
      useUiStore.getState().pushToast("Selected model is not installed.", "error");
      return;
    }
    set({ activeModelId: canonical });
    if (useChatStore.getState().isStreaming) {
      await useChatStore.getState().stopStreaming();
    }
    try {
      await useSettingsStore.getState().save({ defaultModel: canonical });
      if (isTauri()) {
        await api.preloadChatModel(canonical);
      }
    } catch (e) {
      useUiStore.getState().pushToast(String(e), "error");
    }
  },

  setDownloadProgress: (modelId, p) =>
    set((s) => ({
      downloadingModels: { ...s.downloadingModels, [modelId]: p },
    })),

  clearDownloadProgress: (modelIds) =>
    set((s) => {
      if (!modelIds?.length) {
        return { downloadingModels: {} };
      }
      const next = { ...s.downloadingModels };
      for (const id of modelIds) {
        delete next[id];
      }
      return { downloadingModels: next };
    }),
}));

import { create } from "zustand";
import type { AppSettings } from "../types/settings";
import { setDocumentDirection } from "../i18n/messages";
import { applyAppFontStyle, normalizeFontStyleId } from "../lib/fontStyles";
import { api } from "../lib/tauri";

const defaultSettings: AppSettings = {
  theme: "dark",
  defaultModel: "",
  serverPort: 11434,
  serverEnabled: false,
  maxTokens: 2048,
  temperature: 0.7,
  contextLength: 4096,
  gpuLayers: -1,
  dataDir: "",
  apiKey: "",
  language: "en",
  developerMode: false,
  fontSizeScale: 1,
  fontWeightPreset: "normal",
  fontStyle: "inter",
  thinkingStyle: "bubble",
  profilePicturePath: "",
  profileFullName: "",
  profileNickname: "",
  profileOccupation: "",
  profileAboutMe: "",
  personalCustomInstructions: "",
  personalNickname: "",
  personalMoreAboutYou: "",
  personalMemoryEnabled: false,
  personalMemoryBlob: "",
  securityPinHash: "",
  securityPinSalt: "",
  securityAutoLockMinutes: 0,
  runtimeVariant: "cpu",
  runtimeNotifyUpdates: true,
  systemPrompt: "",
  cpuThreads: -1,
  inferenceBatchSize: 2048,
  inferenceUbatchSize: 512,
  inferenceParallel: -1,
  inferenceFlashAttn: "auto",
  inferenceMmap: true,
  inferenceMlock: false,
  inferenceKvOffload: true,
  inferenceKvUnified: true,
  ropeFreqBase: 0,
  ropeFreqScale: 0,
  inferenceSeed: -1,
  inferenceCacheTypeK: "",
  inferenceCacheTypeV: "",
  showAdvancedInference: false,
  homeShowFlipClock: true,
  homeShowInspiration: true,
  homeShowStats: true,
  homeCompactLayout: false,
};

const LANG_HTML: Record<string, string> = {
  en: "en",
  am: "am",
  ti: "ti",
  om: "om",
  zh: "zh-CN",
  hi: "hi",
  es: "es",
  ar: "ar",
  fr: "fr",
  it: "it",
  bn: "bn",
  pt: "pt",
  ru: "ru",
  ur: "ur",
};

const DARK_THEMES = new Set(["dark", "slate", "ocean", "forest"]);

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (partial: Partial<AppSettings>) => Promise<void>;
  applyTheme: () => void;
  applyTypography: () => void;
}

export function getEffectiveDark(theme: string): boolean {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  if (DARK_THEMES.has(theme)) return true;
  return false;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async () => {
    const raw = await api.getSettings();
    const settings = { ...defaultSettings, ...raw } as AppSettings;
    if ((settings.fontWeightPreset as string) === "thin") {
      settings.fontWeightPreset = "normal";
      void api.saveSettings(settings).catch(() => {});
    }
    if ((settings.thinkingStyle as string) === "chatgpt") {
      settings.thinkingStyle = "wide";
      void api.saveSettings(settings).catch(() => {});
    }
    settings.fontStyle = normalizeFontStyleId(settings.fontStyle);
    set({ settings, loaded: true });
    get().applyTheme();
    get().applyTypography();
  },

  save: async (partial) => {
    const next = { ...get().settings, ...partial };
    await api.saveSettings(next);
    set({ settings: next });
    get().applyTheme();
    get().applyTypography();
  },

  applyTheme: () => {
    const { theme, language } = get().settings;
    const html = document.documentElement;
    html.classList.toggle("dark", getEffectiveDark(theme));
    html.setAttribute("data-theme", theme === "system" ? (getEffectiveDark("system") ? "dark" : "light") : theme);
    const lang = language || "en";
    html.lang = LANG_HTML[lang] ?? lang;
    setDocumentDirection(lang);
  },

  applyTypography: () => {
    const { fontSizeScale, fontWeightPreset, fontStyle, language } = get().settings;
    const scale = Number.isFinite(fontSizeScale) ? Math.min(1.35, Math.max(0.8, fontSizeScale)) : 1;
    const w = fontWeightPreset === "bold" ? "700" : "400";
    document.documentElement.style.setProperty("--font-size-scale", String(scale));
    document.documentElement.style.setProperty("--font-weight-body", w);
    applyAppFontStyle(language ?? "en", fontStyle ?? "inter");
  },
}));

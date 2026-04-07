import type { RuntimeVariant } from "./runtime";

export interface AppSettings {
  theme: string;
  defaultModel: string;
  serverPort: number;
  serverEnabled: boolean;
  maxTokens: number;
  temperature: number;
  contextLength: number;
  gpuLayers: number;
  dataDir: string;
  apiKey: string;

  /** BCP-47 language code (e.g. en, am, zh). UI copy follows gradually; `lang` is set on &lt;html&gt;. */
  language: string;
  developerMode: boolean;
  fontSizeScale: number;
  fontWeightPreset: "normal" | "bold";
  /**
   * UI font when language is English (`inter`, `roboto`, `open_sans`, …).
   * Ignored for non-English interface languages.
   */
  fontStyle: string;
  /** Assistant message presentation in chat. */
  /** Assistant message layout: bubble, block, rotate, or wide card. */
  thinkingStyle: "bubble" | "block" | "rotate" | "wide";

  profilePicturePath: string;
  profileFullName: string;
  profileNickname: string;
  profileOccupation: string;
  profileAboutMe: string;

  personalCustomInstructions: string;
  personalNickname: string;
  personalMoreAboutYou: string;
  personalMemoryEnabled: boolean;
  personalMemoryBlob: string;

  securityPinHash: string;
  securityPinSalt: string;
  securityAutoLockMinutes: number;

  /** Windows release flavor for ggml-org/llama.cpp prebuilt zips. */
  runtimeVariant: RuntimeVariant;
  /** Notify when a newer llama.cpp release is available than the installed copy. */
  runtimeNotifyUpdates: boolean;

  /** Custom system prompt merged into the model system message (Settings → General). */
  systemPrompt: string;

  /** CPU threads for llama-server (`-t`). `-1` = server default. */
  cpuThreads: number;
  inferenceBatchSize: number;
  inferenceUbatchSize: number;
  /** Server slots (`-np`). `-1` = auto. */
  inferenceParallel: number;

  /** `auto` | `on` | `off` for flash attention (`-fa`). */
  inferenceFlashAttn: string;
  inferenceMmap: boolean;
  inferenceMlock: boolean;
  inferenceKvOffload: boolean;
  inferenceKvUnified: boolean;

  /** `0` = do not override. */
  ropeFreqBase: number;
  ropeFreqScale: number;
  inferenceSeed: number;

  /** Empty = server default. Otherwise `-ctk` / `-ctv` values (e.g. `f16`, `q8_0`). */
  inferenceCacheTypeK: string;
  inferenceCacheTypeV: string;

  showAdvancedInference: boolean;

  /** Home dashboard: show flip clock (Appearance → Home). */
  homeShowFlipClock: boolean;
  /** Home dashboard: quote / inspiration card. */
  homeShowInspiration: boolean;
  /** Home dashboard: quick stats row. */
  homeShowStats: boolean;
  /** Denser Home layout (smaller clock, tighter spacing). */
  homeCompactLayout: boolean;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  url: string;
}

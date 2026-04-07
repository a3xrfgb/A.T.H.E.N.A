/** First-run welcome screen — main GGUF + mmproj per bundle (folder install). */

import { MODEL_PUBLISHER_LOGO } from "./modelCatalog";

const HF = (repo: string, file: string) =>
  `https://huggingface.co/${repo}/resolve/main/${file}`;

export type WelcomeModelBundle = {
  key: string;
  /** Passed to `download_model_bundle` as the Models/ subfolder name. */
  bundleDir?: string;
  title: string;
  subtitle: string;
  /** Tailwind-friendly gradient from → to */
  gradient: [string, string];
  /** Company / publisher mark */
  logoUrl: string;
  logoAlt: string;
  /** Light plate behind logo (Google “G” reads better on white) */
  logoPlate?: "light" | "dark";
  files: { id: string; url: string }[];
};

export const WELCOME_MODEL_BUNDLES: WelcomeModelBundle[] = [
  {
    key: "gemma4",
    title: "Gemma 4 E4B IT",
    subtitle: "Google · vision",
    gradient: ["#1d4ed8", "#93c5fd"],
    logoUrl: MODEL_PUBLISHER_LOGO.google,
    logoAlt: "Google",
    logoPlate: "light",
    files: [
      {
        id: "gemma-4-E4B-it-Q4_K_M",
        url: HF("lmstudio-community/gemma-4-E4B-it-GGUF", "gemma-4-E4B-it-Q4_K_M.gguf"),
      },
      {
        id: "mmproj-gemma-4-E4B-it-BF16",
        url: HF("lmstudio-community/gemma-4-E4B-it-GGUF", "mmproj-gemma-4-E4B-it-BF16.gguf"),
      },
    ],
  },
  {
    key: "gemma4e4b-uncensored-heretic",
    title: "Gemma 4B uncensored",
    subtitle: "llmfan46 · vision",
    gradient: ["#3b0764", "#a855f7"],
    logoUrl: MODEL_PUBLISHER_LOGO.google,
    logoAlt: "Google",
    logoPlate: "light",
    files: [
      {
        id: "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M",
        url: HF(
          "llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF",
          "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M.gguf",
        ),
      },
      {
        id: "gemma-4-E4B-it-mmproj-BF16",
        url: HF(
          "llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF",
          "gemma-4-E4B-it-mmproj-BF16.gguf",
        ),
      },
    ],
  },
  {
    key: "gemma4e2b",
    bundleDir: "gemma-4-e2b-it",
    title: "Gemma 2B",
    subtitle: "Gemma 4 E2B IT · Google · vision",
    gradient: ["#172554", "#7dd3fc"],
    logoUrl: MODEL_PUBLISHER_LOGO.google,
    logoAlt: "Google",
    logoPlate: "light",
    files: [
      {
        id: "gemma-4-E2B-it-Q4_K_M",
        url: HF("lmstudio-community/gemma-4-E2B-it-GGUF", "gemma-4-E2B-it-Q4_K_M.gguf"),
      },
      {
        id: "mmproj-gemma-4-E2B-it-BF16",
        url: HF("lmstudio-community/gemma-4-E2B-it-GGUF", "mmproj-gemma-4-E2B-it-BF16.gguf"),
      },
    ],
  },
  {
    key: "qwen35",
    title: "Qwen3.5 9B",
    subtitle: "Alibaba · General · vision",
    gradient: ["#0f172a", "#0ea5e9"],
    logoUrl: MODEL_PUBLISHER_LOGO.qwen,
    logoAlt: "Alibaba Qwen",
    files: [
      {
        id: "Qwen3.5-9B-Q4_K_M",
        url: HF("lmstudio-community/Qwen3.5-9B-GGUF", "Qwen3.5-9B-Q4_K_M.gguf"),
      },
      {
        id: "mmproj-Qwen3.5-9B-BF16",
        url: HF("lmstudio-community/Qwen3.5-9B-GGUF", "mmproj-Qwen3.5-9B-BF16.gguf"),
      },
    ],
  },
  {
    key: "qwen-uncensored",
    bundleDir: "qwen35-9b-uncensored",
    title: "Qwen3.5 9B Uncensored",
    subtitle: "HauhauCS · vision",
    gradient: ["#3f0f0f", "#f97316"],
    /** Qwen-family weights; HauhauCS called out in subtitle */
    logoUrl: MODEL_PUBLISHER_LOGO.qwen,
    logoAlt: "Alibaba Qwen",
    files: [
      {
        id: "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M",
        url: HF(
          "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
          "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf",
        ),
      },
      {
        id: "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16",
        url: HF(
          "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
          "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf",
        ),
      },
    ],
  },
];

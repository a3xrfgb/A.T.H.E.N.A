/**
 * Curated GGUF models for Athena — direct Hugging Face `resolve` URLs.
 * Multi-file entries (vision): download order is main weights first, then mmproj.
 */

export type CatalogFile = { modelId: string; url: string };

export type CatalogEntry = {
  /** Stable UI / dedupe key */
  id: string;
  /**
   * Subfolder under Models/ for this bundle. Omit to use the first file's `modelId` (General Qwen, Gemma).
   */
  bundleDir?: string;
  name: string;
  subtitle: string;
  /** Portrait art: remote logo or gradient fallback */
  logoUrl?: string;
  gradient: [string, string];
  vision?: boolean;
  featured?: boolean;
  /** Empty = no GGUF download (e.g. Safetensors-only); use hfPage instead */
  files: CatalogFile[];
  hfPage?: string;
};

function hf(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

/** Company / publisher marks — Wikimedia, official brand assets, or org avatars. */
export const MODEL_PUBLISHER_LOGO = {
  /** Alibaba Qwen team (GitHub org). */
  qwen: "https://avatars.githubusercontent.com/u/141221163?s=200&v=4",
  google: "https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png",
  meta: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg",
  huggingface:
    "https://huggingface.co/datasets/huggingface/brand-assets/resolve/0fd14cd6eca1024a487427db8d52ce5d10b3a321/hg-logo.png",
} as const;

const LOGO = MODEL_PUBLISHER_LOGO;

/** Curated GGUF bundles — grid fills row-wise (4 columns). */
export const MODEL_CATALOG: CatalogEntry[] = [
  {
    id: "gemma-4-e4b",
    name: "Gemma 4 E4B IT",
    subtitle: "LM Studio · Q4_K_M",
    vision: true,
    featured: true,
    gradient: ["#1d4ed8", "#93c5fd"],
    logoUrl: LOGO.google,
    files: [
      {
        modelId: "gemma-4-E4B-it-Q4_K_M",
        url: hf("lmstudio-community/gemma-4-E4B-it-GGUF", "gemma-4-E4B-it-Q4_K_M.gguf"),
      },
      {
        modelId: "mmproj-gemma-4-E4B-it-BF16",
        url: hf("lmstudio-community/gemma-4-E4B-it-GGUF", "mmproj-gemma-4-E4B-it-BF16.gguf"),
      },
    ],
  },
  {
    id: "gemma-4-e4b-it-ultra-uncensored-heretic",
    name: "Gemma 4B uncensored",
    subtitle: "llmfan46 · Q4_K_M · vision",
    vision: true,
    featured: true,
    gradient: ["#3b0764", "#a855f7"],
    logoUrl: LOGO.google,
    files: [
      {
        modelId: "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M",
        url: hf(
          "llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF",
          "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M.gguf",
        ),
      },
      {
        modelId: "gemma-4-E4B-it-mmproj-BF16",
        url: hf(
          "llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF",
          "gemma-4-E4B-it-mmproj-BF16.gguf",
        ),
      },
    ],
  },
  {
    id: "gemma-4-e2b-it",
    bundleDir: "gemma-4-e2b-it",
    name: "Gemma 2B",
    subtitle: "Gemma 4 E2B IT · Q4_K_M",
    vision: true,
    featured: true,
    gradient: ["#172554", "#7dd3fc"],
    logoUrl: LOGO.google,
    files: [
      {
        modelId: "gemma-4-E2B-it-Q4_K_M",
        url: hf("lmstudio-community/gemma-4-E2B-it-GGUF", "gemma-4-E2B-it-Q4_K_M.gguf"),
      },
      {
        modelId: "mmproj-gemma-4-E2B-it-BF16",
        url: hf("lmstudio-community/gemma-4-E2B-it-GGUF", "mmproj-gemma-4-E2B-it-BF16.gguf"),
      },
    ],
  },
  {
    id: "qwen35-9b",
    name: "Qwen3.5 9B",
    subtitle: "General · Q4_K_M",
    vision: true,
    featured: true,
    gradient: ["#0f172a", "#0ea5e9"],
    logoUrl: LOGO.qwen,
    files: [
      {
        modelId: "Qwen3.5-9B-Q4_K_M",
        url: hf("lmstudio-community/Qwen3.5-9B-GGUF", "Qwen3.5-9B-Q4_K_M.gguf"),
      },
      {
        modelId: "mmproj-Qwen3.5-9B-BF16",
        url: hf("lmstudio-community/Qwen3.5-9B-GGUF", "mmproj-Qwen3.5-9B-BF16.gguf"),
      },
    ],
  },
  {
    id: "qwen35-9b-uncensored",
    bundleDir: "qwen35-9b-uncensored",
    name: "Qwen3.5 9B Uncensored",
    subtitle: "HauhauCS · Q4_K_M",
    vision: true,
    featured: true,
    gradient: ["#3f0f0f", "#f97316"],
    logoUrl: LOGO.qwen,
    files: [
      {
        modelId: "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M",
        url: hf(
          "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
          "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf",
        ),
      },
      {
        modelId: "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16",
        url: hf(
          "HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive",
          "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf",
        ),
      },
    ],
  },
];

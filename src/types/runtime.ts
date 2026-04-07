/** Response from `get_llama_runtime_info` (ggml-org/llama.cpp releases). */
export interface LlamaRuntimeInfo {
  latestTag: string;
  installedTag: string | null;
  updateAvailable: boolean;
  assetName: string | null;
  assetUrl: string | null;
  assetSize: number | null;
  /** `cudart-llama-bin-win-cuda-12.4-x64.zip` — CUDA runtime DLLs (paired with CUDA 12 engine). */
  cudartAssetName: string | null;
  cudartUrl: string | null;
  cudartSize: number | null;
  binDir: string | null;
  /** Automated download + extract is implemented for Windows only in this build. */
  supported: boolean;
}

export type RuntimeVariant = "cpu" | "cuda12" | "vulkan";

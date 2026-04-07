import type { AppSettings } from "../../types/settings";

/** Mirrors `inference_launch_snapshot` in `engine.rs` — must stay in sync. */
export function inferenceLaunchSnapshot(s: AppSettings): string {
  return JSON.stringify({
    ctx: s.contextLength,
    ngl: s.gpuLayers,
    cpu_threads: s.cpuThreads,
    batch: s.inferenceBatchSize,
    ubatch: s.inferenceUbatchSize,
    parallel: s.inferenceParallel,
    fa: s.inferenceFlashAttn,
    mmap: s.inferenceMmap,
    mlock: s.inferenceMlock,
    kvo: s.inferenceKvOffload,
    kvu: s.inferenceKvUnified,
    rope_base: s.ropeFreqBase,
    rope_scale: s.ropeFreqScale,
    seed: s.inferenceSeed,
    ctk: s.inferenceCacheTypeK,
    ctv: s.inferenceCacheTypeV,
  });
}

/** Rough VRAM hint before load (weights fraction on GPU + KV scaling with context). Not exact. */
export function estimateInferenceVramGb(opts: {
  sizeBytes: number;
  layerCount: number;
  gpuLayers: number;
  contextLength: number;
}): number {
  const L = Math.max(1, opts.layerCount);
  const ngl =
    opts.gpuLayers < 0 ? L : Math.min(Math.max(0, opts.gpuLayers), L);
  const weightsGb = (opts.sizeBytes / 1e9) * (ngl / L);
  const kvGb =
    (opts.contextLength / 4096) * (opts.sizeBytes / 1e9) * 0.12;
  return Math.max(0, weightsGb + kvGb);
}

export function clampContext(n: number, maxCtx: number): number {
  const max = Math.max(512, maxCtx);
  const v = Math.round(Number.isFinite(n) ? n : 4096);
  return Math.min(max, Math.max(256, v));
}

/** Match catalog `modelId` to `list_local_models` ids (legacy `_` vs `.` stems). */
export function isCatalogFileOnDisk(localIds: Set<string>, catalogModelId: string): boolean {
  if (localIds.has(catalogModelId)) return true;
  const underscored = catalogModelId.replace(/\./g, "_");
  return underscored !== catalogModelId && localIds.has(underscored);
}

/** Vision projector GGUFs are loaded with the main model — hide from chat model pickers. */
export function isMMPROJModelId(id: string): boolean {
  if (id.startsWith("mmproj-")) return true;
  const lower = id.toLowerCase();
  // e.g. `gemma-4-E4B-it-mmproj-BF16.gguf` (some HF repos omit the `mmproj-` prefix)
  return lower.includes("-mmproj-");
}

/** GPT-OSS family weights are excluded — match Rust `is_legacy_gpt_oss_excluded`. */
export function isLegacyGptOssExcludedModelId(id: string): boolean {
  const norm = id
    .toLowerCase()
    .split("")
    .map((c) => (c === "." || c === "-" ? "_" : c))
    .join("");
  return norm.includes("gpt_oss");
}

export function filterMainChatModels<T extends { id: string }>(models: T[]): T[] {
  return models.filter(
    (m) => !isMMPROJModelId(m.id) && !isLegacyGptOssExcludedModelId(m.id),
  );
}

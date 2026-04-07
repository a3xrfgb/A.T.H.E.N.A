/** Catalog main-weight ids (dotted form); disk may use `_` instead of `.`. */
export const DEFAULT_CHAT_MODEL_CATALOG_ID = "gemma-4-E4B-it-Q4_K_M";

const PICKER_ROWS: { catalogId: string; label: string }[] = [
  { catalogId: "gemma-4-E4B-it-Q4_K_M", label: "Gemma-4-E4B" },
  { catalogId: "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M", label: "Gemma 4B uncensored" },
  { catalogId: "gemma-4-E2B-it-Q4_K_M", label: "Gemma 2B" },
  { catalogId: "Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q4_K_M", label: "Qwen3.5 Uncensored" },
  { catalogId: "Qwen3.5-9B-Q4_K_M", label: "Qwen3.5" },
];

/** Normalize GGUF stem so hyphen/dot variants match (e.g. `gemma-4-E4B` ↔ `gemma_4_E4B`). */
export function normalizeModelStem(s: string): string {
  return s.trim().replace(/\./g, "_").replace(/-/g, "_").toLowerCase();
}

export function diskIdMatchesCatalogId(diskId: string, catalogId: string): boolean {
  if (diskId === catalogId) return true;
  return normalizeModelStem(diskId) === normalizeModelStem(catalogId);
}

/**
 * Map any known id / catalog string to the exact `list_local_models` id (filename stem).
 * Prevents falling back to another model when settings and disk differ by `-` vs `_`.
 */
export function resolveToInstalledMainModelId(
  mains: { id: string }[],
  requestId: string | null | undefined,
): string | null {
  if (requestId == null || !String(requestId).trim()) return null;
  const r = String(requestId).trim();
  for (const m of mains) {
    if (m.id === r) return m.id;
  }
  for (const m of mains) {
    if (diskIdMatchesCatalogId(m.id, r)) return m.id;
  }
  return null;
}

/** Installed mains with short labels; known catalog models first in fixed order, then any other GGUFs. */
export function buildChatPickerModels(localMains: { id: string; name: string }[]): { id: string; name: string }[] {
  const used = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const { catalogId, label } of PICKER_ROWS) {
    const found = localMains.find((m) => diskIdMatchesCatalogId(m.id, catalogId));
    if (found) {
      out.push({ id: found.id, name: label });
      used.add(found.id);
    }
  }
  for (const m of localMains) {
    if (!used.has(m.id)) {
      out.push({ id: m.id, name: m.name });
    }
  }
  return out;
}

/** Prefer Gemma when no valid user choice (disk id). */
export function getPreferredDefaultChatModelId(localMains: { id: string }[]): string | null {
  const gemma = localMains.find((m) => diskIdMatchesCatalogId(m.id, DEFAULT_CHAT_MODEL_CATALOG_ID));
  if (gemma) return gemma.id;
  for (const { catalogId } of PICKER_ROWS) {
    const found = localMains.find((m) => diskIdMatchesCatalogId(m.id, catalogId));
    if (found) return found.id;
  }
  return localMains[0]?.id ?? null;
}

/** UI label matching the composer picker (disk id → short name). */
export function getChatModelDisplayLabel(modelId: string | null | undefined): string {
  if (modelId == null || !String(modelId).trim()) return "";
  const id = String(modelId);
  for (const { catalogId, label } of PICKER_ROWS) {
    if (diskIdMatchesCatalogId(id, catalogId)) return label;
  }
  return id;
}

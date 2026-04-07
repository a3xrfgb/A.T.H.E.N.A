/** Custom data transfer type for dragging one or more chat threads to a project. */
export const THREAD_DRAG_MIME = "application/x-athena-thread-ids+json";

export function readThreadIdsFromDataTransfer(dt: DataTransfer): string[] {
  try {
    const raw = dt.getData(THREAD_DRAG_MIME);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

import type { CanvasPersistedState } from "../../types/canvasWorkspace";

const KEY = "athena.canvas.workspace.v1";

export function loadCanvasState(): Partial<CanvasPersistedState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CanvasPersistedState>;
  } catch {
    return null;
  }
}

export function saveCanvasState(state: CanvasPersistedState): void {
  try {
    const sanitized: CanvasPersistedState = {
      ...state,
      nodes: state.nodes.map((n) => ({
        ...n,
        // blob: URLs are invalid after reload — omit so JSON save doesn't break
        mediaUrl: n.mediaUrl?.startsWith("blob:") ? undefined : n.mediaUrl,
      })),
    };
    localStorage.setItem(KEY, JSON.stringify(sanitized));
  } catch {
    /* ignore quota */
  }
}

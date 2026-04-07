export type CanvasNodeKind =
  | "chat"
  | "document"
  | "image"
  | "video"
  | "audio"
  | "note"
  | "code";

export interface CanvasPoint {
  x: number;
  y: number;
}

/** How a document card previews its file (browser blob or Tauri asset URL). */
export type CanvasDocumentPreview = "pdf" | "text" | "markdown" | "epub" | "unsupported";

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  /** For chat nodes */
  threadId?: string;
  /** For code nodes */
  code?: string;
  /** For image/video/audio nodes (data URL, blob URL, or asset URL from convertFileSrc) */
  mediaUrl?: string;
  /** For document: inline text / markdown source (small/medium files only) */
  documentText?: string;
  /** For document: how to render (PDF/epub use mediaUrl; unsupported shows a hint) */
  documentPreview?: CanvasDocumentPreview;
  /** Absolute path (Tauri) — used to rebuild mediaUrl after reload */
  filePath?: string;
}

export interface CanvasPersistedState {
  pan: CanvasPoint;
  zoom: number;
  nodes: CanvasNode[];
}

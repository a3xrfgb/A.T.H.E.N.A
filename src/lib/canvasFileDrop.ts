import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readTextFile, stat } from "@tauri-apps/plugin-fs";
import type { CanvasNode, CanvasNodeKind } from "../types/canvasWorkspace";
import { fileBaseName, guessDocumentPreviewFromName } from "./canvasDocumentPreview";

const MAX_TEXT_BYTES_TAURI = 1_800_000;

export { isTauri };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Guess kind from file path (Tauri drops only give paths). */
export function guessKindFromPath(filePath: string): CanvasNodeKind {
  const lower = filePath.replace(/\\/g, "/").toLowerCase();
  const base = lower.split("/").pop() ?? "";
  if (/\.(png|jpe?g|gif|webp|bmp|svg|ico|avif|heic|heif)$/.test(base)) return "image";
  if (/\.(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(base)) return "video";
  if (/\.(mp3|wav|ogg|flac|m4a|aac|opus|wma)$/.test(base)) return "audio";
  return "document";
}

function fileNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

/** Build a stable asset URL for local files (persists via `filePath` in saved state). */
export function mediaUrlFromFilePath(filePath: string): string {
  return convertFileSrc(filePath);
}

export type DropPartial = Omit<CanvasNode, "id" | "x" | "y" | "width" | "height"> & {
  width?: number;
  height?: number;
};

export async function nodePartialFromAbsolutePath(filePath: string): Promise<DropPartial> {
  const kind = guessKindFromPath(filePath);
  const title = fileNameFromPath(filePath);
  let size = 0;
  try {
    const s = await stat(filePath);
    size = Number(s.size);
  } catch {
    /* path may be outside fs scope */
  }
  const subtitle = size > 0 ? formatBytes(size) : undefined;

  const mediaUrl = mediaUrlFromFilePath(filePath);

  if (kind === "image") {
    return {
      kind,
      title,
      subtitle,
      filePath,
      mediaUrl,
      width: 300,
      height: 240,
    };
  }
  if (kind === "video") {
    return {
      kind,
      title,
      subtitle,
      filePath,
      mediaUrl,
      width: 340,
      height: 220,
    };
  }
  if (kind === "audio") {
    return {
      kind,
      title,
      subtitle,
      filePath,
      mediaUrl,
      width: 320,
      height: 96,
    };
  }

  const base = fileBaseName(filePath);
  const docKind = guessDocumentPreviewFromName(base, "");
  if (docKind === "pdf") {
    return {
      kind: "document",
      title,
      subtitle,
      filePath,
      mediaUrl,
      documentPreview: "pdf",
      width: 440,
      height: 560,
    };
  }
  if (docKind === "epub") {
    return {
      kind: "document",
      title,
      subtitle,
      filePath,
      mediaUrl,
      documentPreview: "epub",
      width: 420,
      height: 520,
    };
  }
  if (docKind === "text" || docKind === "markdown") {
    if (size > MAX_TEXT_BYTES_TAURI) {
      return {
        kind: "document",
        title,
        subtitle: subtitle ? `${subtitle} — large file` : "Large file",
        filePath,
        documentPreview: "unsupported",
      };
    }
    try {
      const documentText = await readTextFile(filePath);
      return {
        kind: "document",
        title,
        subtitle,
        filePath,
        documentText,
        documentPreview: docKind,
        width: 400,
        height: 380,
      };
    } catch {
      return {
        kind: "document",
        title,
        subtitle: subtitle ?? "File",
        filePath,
        documentPreview: "unsupported",
      };
    }
  }
  return {
    kind: "document",
    title,
    subtitle: subtitle ?? "File",
    filePath,
    documentPreview: "unsupported",
  };
}

/** Convert Tauri physical drop position to browser `clientX` / `clientY` (viewport). */
export async function tauriDropToClientCoords(position: PhysicalPosition | { x: number; y: number }): Promise<{
  clientX: number;
  clientY: number;
}> {
  const win = getCurrentWindow();
  const factor = await win.scaleFactor();
  const phys =
    position instanceof PhysicalPosition ? position : new PhysicalPosition(position.x, position.y);
  const logical = phys.toLogical(factor);
  return { clientX: logical.x, clientY: logical.y };
}

export type TauriDropHandler = (paths: string[], clientX: number, clientY: number) => void;

/**
 * Subscribe to OS file drops in Tauri (required on Windows; HTML5 file drop often does not receive files).
 */
export async function subscribeTauriFileDrop(handler: TauriDropHandler): Promise<() => void> {
  if (!isTauri()) return () => {};

  const webview = getCurrentWebview();
  const unlisten = await webview.onDragDropEvent((event) => {
    const p = event.payload;
    if (p.type !== "drop" || !p.paths?.length) return;
    void (async () => {
      const { clientX, clientY } = await tauriDropToClientCoords(p.position);
      handler(p.paths, clientX, clientY);
    })();
  });
  return unlisten;
}

/** Restore `mediaUrl` from persisted `filePath` after load. */
export function hydrateMediaUrlFromFilePath(node: CanvasNode): CanvasNode {
  if (!isTauri() || !node.filePath || node.mediaUrl) return node;
  const needsAsset =
    node.kind === "image" ||
    node.kind === "video" ||
    node.kind === "audio" ||
    (node.kind === "document" && (node.documentPreview === "pdf" || node.documentPreview === "epub"));
  if (!needsAsset) return node;
  return { ...node, mediaUrl: mediaUrlFromFilePath(node.filePath) };
}

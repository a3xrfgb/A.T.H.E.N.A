import { isTauri } from "@tauri-apps/api/core";
import { api } from "./tauri";
import type { UserAttachment } from "./userMessageContent";

const MAX_DOC_BYTES = 25 * 1024 * 1024;
const MAX_MEDIA_BYTES = 80 * 1024 * 1024;
const MAX_INLINED_TEXT_CHARS = 250_000;

/** Composer-only metadata for preview cards (stripped before send). */
export type ComposerAttachment = UserAttachment & {
  lineCount?: number;
  badge?: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

function tryDecodeUtf8(buf: ArrayBuffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

function inferMimeFromFilename(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  const map: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    json: "application/json",
    env: "text/plain",
    py: "text/x-python",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "audio/ogg",
    pdf: "application/pdf",
    csv: "text/csv",
    tsx: "text/typescript",
    ts: "text/typescript",
    jsx: "text/javascript",
    js: "text/javascript",
    css: "text/css",
    html: "text/html",
    htm: "text/html",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
  };
  return map[ext] ?? "application/octet-stream";
}

export function attachmentBadgeFromName(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() ?? "FILE" : "FILE";
  return ext.length <= 4 ? ext : ext.slice(0, 4);
}

export function lineCountFromText(text: string | undefined): number | undefined {
  if (text == null || text === "") return undefined;
  return text.split(/\r\n|\r|\n/).length;
}

function maxBytesFor(name: string, mime: string): number {
  const lower = name.toLowerCase();
  if (
    mime.startsWith("audio/") ||
    mime.startsWith("video/") ||
    /\.(wav|mp3|mp4|m4a|webm|ogg|mkv|mov|avi)$/i.test(lower)
  ) {
    return MAX_MEDIA_BYTES;
  }
  return MAX_DOC_BYTES;
}

async function extractPdfText(buf: ArrayBuffer): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const workerUrl =
      typeof workerMod === "object" && workerMod && "default" in workerMod
        ? (workerMod as { default: string }).default
        : String(workerMod);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (item && typeof item === "object" && "str" in item) {
          full += String((item as { str: string }).str);
        }
      }
      full += "\n";
    }
    const t = full.trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

function isProbablyAudio(mime: string, name: string): boolean {
  if (mime.startsWith("audio/")) return true;
  return /\.(wav|mp3|aac|flac|ogg|m4a)$/i.test(name);
}

/**
 * Build a v2 attachment from a user-selected file: text, PDF text, or binary note;
 * optional librosa summary for audio when Python + librosa are available (Tauri).
 */
export async function fileToUserAttachment(file: File): Promise<ComposerAttachment> {
  const name = file.name?.trim() || "file";
  let mime = file.type?.trim() || inferMimeFromFilename(name);
  if (!mime || mime === "application/octet-stream") {
    mime = inferMimeFromFilename(name);
  }

  const limit = maxBytesFor(name, mime);
  if (file.size > limit) {
    throw new Error(`FILE_TOO_LARGE:${limit}`);
  }

  const buf = await file.arrayBuffer();
  const dataBase64 = arrayBufferToBase64(buf);

  const lowerName = name.toLowerCase();
  let extractedText: string | undefined;

  if (lowerName.endsWith(".pdf") || mime === "application/pdf") {
    const pdfText = await extractPdfText(buf);
    if (pdfText) {
      extractedText =
        pdfText.length > MAX_INLINED_TEXT_CHARS
          ? `${pdfText.slice(0, MAX_INLINED_TEXT_CHARS)}\n\n[…truncated]`
          : pdfText;
    } else {
      extractedText = `[PDF: ${name} — text could not be extracted in the app. Summarize or ask for pasted excerpts.]`;
    }
  } else {
    const utf8 = tryDecodeUtf8(buf);
    if (utf8 !== null) {
      extractedText =
        utf8.length > MAX_INLINED_TEXT_CHARS
          ? `${utf8.slice(0, MAX_INLINED_TEXT_CHARS)}\n\n[…truncated]`
          : utf8;
    } else if (mime.startsWith("video/") || lowerName.match(/\.(mp4|webm|mov|mkv)$/i)) {
      extractedText = `[Video file: ${name} (${mime}, ${(file.size / 1024).toFixed(1)} KB). Visual/audio is sent to multimodal models when supported; describe what you need.]`;
    } else {
      extractedText = `[Attached file: ${name} (${mime}, ${(file.size / 1024).toFixed(1)} KB). Not UTF-8 text — describe what you need or paste excerpts.]`;
    }
  }

  if (isProbablyAudio(mime, name) && isTauri()) {
    try {
      const summary = await api.analyzeAudioLibrosa(dataBase64, name);
      if (summary?.trim()) {
        extractedText = `${summary.trim()}\n\n${extractedText ?? ""}`.trim();
      }
    } catch {
      /* librosa optional */
    }
  }

  let lineCount = lineCountFromText(extractedText);
  const et = extractedText ?? "";
  if (
    et.startsWith("[Attached file:") ||
    et.startsWith("[Video file:") ||
    (et.startsWith("[PDF:") && et.includes("could not"))
  ) {
    lineCount = undefined;
  }

  const badge = attachmentBadgeFromName(name);

  return {
    name,
    mime,
    dataBase64,
    extractedText,
    lineCount,
    badge,
  };
}

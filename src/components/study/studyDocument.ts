import type { ParseResult } from "papaparse";

export type StudyDocKind = "pdf" | "epub" | "csv" | "txt" | "md" | "unknown";

export function extToKind(name: string): StudyDocKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "epub") return "epub";
  if (ext === "csv") return "csv";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "txt" || ext === "text") return "txt";
  return "unknown";
}

export type StudyCsvData = ParseResult<Record<string, string>>;

/** In-memory study document payload (kept in study store across tab switches). */
export type LoadedDoc =
  | { kind: "pdf"; name: string; blobUrl: string }
  | { kind: "epub"; name: string; arrayBuffer: ArrayBuffer }
  | { kind: "csv"; name: string; data: StudyCsvData }
  | { kind: "txt" | "unknown"; name: string; text: string }
  | { kind: "md"; name: string; markdown: string };

export function uint8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

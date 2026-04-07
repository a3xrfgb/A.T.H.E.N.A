import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { jsPDF } from "jspdf";
import { parseAssistantMessageContent } from "./assistantMessage";
import { parseUserMessageContent } from "./userMessageContent";
import type { Message } from "../types/chat";

export type ChatExportFormat = "text" | "markdown" | "pdf" | "json";

function userDisplayText(raw: string): string {
  const p = parseUserMessageContent(raw);
  const parts: string[] = [];
  if (p.text.trim()) parts.push(p.text.trim());
  if (p.imageDataUrl) parts.push("[Image attached]");
  if (p.legacyImageOnly) parts.push("[Image attached (legacy)]");
  if (p.attachments?.length) {
    parts.push(`[Files: ${p.attachments.map((a) => a.name).join(", ")}]`);
  }
  return parts.join("\n\n") || raw;
}

function assistantDisplayText(raw: string): string {
  const p = parseAssistantMessageContent(raw);
  const parts: string[] = [];
  if (p.thinking.trim()) {
    parts.push(`[Thinking]\n${p.thinking.trim()}`);
  }
  if (p.displayFinal.trim()) {
    parts.push(p.displayFinal.trim());
  }
  return parts.join("\n\n") || raw;
}

export function filterExportableMessages(messages: Message[]): Message[] {
  return messages
    .filter(
      (m) =>
        m.role !== "system" &&
        m.id !== "temp-user" &&
        m.id !== "streaming",
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

function safeFilenameBase(title: string): string {
  const t = title.replace(/[/\\?%*:|"<>]/g, "-").trim() || "chat";
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

const FORMAT_EXT: Record<ChatExportFormat, string> = {
  text: "txt",
  markdown: "md",
  pdf: "pdf",
  json: "json",
};

const FORMAT_FILTER_NAME: Record<ChatExportFormat, string> = {
  text: "Text",
  markdown: "Markdown",
  pdf: "PDF",
  json: "JSON",
};

export function buildTextExport(messages: Message[], threadTitle: string): string {
  const lines = [`${threadTitle}`, ""];
  for (const m of filterExportableMessages(messages)) {
    const body = m.role === "user" ? userDisplayText(m.content) : assistantDisplayText(m.content);
    lines.push(m.role === "user" ? "User:" : "Assistant:");
    lines.push(body);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function buildMarkdownExport(messages: Message[], threadTitle: string): string {
  const lines = [`# ${threadTitle}`, ""];
  for (const m of filterExportableMessages(messages)) {
    const body = m.role === "user" ? userDisplayText(m.content) : assistantDisplayText(m.content);
    lines.push(`## ${m.role === "user" ? "User" : "Assistant"}`);
    lines.push("");
    lines.push(body);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function buildJsonExport(
  messages: Message[],
  threadTitle: string,
  threadId: string,
): string {
  const filtered = filterExportableMessages(messages);
  const payload = {
    exportedAt: new Date().toISOString(),
    threadId,
    threadTitle,
    messages: filtered.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      modelId: m.modelId,
      content:
        m.role === "user" ? userDisplayText(m.content) : assistantDisplayText(m.content),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function buildPdfBytes(messages: Message[], threadTitle: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;
  const bodySize = 10;
  const titleSize = 14;
  const lineLeading = 13;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFontSize(titleSize);
  const titleLines = doc.splitTextToSize(threadTitle, maxW);
  for (const line of titleLines) {
    ensureSpace(lineLeading);
    doc.text(line, margin, y);
    y += lineLeading;
  }
  y += lineLeading;

  doc.setFontSize(bodySize);
  for (const m of filterExportableMessages(messages)) {
    const label = m.role === "user" ? "User" : "Assistant";
    const body = m.role === "user" ? userDisplayText(m.content) : assistantDisplayText(m.content);
    const block = `${label}\n\n${body}`;
    const lines = doc.splitTextToSize(block, maxW);
    for (const line of lines) {
      ensureSpace(lineLeading);
      doc.text(line, margin, y);
      y += lineLeading;
    }
    y += lineLeading * 0.5;
  }

  const out = doc.output("arraybuffer");
  return new Uint8Array(out);
}

function buildPayload(
  format: ChatExportFormat,
  messages: Message[],
  threadTitle: string,
  threadId: string,
): string | Uint8Array {
  switch (format) {
    case "text":
      return buildTextExport(messages, threadTitle);
    case "markdown":
      return buildMarkdownExport(messages, threadTitle);
    case "json":
      return buildJsonExport(messages, threadTitle, threadId);
    case "pdf":
      return buildPdfBytes(messages, threadTitle);
    default:
      return buildTextExport(messages, threadTitle);
  }
}

const MIME: Record<ChatExportFormat, string> = {
  text: "text/plain",
  markdown: "text/markdown",
  pdf: "application/pdf",
  json: "application/json",
};

function browserDownload(filename: string, data: string | Uint8Array, mime: string): void {
  const blob =
    data instanceof Uint8Array
      ? new Blob([data], { type: mime })
      : new Blob([data], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveInBrowser(
  filename: string,
  data: string | Uint8Array,
  format: ChatExportFormat,
): Promise<void> {
  const mime = MIME[format];
  const extension = FORMAT_EXT[format];
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;

  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: FORMAT_FILTER_NAME[format],
            accept: { [mime]: [`.${extension}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(
        data instanceof Uint8Array ? new Blob([data]) : new Blob([data], { type: `${mime};charset=utf-8` }),
      );
      await writable.close();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  browserDownload(filename, data, mime);
}

/**
 * Prompts for a save location (native dialog in Tauri, picker or download in the browser), then writes the export.
 */
export async function exportChatToFile(
  format: ChatExportFormat,
  threadTitle: string,
  threadId: string,
  messages: Message[],
): Promise<boolean> {
  const ext = FORMAT_EXT[format];
  const base = safeFilenameBase(threadTitle);
  const defaultName = `${base}.${ext}`;

  if (isTauri()) {
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: FORMAT_FILTER_NAME[format], extensions: [ext] }],
    });
    if (path == null || path === "") return false;
    const payload = buildPayload(format, messages, threadTitle, threadId);
    if (payload instanceof Uint8Array) {
      await writeFile(path, payload);
    } else {
      await writeTextFile(path, payload);
    }
    return true;
  }

  const payload = buildPayload(format, messages, threadTitle, threadId);
  await saveInBrowser(defaultName, payload, format);
  return true;
}

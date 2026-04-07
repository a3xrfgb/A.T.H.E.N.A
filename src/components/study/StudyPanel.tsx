import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import ePub, { type Book, type Rendition } from "epubjs";
import { BookMarked, BookOpen, FileCode, FileSpreadsheet, FileText, Upload } from "lucide-react";
import Papa from "papaparse";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { NoteMarkdownPreview } from "../notes/NoteMarkdownPreview";
import { useStudyStore } from "../../store/studyStore";
import { useUiStore } from "../../store/uiStore";
import type { LoadedDoc, StudyCsvData, StudyDocKind } from "./studyDocument";
import { extToKind, uint8ToArrayBuffer } from "./studyDocument";

const ACCEPT =
  ".pdf,.epub,.txt,.csv,.md,.markdown,text/plain,text/csv,text/markdown,application/pdf";

/** Readest-inspired reading surface (warm paper / deep ink; [readest/readest](https://github.com/readest/readest)). */
function readestSurfaceClass(dark: boolean) {
  return dark
    ? "bg-[#161412] text-[#f5f2eb] border-[#2a2724] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "bg-[#faf8f5] text-[#1c1917] border-[#e8e4dc] shadow-[0_1px_2px_rgba(28,25,23,0.06)]";
}

function ReadestChrome({
  title,
  subtitle,
  distractionFree,
  onClose,
  dark,
  children,
}: {
  title: string;
  subtitle?: string;
  distractionFree: boolean;
  onClose: () => void;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col font-[Literata,Georgia,serif]",
        distractionFree ? "study-distraction-free" : "",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5",
          readestSurfaceClass(dark),
          distractionFree ? "border-opacity-60" : "",
        )}
      >
        <div className="min-w-0 text-left">
          <h2 className="truncate font-semibold tracking-tight" style={{ fontFamily: "'Literata', Georgia, serif" }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-xs opacity-75" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-1.5 text-sm transition",
            dark
              ? "border-[#3f3a36] bg-[#1e1c19] hover:bg-[#2a2724]"
              : "border-[#e8e4dc] bg-white/80 hover:bg-white",
          )}
        >
          Close
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function PdfViewer({ blobUrl, dark }: { blobUrl: string; dark: boolean }) {
  return (
    <div className={cn("h-full w-full", dark ? "bg-[#0c0b0a]" : "bg-[#525252]")}>
      <embed
        src={blobUrl}
        type="application/pdf"
        className="h-full w-full"
        title="PDF"
      />
    </div>
  );
}

function EpubViewer({ arrayBuffer, dark }: { arrayBuffer: ArrayBuffer; dark: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let book: Book | null = null;
    let rendition: Rendition | null = null;

    (async () => {
      try {
        setErr(null);
        el.innerHTML = "";
        book = ePub(arrayBuffer);
        await book.ready;
        if (cancelled || !el) return;
        rendition = book.renderTo(el, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        if (dark && rendition.themes) {
          rendition.themes.register("athena", {
            body: {
              background: "#161412",
              color: "#f5f2eb",
            },
            a: { color: "#fdba74" },
          });
          rendition.themes.select("athena");
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        rendition?.destroy?.();
      } catch {
        /* ignore */
      }
      try {
        book?.destroy?.();
      } catch {
        /* ignore */
      }
      if (el) el.innerHTML = "";
    };
  }, [arrayBuffer, dark]);

  if (err) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-6 text-center text-sm",
          readestSurfaceClass(dark),
        )}
      >
        <p>Could not open this EPUB: {err}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("h-full min-h-[320px] w-full", dark ? "bg-[#161412]" : "bg-[#faf8f5]")}
      ref={hostRef}
    />
  );
}

function CsvViewer({ data, dark }: { data: StudyCsvData; dark: boolean }) {
  const rows = data.data;
  const cols = data.meta.fields?.length
    ? data.meta.fields
    : rows[0]
      ? Object.keys(rows[0])
      : [];

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-8 text-sm opacity-80",
          readestSurfaceClass(dark),
        )}
      >
        This CSV has no rows to display.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-full overflow-auto",
        readestSurfaceClass(dark),
        dark ? "scrollbar-thin" : "",
      )}
    >
      <div className="p-4">
        <p
          className="mb-3 text-xs opacity-80"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} · {cols.length} column
          {cols.length === 1 ? "" : "s"}. Works for spreadsheets, exports, and typical contacts-style CSVs.
        </p>
        <div className="overflow-x-auto rounded-lg border border-inherit">
          <table className="w-max min-w-full border-collapse text-left text-sm">
            <thead className={cn("sticky top-0 z-[1]", dark ? "bg-[#1e1c19]" : "bg-[#f0ebe3]")}>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    className="border-b px-3 py-2 font-semibold"
                    style={{ borderColor: dark ? "#3f3a36" : "#e8e4dc" }}
                  >
                    {c || "(empty)"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    i % 2 === 0 ? (dark ? "bg-[#161412]" : "bg-[#faf8f5]") : dark ? "bg-[#1a1816]" : "bg-[#f5f0e8]",
                  )}
                >
                  {cols.map((c) => (
                    <td
                      key={c}
                      className="max-w-[min(28rem,40vw)] truncate border-t px-3 py-1.5 font-mono text-[13px]"
                      style={{ borderColor: dark ? "#2a2724" : "#ebe5dc" }}
                      title={row[c] ?? ""}
                    >
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TxtViewer({ text, dark }: { text: string; dark: boolean }) {
  return (
    <div
      className={cn("h-full overflow-auto p-6", readestSurfaceClass(dark))}
    >
      <pre
        className={cn(
          "whitespace-pre-wrap break-words text-[13px] leading-relaxed",
          "font-[ui-monospace,SFMono-Regular,'Cascadia_Mono','Segoe_UI_Mono',Consolas,monospace]",
        )}
      >
        {text}
      </pre>
    </div>
  );
}

function MdViewer({ markdown, dark }: { markdown: string; dark: boolean }) {
  return (
    <div className={cn("h-full overflow-auto font-sans", readestSurfaceClass(dark))}>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <NoteMarkdownPreview markdown={markdown} className="text-[var(--app-text)]" />
      </div>
    </div>
  );
}

async function loadFromPath(path: string, name: string, kind: StudyDocKind): Promise<LoadedDoc> {
  if (kind === "pdf") {
    const raw = await readFile(path);
    const blob = new Blob([raw], { type: "application/pdf" });
    return { kind: "pdf", name, blobUrl: URL.createObjectURL(blob) };
  }
  if (kind === "epub") {
    const raw = await readFile(path);
    return { kind: "epub", name, arrayBuffer: uint8ToArrayBuffer(raw) };
  }
  if (kind === "csv") {
    const t = await readTextFile(path);
    const parsed = Papa.parse<Record<string, string>>(t, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    return { kind: "csv", name, data: parsed };
  }
  if (kind === "md") {
    const markdown = await readTextFile(path);
    return { kind: "md", name, markdown };
  }
  const text = await readTextFile(path);
  return { kind: kind === "unknown" ? "unknown" : "txt", name, text };
}

function loadFromBrowserFile(file: File): Promise<LoadedDoc> {
  const name = file.name;
  const kind = extToKind(name);

  return new Promise((resolve, reject) => {
    if (kind === "pdf") {
      const blobUrl = URL.createObjectURL(file);
      resolve({ kind: "pdf", name, blobUrl });
      return;
    }
    if (kind === "epub") {
      file
        .arrayBuffer()
        .then((arrayBuffer) => resolve({ kind: "epub", name, arrayBuffer }))
        .catch(reject);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (kind === "csv") {
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        resolve({ kind: "csv", name, data: parsed });
        return;
      }
      if (kind === "md") {
        resolve({ kind: "md", name, markdown: text });
        return;
      }
      resolve({ kind: kind === "unknown" ? "unknown" : "txt", name, text });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function StudyPanel() {
  const effectiveDark = useEffectiveDark();
  const pushToast = useUiStore((s) => s.pushToast);
  const doc = useStudyStore((s) => s.doc);
  const openDoc = useStudyStore((s) => s.openDoc);
  const clearDoc = useStudyStore((s) => s.clearDoc);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyLoaded = useCallback(
    async (path: string, name: string) => {
      const kind = extToKind(name);
      try {
        if (isTauri()) {
          const loaded = await loadFromPath(path, name, kind);
          openDoc(loaded);
        }
      } catch (e) {
        pushToast(String(e), "error");
      }
    },
    [openDoc, pushToast],
  );

  const pickFile = useCallback(async () => {
    try {
      if (isTauri()) {
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "Documents",
              extensions: ["pdf", "epub", "txt", "csv", "md", "markdown"],
            },
          ],
        });
        if (selected === null || Array.isArray(selected)) return;
        const base = selected.replace(/\\/g, "/").split("/").pop() ?? "document";
        await applyLoaded(selected, base);
        return;
      }
      fileInputRef.current?.click();
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [applyLoaded, pushToast]);

  const onInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const loaded = await loadFromBrowserFile(file);
        openDoc(loaded);
      } catch (err) {
        pushToast(String(err), "error");
      }
    },
    [openDoc, pushToast],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      try {
        if (isTauri()) {
          pushToast("Use “Import file” to open from disk in the desktop app.", "info");
          return;
        }
        const loaded = await loadFromBrowserFile(file);
        openDoc(loaded);
      } catch (err) {
        pushToast(String(err), "error");
      }
    },
    [openDoc, pushToast],
  );

  const distraction = doc && (doc.kind === "pdf" || doc.kind === "epub");

  if (doc) {
    const subtitle =
      doc.kind === "pdf"
        ? "Distraction-free reading · PDF"
        : doc.kind === "epub"
          ? "Distraction-free reading · EPUB"
          : doc.kind === "csv"
            ? "Table view · CSV"
            : doc.kind === "txt"
              ? "Plain text"
              : doc.kind === "md"
                ? "Markdown"
                : "Plain text (unknown type)";

    return (
      <ReadestChrome
        title={doc.name}
        subtitle={subtitle}
        distractionFree={!!distraction}
        onClose={clearDoc}
        dark={effectiveDark}
      >
        {doc.kind === "pdf" && <PdfViewer blobUrl={doc.blobUrl} dark={effectiveDark} />}
        {doc.kind === "epub" && <EpubViewer arrayBuffer={doc.arrayBuffer} dark={effectiveDark} />}
        {doc.kind === "csv" && <CsvViewer data={doc.data} dark={effectiveDark} />}
        {doc.kind === "md" && <MdViewer markdown={doc.markdown} dark={effectiveDark} />}
        {(doc.kind === "txt" || doc.kind === "unknown") && <TxtViewer text={doc.text} dark={effectiveDark} />}
      </ReadestChrome>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden font-sans"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ACCEPT}
        onChange={onInputChange}
      />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10",
          effectiveDark ? "bg-[#0f0e0d]" : "bg-[#f7f4ef]",
        )}
      >
        <div
          className={cn(
            "w-full max-w-lg rounded-2xl p-8 text-center",
            "border border-white/50 bg-white/45 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl backdrop-saturate-150",
            "dark:border-white/[0.12] dark:bg-white/[0.06] dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border",
              effectiveDark
                ? "border-white/10 bg-white/[0.05]"
                : "border-white/60 bg-white/50",
            )}
          >
            <BookOpen className={cn("h-7 w-7", effectiveDark ? "text-[#fb923c]" : "text-[#c2410c]")} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">Import a document</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--app-muted)]">
            Import PDF, EPUB, TXT, CSV, or Markdown
          </p>
          <ul className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-2 text-left text-xs text-[var(--app-muted)]">
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
              )}
            >
              <BookMarked className="h-3.5 w-3.5 shrink-0 opacity-70" />
              PDF · EPUB
            </li>
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 opacity-70" />
              CSV · sheets
            </li>
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
              TXT
            </li>
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
              )}
            >
              <FileCode className="h-3.5 w-3.5 shrink-0 opacity-70" />
              Markdown
            </li>
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                effectiveDark ? "border-white/10 bg-white/[0.04]" : "border-white/40 bg-white/35",
              )}
            >
              <Upload className="h-3.5 w-3.5 shrink-0 opacity-70" />
              Local files
            </li>
          </ul>
          <button
            type="button"
            onClick={() => void pickFile()}
            className={cn(
              "mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition",
              effectiveDark
                ? "bg-[#c2410c] text-white hover:bg-[#ea580c]"
                : "bg-[#c2410c] text-white shadow-sm hover:bg-[#9a3412]",
            )}
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import file
          </button>
          {!isTauri() ? (
            <p className="mt-4 text-xs text-[var(--app-muted)]">Or drop a file onto this area (web)</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

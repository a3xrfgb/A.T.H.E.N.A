import type { CanvasDocumentPreview } from "../types/canvasWorkspace";

const MAX_TEXT_BYTES = 1_800_000;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const PDF_EXT = /\.pdf$/i;
const EPUB_EXT = /\.epub$/i;

/** Extensions we read as UTF-8 text for the canvas preview. */
const TEXT_EXT =
  /\.(txt|md|markdown|env|gitignore|dockerignore|editorconfig|ini|log|csv|tsv|json|jsonc|json5|ya?ml|toml|xml|html?|css|scss|sass|less|m?jsx?|tsx?|mts|cts|cjs|vue|svelte|php|rb|rs|go|py|pyw|java|kt|kts|swift|c|cc|cxx|cpp|h|hpp|cs|fs|fsx|sql|sh|bash|zsh|fish|ps1|bat|cmd|cmake|make|dockerfile|graphql|gql|proto|rst|adoc|tex|vim|el|cljs|clj|edn|hs|lua|nim|pl|pm|r|dart|gradle|properties|cfg|conf|config)$/i;

export function fileBaseName(pathOrName: string): string {
  const s = pathOrName.replace(/\\/g, "/");
  const parts = s.split("/");
  return parts[parts.length - 1] || pathOrName;
}

export function guessDocumentPreviewFromName(name: string, mime: string): CanvasDocumentPreview {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || PDF_EXT.test(lower)) return "pdf";
  if (mime === "application/epub+zip" || EPUB_EXT.test(lower)) return "epub";
  if (mime.startsWith("text/") || TEXT_EXT.test(lower)) return lower.endsWith(".md") || lower.endsWith(".markdown") ? "markdown" : "text";
  return "unsupported";
}

function readBrowserFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsText(file);
  });
}

export type DocumentDropPartial = {
  subtitle: string;
  mediaUrl?: string;
  documentText?: string;
  documentPreview: CanvasDocumentPreview;
  width?: number;
  height?: number;
};

/**
 * Build fields for a dropped File when it should be a document card with preview.
 */
export async function documentPartialFromBrowserFile(file: File): Promise<DocumentDropPartial> {
  const name = file.name;
  const mime = file.type || "";
  const sizeStr = `${mime || fileBaseName(name)} · ${formatBytes(file.size)}`;
  const kind = guessDocumentPreviewFromName(name, mime);

  if (kind === "pdf") {
    return {
      subtitle: sizeStr,
      mediaUrl: URL.createObjectURL(file),
      documentPreview: "pdf",
      width: 440,
      height: 560,
    };
  }

  if (kind === "epub") {
    return {
      subtitle: sizeStr,
      mediaUrl: URL.createObjectURL(file),
      documentPreview: "epub",
      width: 420,
      height: 520,
    };
  }

  if (kind === "text" || kind === "markdown") {
    if (file.size > MAX_TEXT_BYTES) {
      return {
        subtitle: `${sizeStr} — ${fileBaseName(name)}`,
        documentPreview: "unsupported",
      };
    }
    try {
      const documentText = await readBrowserFileAsText(file);
      return {
        subtitle: sizeStr,
        documentText,
        documentPreview: kind,
        width: 400,
        height: 380,
      };
    } catch {
      return { subtitle: sizeStr, documentPreview: "unsupported" };
    }
  }

  return {
    subtitle: sizeStr,
    documentPreview: "unsupported",
  };
}

import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js";
import "../../styles/hljs-github-dark-scoped.css";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import { Copy } from "lucide-react";

export type NoteMarkdownPreviewProps = {
  markdown: string;
  className?: string;
  onWikiLink?: (page: string) => void;
  onTagClick?: (tag: string) => void;
};

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "plaintext";
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for environments without clipboard permission.
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        /* ignore */
      }
    }
  };

  let highlighted = code;
  try {
    highlighted = hljs.highlight(code, { language: lang }).value;
  } catch {
    highlighted = hljs.highlightAuto(code).value;
  }
  return (
    <div className="relative my-3 overflow-x-auto rounded-lg border border-[var(--app-border)] bg-[#111114] group">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCopy}
        className="absolute right-2 top-2 z-10 rounded-md bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/90 opacity-0 transition hover:bg-black/50 group-hover:opacity-100 focus:opacity-100"
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? (
          "Copied"
        ) : (
          <span className="inline-flex items-center gap-1">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </span>
        )}
      </button>
      <pre className="hljs m-0 min-w-full overflow-x-auto p-3 pt-8 font-mono text-[12px] leading-relaxed text-[#f0f0f5]">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function JsonBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const raw = String(children ?? "").replace(/\n$/, "");
  const [copied, setCopied] = useState(false);
  let parsed: unknown | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (parsed === null) return <CodeBlock className={className}>{children}</CodeBlock>;

  const pretty = (() => {
    try {
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  })();

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  const renderValue = (v: unknown, depth: number): React.ReactNode => {
    const pad = Math.min(24, depth * 12);
    if (v === null) {
      return (
        <div style={{ paddingLeft: pad }}>
          <span className="text-[var(--app-muted)]">null</span>
        </div>
      );
    }
    if (typeof v === "string") {
      return (
        <div style={{ paddingLeft: pad }}>
          <span className="text-[#e6c200]">{JSON.stringify(v)}</span>
        </div>
      );
    }
    if (typeof v === "number") {
      return (
        <div style={{ paddingLeft: pad }}>
          <span className="text-[#22c55e]">{String(v)}</span>
        </div>
      );
    }
    if (typeof v === "boolean") {
      return (
        <div style={{ paddingLeft: pad }}>
          <span className={v ? "text-[#f97316]" : "text-[#94a3b8]"}>{String(v)}</span>
        </div>
      );
    }
    if (Array.isArray(v)) {
      return (
        <details open={depth < 1} style={{ paddingLeft: pad }}>
          <summary className="text-accent">{`Array(${v.length})`}</summary>
          {v.map((x, i) => (
            <div key={i}>{renderValue(x, depth + 1)}</div>
          ))}
        </details>
      );
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const entries = Object.entries(obj);
      return (
        <details open={depth < 1} style={{ paddingLeft: pad }}>
          <summary className="text-accent">{`Object(${entries.length})`}</summary>
          {entries.map(([k, val]) => (
            <div key={k}>
              <div style={{ paddingLeft: pad + 8 }}>
                <span className="font-semibold text-accent">{k}</span>
              </div>
              {renderValue(val, depth + 1)}
            </div>
          ))}
        </details>
      );
    }
    return (
      <div style={{ paddingLeft: pad }}>
        <span>{String(v)}</span>
      </div>
    );
  };

  return (
    <div className="relative my-3 overflow-x-auto rounded-lg border border-[var(--app-border)] bg-[#111114] p-3 group">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCopy}
        className="absolute right-2 top-2 z-10 rounded-md bg-black/30 px-2 py-1 text-[11px] font-medium text-white/90 opacity-0 transition hover:bg-black/50 group-hover:opacity-100 focus:opacity-100"
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? "Copied" : "Copy"}
      </button>

      <div className="min-w-full pt-6 font-mono text-[12px] leading-relaxed text-[#f0f0f5]">
        {renderValue(parsed, 0)}
      </div>
    </div>
  );
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const trimmed = code.trim();
    if (!trimmed) {
      node.innerHTML = "";
      return;
    }

    const theme = document.documentElement.classList.contains("dark") ? "dark" : "default";
    // Mermaid init is global, but it's cheap; keep it in-sync with theme.
    (mermaid as any).initialize?.({ startOnLoad: false, theme });

    const result = (mermaid as any).render?.(idRef.current, trimmed);

    // Mermaid versions differ: promise vs direct.
    if (result && typeof result.then === "function") {
      result
        .then((r: any) => {
          if (!containerRef.current) return;
          node.innerHTML = r?.svg ?? String(r ?? "");
        })
        .catch(() => {
          node.textContent = "Failed to render mermaid diagram.";
        });
      return;
    }

    try {
      if (typeof result === "string") node.innerHTML = result;
      else node.innerHTML = (result as any)?.svg ?? "";
    } catch {
      node.textContent = "Failed to render mermaid diagram.";
    }
  }, [code]);

  return <div ref={containerRef} className="my-3 overflow-x-auto" />;
}

const previewShell =
  "note-md-preview max-w-none text-[13px] leading-relaxed text-[var(--app-text)] " +
  "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-[var(--app-text)] " +
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--app-text)] " +
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold " +
  "[&_p]:my-2 [&_li]:my-0.5 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:text-accent [&_a]:underline " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--app-border)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--app-muted)] " +
  "[&_hr]:my-4 [&_hr]:border-[var(--app-border)] " +
  "[&_strong]:font-semibold [&_em]:italic " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--app-border)] [&_th]:bg-[var(--app-surface)] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-[var(--app-border)] [&_td]:px-2 [&_td]:py-1";

function preprocessForWikiAndTags(md: string): string {
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let out = md.replace(/```[^\n]*\n[\s\S]*?```/g, (m) => {
    const token = `@@CODEBLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(m);
    return token;
  });

  out = out.replace(/`[^`]*`/g, (m) => {
    const token = `@@INLINECODE_${inlineCodes.length}@@`;
    inlineCodes.push(m);
    return token;
  });

  // [[Wiki links]]
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, page: string) => {
    const enc = encodeURIComponent(page);
    return `[${page}](athena-wiki:${enc})`;
  });

  // #tags
  out = out.replace(/(^|[\s\(\[\{])#([A-Za-z0-9_-]+)/g, (_m, prefix: string, tag: string) => {
    const enc = encodeURIComponent(tag);
    return `${prefix}[#${tag}](athena-tag:${enc})`;
  });

  for (let i = 0; i < inlineCodes.length; i += 1) {
    out = out.replace(`@@INLINECODE_${i}@@`, inlineCodes[i]!);
  }
  for (let i = 0; i < codeBlocks.length; i += 1) {
    out = out.replace(`@@CODEBLOCK_${i}@@`, codeBlocks[i]!);
  }

  return out;
}

export function NoteMarkdownPreview({
  markdown,
  className,
  onWikiLink,
  onTagClick,
}: NoteMarkdownPreviewProps) {
  const processed = preprocessForWikiAndTags(markdown);

  return (
    <div className={cn("note-md-preview-root", previewShell, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClass, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const lang = (match?.[1] ?? "").toLowerCase();
            const isBlock = match || String(children).includes("\n");
            if (isBlock) {
              if (lang === "mermaid") {
                return <MermaidDiagram code={String(children ?? "")} />;
              }
              if (lang === "json" || lang === "jsonc") {
                return <JsonBlock className={codeClass}>{children}</JsonBlock>;
              }
              return <CodeBlock className={codeClass}>{children}</CodeBlock>;
            }
            return (
              <code
                className="rounded bg-black/[0.08] px-1 py-0.5 font-mono text-[0.9em] text-accent dark:bg-white/10"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ href, children, ...props }) {
            const hrefStr = href ? String(href) : "";
            if (hrefStr.startsWith("athena-wiki:")) {
              const page = decodeURIComponent(hrefStr.slice("athena-wiki:".length));
              return (
                <a
                  {...props}
                  href="#"
                  className="text-accent underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    onWikiLink?.(page);
                  }}
                >
                  {children}
                </a>
              );
            }
            if (hrefStr.startsWith("athena-tag:")) {
              const tag = decodeURIComponent(hrefStr.slice("athena-tag:".length));
              return (
                <a
                  {...props}
                  href="#"
                  className="text-accent underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    onTagClick?.(tag);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a {...props} href={hrefStr} className="text-accent underline">
                {children}
              </a>
            );
          },
        }}
      >
        {processed || "*Nothing to preview yet.*"}
      </ReactMarkdown>
    </div>
  );
}

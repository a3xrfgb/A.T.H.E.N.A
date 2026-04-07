import * as Dialog from "@radix-ui/react-dialog";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "../../styles/hljs-chat-surface-dark.css";
import mermaid from "mermaid";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  Clock,
  Coins,
  Copy,
  Download,
  FileText,
  Gauge,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  RotateCcw,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import Papa from "papaparse";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getChatModelDisplayLabel } from "../../lib/chatModelPicker";
import { useTranslation } from "../../i18n/I18nContext";
import { parseAssistantMessageContent } from "../../lib/assistantMessage";
import {
  type ChatExportFormat,
  exportChatToFile,
} from "../../lib/chatExport";
import { parseUserMessageContent } from "../../lib/userMessageContent";
import {
  sidebarGlassMenuContent,
  sidebarGlassMenuItem,
} from "../../lib/sidebarGlassMenu";
import type { Message } from "../../types/chat";
import { useChatComposerStore } from "../../store/chatComposerStore";
import { useChatStore } from "../../store/chatStore";
import { useNotesStore } from "../../store/notesStore";
import { useModelStore } from "../../store/modelStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { AthenaLogo } from "../layout/AthenaLogo";
import { cn } from "../../lib/utils";

/** Three-dot SMIL pulse while the assistant token stream is active (matches user-provided animation). */
function StreamingDotsIndicator() {
  const id = useId().replace(/:/g, "_");
  const a = `${id}_spin`;
  const b = `${id}_spin2`;
  return (
    <span
      className="ml-1 inline-flex h-5 w-14 shrink-0 items-center align-middle text-[#3b82f6] dark:text-[#60a5fa]"
      aria-hidden
    >
      <svg className="h-5 w-14" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="12" r="3">
          <animate id={a} begin={`0;${b}.end-0.25s`} attributeName="r" dur="0.75s" values="3;.2;3" />
        </circle>
        <circle cx="12" cy="12" r="3">
          <animate begin={`${a}.end-0.6s`} attributeName="r" dur="0.75s" values="3;.2;3" />
        </circle>
        <circle cx="20" cy="12" r="3">
          <animate id={b} begin={`${a}.end-0.45s`} attributeName="r" dur="0.75s" values="3;.2;3" />
        </circle>
      </svg>
    </span>
  );
}

/** Copiable surfaces (fenced code, mermaid, CSV): light gray vs darker panel in dark mode */
const chatCopiableSurface =
  "rounded-xl border border-zinc-300/90 bg-[#ececec] shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)] dark:border-zinc-600/50 dark:bg-[#1a1a1f] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]";

/** Wide layout: click thumbnail to view full screen */
function UserAttachmentLightbox({ src }: { src: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="group/img mb-2 block max-w-full cursor-zoom-in rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]"
          title={t("chat.user.viewImage")}
        >
          <img
            src={src}
            alt=""
            className="max-h-[min(320px,70vh)] w-auto max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5 transition hover:opacity-95 dark:ring-white/10"
          />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[440] cursor-default bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[441] flex max-h-[95vh] w-[min(92vw,920px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-2xl focus:outline-none"
          onClick={() => setOpen(false)}
        >
          <Dialog.Title className="sr-only">{t("chat.user.imageLightboxTitle")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("chat.user.viewImage")}</Dialog.Description>
          <div
            className="relative flex max-h-[min(90vh,900px)] min-h-0 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={src} alt="" className="max-h-[min(90vh,900px)] w-full object-contain" />
            <Dialog.Close
              type="button"
              className="absolute right-2 top-2 z-10 rounded-full bg-[var(--app-bg)]/90 p-2 text-[var(--app-text)] shadow-md ring-1 ring-[var(--app-border)] transition hover:bg-[var(--app-surface)]"
              aria-label={t("topBar.close")}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Legacy “[Image]” rows — compact chip; tap opens explanation (no pixel data) */
function LegacyImagePlaceholder() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="mb-2 flex max-w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--app-border)] bg-black/[0.03] px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          title={t("chat.user.imageLegacyDetail")}
        >
          <ImageIcon className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
          <span className="font-medium text-[var(--app-text)]">{t("chat.user.imageLegacyShort")}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[440] cursor-default bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[441] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-base font-semibold text-[var(--app-text)]">
            {t("chat.user.imageLegacyShort")}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-[var(--app-muted)]">
            {t("chat.user.imageLegacyDetail")}
          </Dialog.Description>
          <Dialog.Close
            type="button"
            className="mt-5 w-full rounded-xl bg-[var(--app-bg)] py-2.5 text-sm font-medium text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[var(--chat-composer-toolbar-hover)]"
          >
            {t("topBar.close")}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "plaintext";

  if (lang === "mermaid") {
    return <MermaidBlock code={code} />;
  }
  if (lang === "csv" || lang === "tsv") {
    return <CsvTable code={code} />;
  }

  let highlighted = code;
  try {
    highlighted = hljs.highlight(code, { language: lang }).value;
  } catch {
    highlighted = hljs.highlightAuto(code).value;
  }
  const copy = () => navigator.clipboard.writeText(code);
  return (
    <div
      className={cn(
        "athena-chat-code-surface group relative my-3 min-w-0 max-w-full overflow-x-auto rounded-xl",
        chatCopiableSurface,
      )}
    >
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 rounded-md border border-zinc-400/40 bg-white/80 p-1.5 text-zinc-700 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100 dark:border-zinc-600/55 dark:bg-zinc-800/95 dark:text-zinc-200 dark:hover:bg-zinc-700/95"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <pre className="hljs m-0 max-w-full min-w-0 whitespace-pre-wrap break-words !bg-transparent p-4 pt-11 font-mono text-[13px] leading-relaxed text-[#24292e] dark:text-[#c9d1d9]">
        <code className="block min-w-0 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const isDark = useEffectiveDark();

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg: out }) => {
        if (!cancelled) {
          setSvg(out);
          setErr(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setErr(String(e));
          setSvg("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (err) {
    return (
      <pre className="my-3 max-w-full min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-amber-400/50 bg-amber-50 p-3 font-mono text-xs leading-relaxed text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
        {code}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div
        className={cn(
          "my-3 p-4 text-sm text-[var(--app-muted)]",
          chatCopiableSurface,
        )}
      >
        Rendering diagram…
      </div>
    );
  }
  return (
    <div
      className={cn(
        "my-4 max-w-full min-w-0 overflow-x-hidden p-4 [&_svg]:mx-auto [&_svg]:max-w-full [&_svg]:h-auto",
        chatCopiableSurface,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function CsvTable({ code }: { code: string }) {
  const { rows, header } = useMemo(() => {
    const parsed = Papa.parse<string[]>(code.trim(), { header: false, skipEmptyLines: true });
    const data = parsed.data.filter((row) => row.some((c) => String(c).trim()));
    if (data.length === 0) return { rows: [] as string[][], header: null as string[] | null };
    const [h, ...rest] = data;
    return { header: h, rows: rest };
  }, [code]);

  if (!header?.length) {
    return (
      <pre
        className={cn(
          "my-3 max-w-full min-w-0 overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-[var(--app-text)]",
          chatCopiableSurface,
        )}
      >
        {code}
      </pre>
    );
  }

  return (
    <div className={cn("my-4 max-w-full min-w-0 overflow-x-auto", chatCopiableSurface)}>
      <table className="w-full min-w-[240px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300/80 bg-zinc-200/80 dark:border-zinc-600/45 dark:bg-zinc-800/85">
            {header.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold text-[var(--app-text)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-300/60 last:border-0 dark:border-zinc-600/35">
              {header.map((_, ci) => (
                <td key={ci} className="px-3 py-1.5 text-[var(--app-text)]/90">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const msgActionBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-black/[0.06] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)] dark:hover:bg-white/[0.08]";

/** User bubble markdown — compact utility classes (typography plugin not required). */
const userMarkdownClass =
  "max-w-none text-[15px] leading-relaxed text-[var(--app-text)] [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_a]:text-[#2563eb] [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-[#7ab8ff]";

const statPill =
  "inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-[11px] text-[var(--app-muted)]";

export function ChatMessageBubble({
  message,
  streaming,
  streamingReasoningText,
}: {
  message: Message;
  streaming?: boolean;
  /** Live reasoning tokens while the assistant message is streaming */
  streamingReasoningText?: string;
}) {
  const { t } = useTranslation();
  const thinkingStyle = useSettingsStore((s) => s.settings.thinkingStyle);
  const isUser = message.role === "user";
  const chatStreaming = useChatStore((s) => s.isStreaming);
  const regenerateAssistantMessage = useChatStore((s) => s.regenerateAssistantMessage);
  const retryUserMessage = useChatStore((s) => s.retryUserMessage);
  const deleteAssistantMessage = useChatStore((s) => s.deleteAssistantMessage);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const messagesByThread = useChatStore((s) => s.messages);
  const threads = useChatStore((s) => s.threads);
  const activeModelId = useModelStore((s) => s.activeModelId);
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);
  const pushToast = useUiStore((s) => s.pushToast);
  const setEditFromMessageId = useChatComposerStore((s) => s.setEditFromMessageId);
  const openComposerWithText = useChatComposerStore((s) => s.openComposerWithText);

  const pickerModelId = activeModelId ?? defaultModel ?? null;
  /** Regenerate with the model that produced this reply when known (composer picker as fallback). */
  const regenerateModelId =
    !isUser && message.modelId?.trim() ? message.modelId : pickerModelId;
  const actionsDisabled = streaming || chatStreaming;
  const showActions =
    !actionsDisabled && message.id !== "streaming" && message.id !== "temp-user";

  const userParsed = useMemo(
    () => (isUser ? parseUserMessageContent(message.content) : null),
    [isUser, message.content],
  );

  const assistantParsed = useMemo(() => {
    if (isUser) return null;
    if (streaming) {
      return {
        displayFinal: message.content,
        thinking: (streamingReasoningText ?? "").trim(),
        genMs: undefined as number | undefined,
        tokensPerSec: undefined as number | undefined,
        completionTokens: undefined as number | undefined,
        promptTokens: undefined as number | undefined,
        finishReason: undefined as string | undefined,
      };
    }
    return parseAssistantMessageContent(message.content);
  }, [isUser, streaming, message.content, streamingReasoningText]);

  const assistantStyle =
    thinkingStyle === "wide"
      ? "mx-auto w-full max-w-full px-1 py-2 text-[var(--app-text)]"
      : thinkingStyle === "block"
        ? "mr-auto border-l-4 border-[#3b82f6] pl-4 pr-2 py-2 text-[var(--app-text)]"
        : thinkingStyle === "rotate"
          ? "chat-message-style-rotate mr-auto px-1 py-2 text-[var(--app-text)]"
          : "mr-auto px-1 py-2 text-[var(--app-text)]";

  /** Light gray bubble: width fits content (capped), not full row — parent uses items-end */
  const userStyle =
    thinkingStyle === "wide"
      ? "w-fit min-w-0 max-w-[min(100%,85%)] break-words rounded-2xl border border-[var(--app-border)] bg-[#ececec] px-3.5 py-2 text-[var(--app-text)] shadow-sm dark:border-white/[0.12] dark:bg-[#404040] dark:text-[#ececf1]"
      : "w-fit min-w-0 max-w-[min(100%,90%)] break-words rounded-2xl border border-[var(--app-border)] bg-[#ececec] px-3.5 py-2 text-[var(--app-text)] shadow-sm dark:border-white/[0.12] dark:bg-[#404040] dark:text-[#ececf1]";

  const modelLabelRaw = !isUser ? message.modelId ?? activeModelId ?? defaultModel : null;
  const modelLabel = modelLabelRaw ? getChatModelDisplayLabel(modelLabelRaw) : null;

  const copyAssistantText = () => {
    if (!assistantParsed) return;
    void navigator.clipboard.writeText(assistantParsed.displayFinal).then(() => {
      pushToast(t("chat.messageActions.copied"), "success");
    });
  };

  const saveAssistantToNote = () => {
    if (!assistantParsed) return;
    const body = assistantParsed.displayFinal.trim();
    if (!body) {
      pushToast(t("chat.messageActions.noteEmpty"), "info");
      return;
    }
    const id = useNotesStore.getState().createNoteFromAssistantResponse(body);
    useNotesStore.getState().setPendingSelectNoteId(id);
    useUiStore.getState().signalOpenNotes();
    pushToast(t("chat.messageActions.savedToNote"), "success");
  };

  const runChatExport = async (format: ChatExportFormat) => {
    if (!activeThreadId) {
      pushToast(t("chat.export.noThread"), "error");
      return;
    }
    const list = messagesByThread[activeThreadId] ?? [];
    const threadTitle = threads.find((x) => x.id === activeThreadId)?.title ?? "Chat";
    try {
      const saved = await exportChatToFile(format, threadTitle, activeThreadId, list);
      if (saved) pushToast(t("chat.export.success"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  return (
    <div
      className={cn(
        "fade-in flex min-w-0 w-full max-w-full",
        isUser ? "flex-col items-end gap-1.5" : cn("flex-row items-start gap-3", assistantStyle),
      )}
    >
      {isUser ? (
        <div className={cn(userMarkdownClass, userStyle)}>
          {userParsed?.imageDataUrl ? (
            <UserAttachmentLightbox src={userParsed.imageDataUrl} />
          ) : null}
          {userParsed?.legacyImageOnly ? <LegacyImagePlaceholder /> : null}
          {userParsed?.attachments && userParsed.attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap justify-end gap-1.5">
              {userParsed.attachments.map((a, i) => (
                <span
                  key={`${a.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--app-text)] dark:border-white/10 dark:bg-white/[0.06]"
                  title={a.name}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
                  <span className="max-w-[220px] truncate">{a.name}</span>
                </span>
              ))}
            </div>
          ) : null}
          {userParsed?.text ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? "");
                  const isBlock = match || String(children).includes("\n");
                  if (isBlock) {
                    return <CodeBlock className={className}>{children}</CodeBlock>;
                  }
                  return (
                    <code
                      className={cn(
                        "rounded-md px-1.5 py-0.5 font-mono text-[0.88em]",
                        "bg-zinc-200/90 text-[var(--app-text)] dark:bg-zinc-600/50 dark:text-[#ececf1]",
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {userParsed.text}
            </ReactMarkdown>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-0.5 shrink-0 select-none">
            <AthenaLogo className="h-7 w-7 object-contain" alt={t("sidebar.brand")} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {modelLabel ? (
              <p className="text-[11px] font-medium text-[var(--app-muted)]">{modelLabel}</p>
            ) : null}
            {assistantParsed && assistantParsed.thinking.length > 0 ? (
              <details className="group mb-2 w-full">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)] [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                  {t("chat.thinking.toggle")}
                </summary>
                <div className="mt-1.5 pl-5 text-sm leading-relaxed text-[var(--app-muted)] whitespace-pre-wrap">
                  {assistantParsed.thinking}
                </div>
              </details>
            ) : null}
            <div className="athena-assistant-markdown w-full min-w-0 max-w-[min(72ch,100%)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className ?? "");
                    const isBlock = match || String(children).includes("\n");
                    if (isBlock) {
                      return <CodeBlock className={className}>{children}</CodeBlock>;
                    }
                    return (
                      <code className="athena-assistant-inline-code" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {assistantParsed?.displayFinal ?? ""}
              </ReactMarkdown>
              {streaming ? <StreamingDotsIndicator /> : null}
            </div>
            {assistantParsed && !streaming ? (
              <div
                className={cn(
                  "mt-2 flex w-full flex-wrap items-center gap-2",
                  (() => {
                    const hasStats =
                      assistantParsed.tokensPerSec != null ||
                      assistantParsed.completionTokens != null ||
                      message.tokensUsed != null ||
                      assistantParsed.genMs != null ||
                      Boolean(assistantParsed.finishReason);
                    return !hasStats && showActions && "justify-end";
                  })(),
                )}
              >
                {assistantParsed.tokensPerSec != null ? (
                  <span className={statPill} title={t("chat.stats.tokPerSec")}>
                    <Gauge className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} />
                    {assistantParsed.tokensPerSec.toFixed(2)} {t("chat.stats.tokPerSecUnit")}
                  </span>
                ) : null}
                {assistantParsed.completionTokens != null ? (
                  <span className={statPill} title={t("chat.stats.totalTokens")}>
                    <Coins className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} />
                    {assistantParsed.completionTokens} {t("chat.stats.tokensUnit")}
                  </span>
                ) : message.tokensUsed != null ? (
                  <span className={statPill} title={t("chat.stats.totalTokens")}>
                    <Coins className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} />
                    {message.tokensUsed} {t("chat.stats.tokensUnit")}
                  </span>
                ) : null}
                {assistantParsed.genMs != null ? (
                  <span className={statPill} title={t("chat.stats.genTime")}>
                    <Clock className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} />
                    {(assistantParsed.genMs / 1000).toFixed(2)}s
                  </span>
                ) : null}
                {assistantParsed.finishReason ? (
                  <span className={cn(statPill, "max-w-[min(100%,280px)] truncate")}>
                    {t("chat.stats.stopReason")}: {assistantParsed.finishReason}
                  </span>
                ) : null}
                {showActions ? (
                  <button
                    type="button"
                    className={cn(
                      msgActionBtn,
                      (assistantParsed.tokensPerSec != null ||
                        assistantParsed.completionTokens != null ||
                        message.tokensUsed != null ||
                        assistantParsed.genMs != null ||
                        assistantParsed.finishReason) &&
                        "ml-auto",
                    )}
                    title={t("chat.messageActions.delete")}
                    aria-label={t("chat.messageActions.delete")}
                    onClick={() => void deleteAssistantMessage(message)}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {showActions ? (
              <div className="mt-2 flex w-full flex-wrap gap-0.5">
                <button
                  type="button"
                  className={msgActionBtn}
                  title={t("chat.messageActions.copy")}
                  aria-label={t("chat.messageActions.copy")}
                  onClick={copyAssistantText}
                >
                  <Copy className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={msgActionBtn}
                  title={t("chat.messageActions.saveToNote")}
                  aria-label={t("chat.messageActions.saveToNote")}
                  onClick={saveAssistantToNote}
                >
                  <StickyNote className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={msgActionBtn}
                  title={t("chat.messageActions.regenerate")}
                  aria-label={t("chat.messageActions.regenerate")}
                  onClick={() => {
                    if (!regenerateModelId) {
                      pushToast(t("chat.messageActions.needModel"), "info");
                      return;
                    }
                    void regenerateAssistantMessage(message, regenerateModelId);
                  }}
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className={msgActionBtn}
                      title={t("chat.export.menuTitle")}
                      aria-label={t("chat.export.menuTitle")}
                    >
                      <Download className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className={sidebarGlassMenuContent}
                      sideOffset={6}
                      align="end"
                    >
                      <DropdownMenu.Item
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void runChatExport("text");
                        }}
                      >
                        {t("chat.export.formatText")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void runChatExport("markdown");
                        }}
                      >
                        {t("chat.export.formatMarkdown")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void runChatExport("pdf");
                        }}
                      >
                        {t("chat.export.formatPdf")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={sidebarGlassMenuItem}
                        onSelect={(e) => {
                          e.preventDefault();
                          void runChatExport("json");
                        }}
                      >
                        {t("chat.export.formatJson")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            ) : null}
          </div>
        </>
      )}

      {showActions && isUser ? (
        <div className="mt-1 flex w-fit max-w-[min(100%,85%)] flex-wrap justify-end gap-0.5">
          <button
            type="button"
            className={msgActionBtn}
            title={t("chat.messageActions.retry")}
            aria-label={t("chat.messageActions.retry")}
            onClick={() => {
              if (!pickerModelId) {
                pushToast(t("chat.messageActions.needModel"), "info");
                return;
              }
              void retryUserMessage(message, pickerModelId);
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={msgActionBtn}
            title={t("chat.messageActions.edit")}
            aria-label={t("chat.messageActions.edit")}
            onClick={() => {
              setEditFromMessageId(message.id);
              openComposerWithText(parseUserMessageContent(message.content).text);
            }}
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={msgActionBtn}
            title={t("chat.messageActions.copy")}
            aria-label={t("chat.messageActions.copy")}
            onClick={() => {
              const p = parseUserMessageContent(message.content);
              const names = (p.attachments ?? []).map((a) => a.name).filter(Boolean);
              const filesLine =
                names.length > 0 ? `\n[Files: ${names.join(", ")}]` : "";
              const copyText =
                p.imageDataUrl && p.text.trim()
                  ? `${p.text}\n[Image attached]${filesLine}`
                  : p.imageDataUrl
                    ? `[Image attached]${filesLine}`
                    : names.length > 0 && !p.text.trim()
                      ? `[Files: ${names.join(", ")}]`
                      : p.text
                        ? `${p.text}${filesLine}`
                        : p.text || message.content;
              void navigator.clipboard.writeText(copyText).then(() => {
                pushToast(t("chat.messageActions.copied"), "success");
              });
            }}
          >
            <Copy className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

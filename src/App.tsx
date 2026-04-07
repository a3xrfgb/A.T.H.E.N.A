import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "./components/chat/ChatInput";
import { EmptyChatHero } from "./components/chat/EmptyChatHero";
import { EmptyChatStarfield } from "./components/chat/EmptyChatStarfield";
import { ChatThread } from "./components/chat/ChatThread";
import { InspirationPanel } from "./components/inspiration/InspirationPanel";
import { NotesPanel } from "./components/notes/NotesPanel";
import { MainPanel } from "./components/layout/MainPanel";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { WindowResizeHandles } from "./components/layout/WindowResizeHandles";
import { ModelLibrary } from "./components/models/ModelLibrary";
import { HomeDashboard } from "./components/home/HomeDashboard";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { RuntimeUpdateBanner } from "./components/system/RuntimeUpdateBanner";
import { LockOverlay } from "./components/security/LockOverlay";
import { SettingsModal } from "./components/settings/SettingsModal";
import { FirstLaunchModal } from "./components/onboarding/FirstLaunchModal";
import { BrowserPanel } from "./components/browser/BrowserPanel";
import { CanvasWorkspace } from "./components/canvas/CanvasWorkspace";
import { useChatEvents } from "./hooks/useChat";
import { useDownloadProgress } from "./hooks/useModels";
import { useRuntimeUpdateCheck } from "./hooks/useRuntimeUpdateCheck";
import { useWindowMaximized } from "./hooks/useWindowMaximized";
import { api } from "./lib/tauri";
import { ImagesPanel } from "./components/images/ImagesPanel";
import { StudyPanel } from "./components/study/StudyPanel";
import type { AppView } from "./types/appView";
import { useChatComposerStore } from "./store/chatComposerStore";
import { useChatStore } from "./store/chatStore";
import { useLockStore } from "./store/lockStore";
import { useModelStore } from "./store/modelStore";
import { useSettingsStore } from "./store/settingsStore";
import { useUiStore } from "./store/uiStore";
import {
  buildChatPickerModels,
  getChatModelDisplayLabel,
  getPreferredDefaultChatModelId,
  resolveToInstalledMainModelId,
} from "./lib/chatModelPicker";
import { filterMainChatModels } from "./lib/modelDisk";
import { cn } from "./lib/utils";
import { useTranslation } from "./i18n/I18nContext";
import type { UserAttachment } from "./lib/userMessageContent";

export default function App() {
  const { t } = useTranslation();
  const emptyChatBackdropRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AppView>("chat");
  /** Keep browser DOM + iframe alive after first open so returning from other views preserves the session. */
  const [browserKeepAlive, setBrowserKeepAlive] = useState(false);
  /** Keep canvas mounted after first visit so video/audio keep playing when switching sections (not display:none). */
  const [canvasKeepAlive, setCanvasKeepAlive] = useState(false);
  useChatEvents();
  useDownloadProgress();
  useRuntimeUpdateCheck();

  const threads = useChatStore((s) => s.threads);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingText = useChatStore((s) => s.streamingText);
  const loadThreads = useChatStore((s) => s.loadThreads);
  const loadProjects = useChatStore((s) => s.loadProjects);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const startEmptyChat = useChatStore((s) => s.startEmptyChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  const localModels = useModelStore((s) => s.localModels);
  const activeModelId = useModelStore((s) => s.activeModelId);
  const loadLocalModels = useModelStore((s) => s.loadLocalModels);
  const selectChatModel = useModelStore((s) => s.selectChatModel);

  const loadSettings = useSettingsStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);

  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const openNotesSignal = useUiStore((s) => s.openNotesSignal);

  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  const hasPin = Boolean(settings.securityPinHash?.length);

  useEffect(() => {
    const touch = () => {
      if (!useLockStore.getState().locked) useLockStore.getState().touchActivity();
    };
    window.addEventListener("pointerdown", touch, true);
    window.addEventListener("keydown", touch, true);
    return () => {
      window.removeEventListener("pointerdown", touch, true);
      window.removeEventListener("keydown", touch, true);
    };
  }, []);

  useEffect(() => {
    const mins = settings.securityAutoLockMinutes;
    if (!mins || !hasPin) return;
    const id = window.setInterval(() => {
      if (useLockStore.getState().locked) return;
      const idle = Date.now() - useLockStore.getState().lastActivity;
      if (idle >= mins * 60_000) useLockStore.getState().setLocked(true);
    }, 10_000);
    return () => clearInterval(id);
  }, [settings.securityAutoLockMinutes, hasPin]);

  useEffect(() => {
    void (async () => {
      await loadThreads();
      await loadProjects();
      await loadLocalModels();
      await loadSettings();
      const s = await api.getSettings();
      if (s.serverEnabled) {
        await api.startServer(
          s.serverPort,
          s.apiKey?.trim() ? s.apiKey : null,
        );
      }
    })();
  }, [loadThreads, loadProjects, loadLocalModels, loadSettings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void startEmptyChat();
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startEmptyChat, setSettingsOpen]);

  const threadTitle = useMemo(() => {
    const t = threads.find((x) => x.id === activeThreadId);
    return t?.title ?? "Athena";
  }, [threads, activeThreadId]);

  const title = useMemo(() => {
    if (settingsOpen) return t("settings.title");
    switch (view) {
      case "home":
        return t("app.titleHome");
      case "canvas":
        return t("app.titleCanvas");
      case "browser":
        return t("app.titleBrowser");
      case "models":
        return t("app.titleModels");
      case "inspiration":
        return t("app.titleInspiration");
      case "images":
        return t("app.titleGallery");
      case "study":
        return t("app.titleStudy");
      case "notes":
        return t("app.titleNotes");
      default:
        return threadTitle;
    }
  }, [view, threadTitle, settingsOpen, t]);

  useEffect(() => {
    void getCurrentWindow().setTitle(title);
  }, [title]);

  useEffect(() => {
    if (openNotesSignal === 0) return;
    setView("notes");
  }, [openNotesSignal]);

  useEffect(() => {
    if (!activeThreadId) return;
    void loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  const mainChatModels = useMemo(
    () => filterMainChatModels(localModels).map((m) => ({ id: m.id, name: m.name })),
    [localModels],
  );

  const chatPickerModels = useMemo(
    () => buildChatPickerModels(mainChatModels),
    [mainChatModels],
  );

  /** Exact disk stem from `list_local_models` — required for preload + stream_chat. */
  const effectiveChatModelId = useMemo(() => {
    const mains = mainChatModels;
    const fromActive = resolveToInstalledMainModelId(mains, activeModelId);
    if (fromActive) return fromActive;
    const fromSettings = resolveToInstalledMainModelId(mains, settings.defaultModel);
    if (fromSettings) return fromSettings;
    return getPreferredDefaultChatModelId(mains) ?? mains[0]?.id ?? null;
  }, [activeModelId, settings.defaultModel, mainChatModels]);

  const onSend = useCallback(
    (
      text: string,
      imageDataUrl?: string | null,
      attachments?: UserAttachment[] | null,
    ) => {
      const mid = effectiveChatModelId;
      if (!mid) {
        useUiStore.getState().pushToast(t("app.selectModelFirst"), "error");
        return;
      }
      void sendMessage(text, mid, imageDataUrl ?? null, {
        attachments: attachments?.length ? attachments : undefined,
      });
    },
    [effectiveChatModelId, sendMessage, t],
  );

  const activeMessages = activeThreadId ? messages[activeThreadId] ?? [] : [];
  const streamSlice =
    activeThreadId && streamingText[activeThreadId] !== undefined
      ? streamingText[activeThreadId]
      : undefined;

  const showWelcome = view === "chat" && localModels.length === 0;
  /** New chat with no messages yet — centered hero + composer. */
  const isEmptyChatSession =
    view === "chat" &&
    !showWelcome &&
    activeMessages.length === 0 &&
    !isStreaming;

  const maximized = useWindowMaximized();

  useEffect(() => {
    if (view === "browser") setBrowserKeepAlive(true);
  }, [view]);

  useEffect(() => {
    if (view === "canvas") setCanvasKeepAlive(true);
  }, [view]);

  return (
    <div className="relative box-border flex h-screen min-h-0 w-screen flex-col bg-transparent p-2 text-[var(--app-text)]">
      <WindowResizeHandles disabled={maximized} />
      <div
        className={cn(
          "flex min-h-0 flex-1 gap-2 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-2 shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)]",
          maximized && "rounded-none border-transparent p-0 shadow-none",
        )}
      >
      <Sidebar
        threads={threads}
        activeId={activeThreadId}
        onSelect={(id) => {
          setActiveThread(id);
          void loadMessages(id);
          setView("chat");
        }}
        onNew={() => void startEmptyChat()}
        view={view}
        onView={setView}
        hasPin={hasPin}
      />
      <MainPanel
        className="min-w-0 flex-1 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]"
        right={
          view === "images" || view === "home" || view === "canvas" || view === "browser"
            ? undefined
            : (
            <div className="text-xs text-[var(--app-muted)]">
              <p className="font-semibold text-[var(--app-text)]">{t("app.thread")}</p>
              <p className="mt-1 break-all">{activeThreadId ?? "—"}</p>
              <p className="mt-3 font-semibold text-[var(--app-text)]">
                {t("app.model")}
              </p>
              <p className="mt-1 break-all">
                {getChatModelDisplayLabel(effectiveChatModelId) || "—"}
              </p>
            </div>
          )
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <TopBar title={title} hasPin={hasPin} maximized={maximized} />
          <div className="flex min-h-0 flex-1 flex-col">
            {view === "home" && (
              <HomeDashboard
                messages={messages}
                onSelectThread={(id) => {
                  setActiveThread(id);
                  void loadMessages(id);
                  setView("chat");
                }}
                onNewChat={() => {
                  void startEmptyChat();
                  setView("chat");
                }}
                onNavigate={setView}
                onStartChatWithPrompt={(text) => {
                  useChatComposerStore.getState().openComposerWithText(text);
                  void startEmptyChat();
                  setView("chat");
                }}
              />
            )}
            {view === "chat" && (
              <div className="relative flex min-h-0 flex-1 flex-col">
                {showWelcome && <WelcomeScreen />}
                {!showWelcome && isEmptyChatSession && (
                  <div
                    ref={emptyChatBackdropRef}
                    className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <EmptyChatStarfield panelRef={emptyChatBackdropRef} />
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
                      <EmptyChatHero />
                      <div className="mt-10 w-full max-w-3xl shrink-0">
                        <ChatInput
                          models={chatPickerModels}
                          modelId={effectiveChatModelId}
                          onModelChange={(id) => void selectChatModel(id)}
                          onSend={onSend}
                          onStop={() => void stopStreaming()}
                          streaming={isStreaming}
                          layout="centered"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {!showWelcome && !isEmptyChatSession && (
                  <>
                    <div className="min-h-0 flex-1">
                      <ChatThread
                        messages={activeMessages}
                        streamingText={streamSlice}
                        isStreaming={isStreaming}
                        threadId={activeThreadId}
                      />
                    </div>
                    <ChatInput
                      models={chatPickerModels}
                      modelId={effectiveChatModelId}
                      onModelChange={(id) => void selectChatModel(id)}
                      onSend={onSend}
                      onStop={() => void stopStreaming()}
                      streaming={isStreaming}
                    />
                  </>
                )}
              </div>
            )}
            {view === "models" && <ModelLibrary />}
            {canvasKeepAlive && (
              <div
                className={cn(
                  "relative min-h-0 flex-col overflow-hidden",
                  view === "canvas"
                    ? "flex flex-1"
                    : "pointer-events-none fixed left-[-10000px] top-0 z-0 h-[min(90vh,720px)] w-[min(90vw,960px)]",
                )}
                aria-hidden={view !== "canvas"}
              >
                <CanvasWorkspace />
              </div>
            )}
            {browserKeepAlive && (
              <div
                className={cn(
                  "min-h-0 flex-col overflow-hidden",
                  view === "browser" ? "flex flex-1" : "hidden",
                )}
                aria-hidden={view !== "browser"}
              >
                <BrowserPanel shortcutsEnabled={view === "browser"} />
              </div>
            )}
            {view === "inspiration" && (
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <InspirationPanel />
              </div>
            )}
            {view === "images" && <ImagesPanel />}
            {view === "study" && <StudyPanel />}
            {view === "notes" && <NotesPanel />}
          </div>
        </div>
      </MainPanel>
      <RuntimeUpdateBanner />
      <div className="pointer-events-none fixed bottom-4 right-4 z-[470] flex flex-col gap-2">
        {toasts.map((t) => (
          <button
            type="button"
            key={t.id}
            className="pointer-events-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-left text-sm text-[var(--app-text)] shadow-lg"
            onClick={() => dismissToast(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
      <SettingsModal />
      <LockOverlay />
      <FirstLaunchModal onFlowComplete={() => setView("home")} />
      </div>
    </div>
  );
}

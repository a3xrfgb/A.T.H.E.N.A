import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Globe,
  Home,
  Lock,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  getBrowserDefaultHome,
  getBrowserHomeByRotation,
  resolveBrowserInput,
  tabLabelFromUrl,
} from "../../lib/browserUrl";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";

type Hist = { urls: string[]; i: number };

type BrowserTab = {
  id: string;
  committedUrl: string;
  addressBar: string;
  hist: Hist;
  frameNonce: number;
  loading: boolean;
};

function newTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTab(partial?: Partial<Pick<BrowserTab, "committedUrl" | "addressBar">>): BrowserTab {
  const home = partial?.committedUrl ?? getBrowserDefaultHome();
  const bar = partial?.addressBar ?? home;
  return {
    id: newTabId(),
    committedUrl: home,
    addressBar: bar,
    hist: { urls: [home], i: 0 },
    frameNonce: 0,
    loading: true,
  };
}

export function BrowserPanel({ shortcutsEnabled = true }: { shortcutsEnabled?: boolean }) {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const addressRef = useRef<HTMLInputElement>(null);
  const newTabRotationRef = useRef(0);

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]!.id);

  const activeTab = useMemo(
    () => tabs.find((x) => x.id === activeTabId) ?? tabs[0]!,
    [tabs, activeTabId],
  );

  const updateTab = useCallback((id: string, patch: Partial<BrowserTab> | ((t: BrowserTab) => BrowserTab)) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== id) return tab;
        return typeof patch === "function" ? patch(tab) : { ...tab, ...patch };
      }),
    );
  }, []);

  const applyNavigate = useCallback(
    (tabId: string, canonical: string, replace = false) => {
      updateTab(tabId, (tab) => {
        let hist = tab.hist;
        if (replace) {
          const urls = [...tab.hist.urls];
          urls[tab.hist.i] = canonical;
          hist = { urls, i: tab.hist.i };
        } else {
          const next = tab.hist.urls.slice(0, tab.hist.i + 1);
          next.push(canonical);
          hist = { urls: next, i: next.length - 1 };
        }
        return {
          ...tab,
          committedUrl: canonical,
          addressBar: canonical,
          hist,
          loading: true,
        };
      });
    },
    [updateTab],
  );

  const go = useCallback(() => {
    const next = resolveBrowserInput(activeTab.addressBar);
    if (next == null) {
      pushToast(t("browser.invalidUrl"), "error");
      return;
    }
    applyNavigate(activeTab.id, next);
  }, [activeTab.addressBar, activeTab.id, applyNavigate, pushToast, t]);

  const goHome = useCallback(() => {
    applyNavigate(activeTab.id, getBrowserDefaultHome());
  }, [activeTab.id, applyNavigate]);

  const reload = useCallback(() => {
    updateTab(activeTab.id, (tab) => ({
      ...tab,
      loading: true,
      frameNonce: tab.frameNonce + 1,
    }));
  }, [activeTab.id, updateTab]);

  const back = useCallback(() => {
    updateTab(activeTab.id, (t) => {
      if (t.hist.i <= 0) return t;
      const ni = t.hist.i - 1;
      const url = t.hist.urls[ni];
      if (!url) return t;
      return {
        ...t,
        committedUrl: url,
        addressBar: url,
        hist: { ...t.hist, i: ni },
        loading: true,
        frameNonce: t.frameNonce + 1,
      };
    });
  }, [activeTab.id, updateTab]);

  const forward = useCallback(() => {
    updateTab(activeTab.id, (t) => {
      if (t.hist.i >= t.hist.urls.length - 1) return t;
      const ni = t.hist.i + 1;
      const url = t.hist.urls[ni];
      if (!url) return t;
      return {
        ...t,
        committedUrl: url,
        addressBar: url,
        hist: { ...t.hist, i: ni },
        loading: true,
        frameNonce: t.frameNonce + 1,
      };
    });
  }, [activeTab.id, updateTab]);

  const canBack = activeTab.hist.i > 0;
  const canForward = activeTab.hist.i < activeTab.hist.urls.length - 1;

  const openNewTab = useCallback(() => {
    const step = newTabRotationRef.current;
    newTabRotationRef.current += 1;
    const url = getBrowserHomeByRotation(step);
    const nt = createTab({ committedUrl: url, addressBar: url });
    setTabs((prev) => [...prev, nt]);
    setActiveTabId(nt.id);
  }, []);

  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      if (prev.length === 1) {
        const fresh = createTab();
        setActiveTabId(fresh.id);
        return [fresh];
      }
      const idx = prev.findIndex((x) => x.id === id);
      const next = prev.filter((x) => x.id !== id);
      if (activeTabId === id) {
        const nextId = idx > 0 ? prev[idx - 1]!.id : next[0]!.id;
        setActiveTabId(nextId);
      }
      return next;
    });
  }, [activeTabId]);

  const copyUrl = useCallback(async () => {
    const url = activeTab.committedUrl;
    try {
      await navigator.clipboard.writeText(url);
      pushToast(t("browser.urlCopied"), "success");
    } catch {
      pushToast(t("browser.copyFailed"), "error");
    }
  }, [activeTab.committedUrl, pushToast, t]);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "t") {
        e.preventDefault();
        openNewTab();
      } else if (key === "w") {
        e.preventDefault();
        closeTab(activeTabId);
      } else if (key === "l") {
        e.preventDefault();
        addressRef.current?.focus();
        addressRef.current?.select();
      } else if (key === "r") {
        e.preventDefault();
        reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled, openNewTab, closeTab, activeTabId, reload]);

  const modHint = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+";
    return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform || "")
      ? "⌘"
      : "Ctrl+";
  }, []);

  const isHttps = activeTab.committedUrl.startsWith("https:");

  const iconBtn =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-muted)] transition hover:bg-black/[0.04] hover:text-[var(--app-text)] disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-white/[0.06]";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-surface)]">
      {/* Tabs */}
      <div className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-bg)]/50 px-1 pt-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const label = tabLabelFromUrl(tab.committedUrl);
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveTabId(tab.id);
                }
              }}
              className={cn(
                "group flex max-w-[10rem] min-w-[6rem] shrink-0 cursor-pointer items-center gap-1 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-left text-[12px] transition outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]"
                  : "border-transparent bg-transparent text-[var(--app-muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
              )}
            >
              <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <button
                type="button"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition hover:bg-black/10 group-hover:opacity-100 dark:hover:bg-white/10",
                  active && "opacity-70 group-hover:opacity-100",
                )}
                title={t("browser.closeTab")}
                onClick={(e) => closeTab(tab.id, e)}
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={cn(iconBtn, "mb-0.5 h-8 w-8 shrink-0 rounded-lg")}
          title={t("browser.newTab")}
          onClick={openNewTab}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--app-border)] px-3 py-2 sm:flex-row sm:items-center sm:gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={iconBtn}
            title={t("browser.back")}
            disabled={!canBack}
            onClick={back}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className={iconBtn}
            title={t("browser.forward")}
            disabled={!canForward}
            onClick={forward}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            className={iconBtn}
            title={t("browser.reload")}
            onClick={reload}
          >
            <RefreshCw
              className={cn("h-4 w-4", activeTab.loading && "animate-spin")}
              strokeWidth={2}
            />
          </button>
          <button type="button" className={iconBtn} title={t("browser.home")} onClick={goHome}>
            <Home className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className={iconBtn} title={t("browser.copyUrl")} onClick={() => void copyUrl()}>
            <Copy className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isHttps ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden />
          ) : (
            <Globe className="h-4 w-4 shrink-0 text-[var(--app-muted)]" strokeWidth={2} aria-hidden />
          )}
          <input
            ref={addressRef}
            type="text"
            className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:border-accent"
            placeholder={t("browser.urlPlaceholder")}
            value={activeTab.addressBar}
            onChange={(e) => updateTab(activeTab.id, { addressBar: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") go();
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button
            type="button"
            className="shrink-0 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-900 dark:bg-white dark:text-black dark:hover:bg-neutral-200 sm:px-4"
            onClick={go}
          >
            {t("browser.go")}
          </button>
        </div>
      </div>

      <p className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-bg)]/40 px-3 py-1 text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
        {t("browser.chromeHint", { mod: modHint })}
      </p>

      <div className="relative min-h-0 flex-1 bg-[var(--app-bg)]">
        {tabs.map((tab) => {
          const src = tab.committedUrl;
          const show = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0",
                !show && "invisible z-0 pointer-events-none",
                show && "z-10",
              )}
              aria-hidden={!show}
            >
              <iframe
                key={`${src}#${tab.frameNonce}`}
                title={t("browser.frameTitle")}
                src={src}
                className="h-full w-full border-0 bg-white dark:bg-[#0c0c0e]"
                referrerPolicy="no-referrer-when-downgrade"
                allow="clipboard-read; clipboard-write; fullscreen; geolocation; microphone; camera"
                onLoad={() => {
                  updateTab(tab.id, { loading: false });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

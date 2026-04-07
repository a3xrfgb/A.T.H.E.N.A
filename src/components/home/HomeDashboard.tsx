import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ImageIcon,
  MessageSquare,
  Pin,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  inspirationForSession,
  workSuggestionForToday,
} from "../../constants/homeContent";
import { aggregateHomeWeekStats } from "../../lib/homeStats";
import { AthenaLogo } from "../layout/AthenaLogo";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { cn } from "../../lib/utils";
import { HomeFlipClock } from "./HomeFlipClock";
import type { AppView } from "../../types/appView";
import type { Message } from "../../types/chat";
import { useChatStore } from "../../store/chatStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTranslation } from "../../i18n/I18nContext";
import { useUiStore } from "../../store/uiStore";

const PROMPT_CHIP_IDS = ["plan", "refactor", "brainstorm"] as const;

function homeGreetingPeriod(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function formatRelativePast(ts: number, locale: string): string {
  const diffMs = Date.now() - ts;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diffMs < 0) return rtf.format(0, "second");
  const diffMin = diffMs / 60_000;
  if (diffMin < 1) return rtf.format(-Math.max(1, Math.round(diffMs / 1000)), "second");
  if (diffMin < 60) return rtf.format(-Math.round(diffMin), "minute");
  const diffH = diffMin / 60;
  if (diffH < 24) return rtf.format(-Math.round(diffH), "hour");
  const diffD = diffH / 24;
  if (diffD < 30) return rtf.format(-Math.round(diffD), "day");
  return rtf.format(-Math.round(diffD / 30), "month");
}

export function HomeDashboard({
  messages,
  onSelectThread,
  onNewChat,
  onNavigate,
  onStartChatWithPrompt,
}: {
  messages: Record<string, Message[]>;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onNavigate: (view: AppView) => void;
  onStartChatWithPrompt: (text: string) => void;
}) {
  const { t, locale } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const requestSidebarProjectFilter = useUiStore((s) => s.requestSidebarProjectFilter);
  const threads = useChatStore((s) => s.threads);
  const projects = useChatStore((s) => s.projects);

  const compact = settings.homeCompactLayout;
  const showClock = settings.homeShowFlipClock;
  const showInspiration = settings.homeShowInspiration;
  const showStats = settings.homeShowStats;

  const displayName = settings.profileFullName.trim() || settings.profileNickname.trim();
  const hasProfilePhoto = Boolean(settings.profilePicturePath?.trim());
  const showHomeProfile = hasProfilePhoto || displayName !== "";
  const hour = new Date().getHours();
  const greetingLine =
    displayName !== ""
      ? t(`home.greeting.${homeGreetingPeriod(hour)}Name`, { name: displayName })
      : null;

  const chatsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return threads.filter((x) => x.updatedAt >= weekAgo).length;
  }, [threads]);

  const dayOfYear = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  }, []);

  const weekStats = useMemo(
    () => aggregateHomeWeekStats(threads, messages),
    [threads, messages],
  );

  const imagesIllustrative = Math.min(
    14,
    Math.max(3, 5 + (dayOfYear % 6) + (chatsThisWeek % 3)),
  );
  const hoursIllustrative = Math.min(
    20,
    Math.max(2, Math.round(chatsThisWeek * 0.65 + projects.length * 0.8 + 1)),
  );

  const imagesCount = weekStats.hasLoadedWeekData ? weekStats.imageSends : imagesIllustrative;
  const hoursVal = weekStats.hasLoadedWeekData ? weekStats.focusHours : hoursIllustrative;
  const statsAreMeasured = weekStats.hasLoadedWeekData;

  const inspiration = useMemo(() => inspirationForSession(), []);
  const suggestion = useMemo(() => workSuggestionForToday(), []);

  const recentThreads = useMemo(() => {
    return [...threads].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  }, [threads]);

  const recentProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  }, [projects]);

  const pinnedThreads = useMemo(
    () =>
      [...threads]
        .filter((x) => x.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6),
    [threads],
  );

  const pinnedProjects = useMemo(
    () =>
      [...projects]
        .filter((p) => p.pinned)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6),
    [projects],
  );

  const [inspirationOpen, setInspirationOpen] = useState(true);
  useEffect(() => {
    if (compact) setInspirationOpen(false);
  }, [compact]);

  return (
    <div className="home-dashboard relative min-h-0 flex-1 overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.35]"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 10% -10%, rgba(124, 106, 247, 0.2), transparent 50%),
            radial-gradient(ellipse 60% 40% at 90% 20%, rgba(34, 197, 94, 0.12), transparent 45%),
            radial-gradient(ellipse 50% 30% at 50% 100%, rgba(234, 179, 8, 0.08), transparent 50%)
          `,
        }}
        aria-hidden
      />
      {/* Soft drift — subtle motion on the hero band */}
      <div
        className="home-dashboard-ambient pointer-events-none absolute inset-x-0 top-0 h-48 opacity-30 dark:opacity-25"
        style={{
          background:
            "linear-gradient(110deg, rgba(124,106,247,0.15), rgba(34,197,94,0.08), rgba(234,179,8,0.06))",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-5 py-8 pb-12">
        <header className="mb-6 flex w-full flex-col items-center text-center">
          {showHomeProfile ? (
            <div className="flex w-full max-w-2xl flex-col items-center gap-4">
              <ProfileAvatar
                containerClassName="h-[15.75rem] w-[15.75rem] sm:h-[18rem] sm:w-[18rem]"
                iconClassName="h-[7.875rem] w-[7.875rem] sm:h-[9rem] sm:w-[9rem]"
              />
              <div className="min-w-0 w-full px-1">
                {greetingLine ? (
                  <>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                      {greetingLine}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">{t("home.subtitle")}</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                      {t("home.title")}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">{t("home.subtitle")}</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-2xl flex-col items-center gap-5 px-1">
              <div
                className={cn(
                  "relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface)]",
                  "shadow-[0_24px_60px_-20px_rgba(124,106,247,0.35)]",
                )}
                aria-hidden
              >
                <AthenaLogo className="h-16 w-16 object-contain opacity-95" />
              </div>
              <div className="min-w-0 w-full">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                  {t("home.title")}
                </h1>
                <p className="mt-1 text-sm text-[var(--app-muted)]">{t("home.subtitle")}</p>
              </div>
            </div>
          )}
        </header>

        {(pinnedThreads.length > 0 || pinnedProjects.length > 0) && (
          <section className="mb-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/90 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-amber-500" strokeWidth={2} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                {t("home.pinned.title")}
              </h2>
            </div>
            {pinnedProjects.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
                  {t("home.pinned.projects")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {pinnedProjects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          requestSidebarProjectFilter(p.id);
                          onNavigate("chat");
                        }}
                        className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/80 px-2.5 py-1.5 text-left text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="min-w-0 truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pinnedThreads.length > 0 && (
              <div className={cn("mt-3", pinnedProjects.length === 0 && "mt-0")}>
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
                  {t("home.pinned.chats")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {pinnedThreads.map((th) => (
                    <li key={th.id}>
                      <button
                        type="button"
                        onClick={() => onSelectThread(th.id)}
                        className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/80 px-2.5 py-1.5 text-left text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--app-muted)]" />
                        <span className="min-w-0 truncate">{th.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {pinnedThreads.length === 0 && pinnedProjects.length === 0 && threads.length + projects.length > 0 && (
          <p className="mb-5 text-center text-xs text-[var(--app-muted)]">{t("home.pinned.empty")}</p>
        )}

        <div className={cn("space-y-5", compact && "space-y-4")}>
          {showClock && (
            <div className="flex justify-center">
              <HomeFlipClock compact={compact} />
            </div>
          )}

          {showInspiration && (
            <section
              className={cn(
                "overflow-hidden rounded-2xl border border-[var(--app-border)]",
                "bg-[var(--app-surface)]/90 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.2)] backdrop-blur-sm",
                "dark:shadow-[0_16px_48px_-20px_rgba(0,0,0,0.55)]",
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)]/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                  {t("home.inspiration.label")}
                </p>
                <button
                  type="button"
                  onClick={() => setInspirationOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
                  aria-expanded={inspirationOpen}
                >
                  {inspirationOpen ? (
                    <>
                      {t("home.inspiration.collapse")}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      {t("home.inspiration.expand")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
              {inspirationOpen ? (
                <div className="flex items-start gap-4 p-6">
                  <div
                    className={cn(
                      "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-bg)]",
                      "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35),0_8px_24px_-8px_rgba(0,0,0,0.2)]",
                    )}
                    aria-hidden
                  >
                    <AthenaLogo className="h-9 w-9 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <blockquote className="font-serif text-xl leading-snug text-[var(--app-text)] md:text-2xl">
                      “{inspiration.quote}”
                    </blockquote>
                    <footer className="mt-3 text-sm text-[var(--app-muted)]">
                      — {inspiration.author}
                    </footer>
                    <button
                      type="button"
                      onClick={() => onNavigate("inspiration")}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--app-text)] underline-offset-4 hover:underline"
                    >
                      {t("home.inspiration.cta")}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          )}

          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
              {t("home.promptChips.title")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROMPT_CHIP_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    onStartChatWithPrompt(t(`home.promptChip.${id}.full`))
                  }
                  className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text)] transition hover:border-violet-400/50 hover:bg-[var(--app-bg)]"
                >
                  {t(`home.promptChip.${id}.label`)}
                </button>
              ))}
            </div>
          </section>

          {showStats && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                  {t("home.stats.title")}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    statsAreMeasured
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-800 dark:text-amber-400",
                  )}
                >
                  {statsAreMeasured ? t("home.stats.badge.measured") : t("home.stats.badge.estimate")}
                </span>
              </div>
              {!statsAreMeasured && (
                <p className="text-[11px] text-[var(--app-muted)]">{t("home.stats.loadedMoreHint")}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/80 p-4 backdrop-blur-sm">
                  <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
                    <ImageIcon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {statsAreMeasured
                        ? t("home.stats.images.measured", { count: imagesCount })
                        : t("home.stats.images.estimate", { count: imagesCount })}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                      {statsAreMeasured
                        ? t("home.stats.imagesHint.measured")
                        : t("home.stats.imagesHint.estimate")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/80 p-4 backdrop-blur-sm">
                  <div className="rounded-lg bg-amber-500/15 p-2 text-amber-700 dark:text-amber-400">
                    <Timer className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {statsAreMeasured
                        ? t("home.stats.hours.measured", { hours: hoursVal })
                        : t("home.stats.hours.estimate", { hours: hoursVal })}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                      {statsAreMeasured
                        ? t("home.stats.hoursHint.measured")
                        : t("home.stats.hoursHint.estimate")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-bg)]/80 p-4 backdrop-blur-sm">
                  <div className="rounded-lg bg-violet-500/15 p-2 text-violet-600 dark:text-violet-400">
                    <MessageSquare className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      {t("home.stats.chatsWeek", { count: chatsThisWeek })}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--app-muted)]">{t("home.stats.chatsHint")}</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--app-text)]">{t("home.recent.title")}</h2>
              <button
                type="button"
                onClick={onNewChat}
                className="shrink-0 rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
              >
                {t("home.recent.newChat")}
              </button>
            </div>

            {recentProjects.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
                  {t("home.recent.projects")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {recentProjects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          requestSidebarProjectFilter(p.id);
                          onNavigate("chat");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--app-text)] transition hover:bg-[var(--app-bg)]/80"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <FolderKanban className="h-4 w-4 shrink-0 opacity-60" />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={cn("mt-4", recentProjects.length === 0 && "mt-0")}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
                {t("home.recent.chats")}
              </p>
              {recentThreads.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--app-muted)]">{t("home.recent.empty")}</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--app-border)]/80">
                  {recentThreads.map((th) => (
                    <li key={th.id}>
                      <button
                        type="button"
                        onClick={() => onSelectThread(th.id)}
                        className="flex w-full items-center gap-2 py-2.5 text-left transition hover:bg-[var(--app-bg)]/80"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--app-text)]">
                          {th.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--app-muted)]">
                          {formatRelativePast(th.updatedAt, locale)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--app-border)] bg-gradient-to-br from-[var(--app-bg)] to-[var(--app-surface)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
              {t("home.ai.title")}
            </p>
            <p className="mt-4 text-base leading-relaxed text-[var(--app-text)]">{suggestion}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onNewChat();
                }}
                className="rounded-xl bg-[var(--app-text)] px-4 py-2 text-sm font-medium text-[var(--app-bg)] transition hover:opacity-90"
              >
                {t("home.ai.startChat")}
              </button>
              <button
                type="button"
                onClick={() => onNavigate("models")}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)]"
              >
                {t("home.ai.models")}
              </button>
            </div>
          </section>
        </div>
      </div>
      <style>{`
        @keyframes home-dashboard-hue {
          0% { filter: hue-rotate(0deg); opacity: 0.22; }
          100% { filter: hue-rotate(25deg); opacity: 0.32; }
        }
        .home-dashboard-ambient {
          animation: home-dashboard-hue 14s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-dashboard-ambient {
            animation: none;
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}

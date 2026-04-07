import { AnimatePresence, motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";

/**
 * Glass notification banner when a newer ggml-org/llama.cpp release is available (startup check).
 * Styled like a frosted alert card with motion enter/exit.
 */
export function RuntimeUpdateBanner() {
  const { t } = useTranslation();
  const banner = useUiStore((s) => s.runtimeUpdateBanner);
  const dismiss = useUiStore((s) => s.dismissRuntimeUpdateBanner);
  const openSettingsToRuntime = useUiStore((s) => s.openSettingsToRuntime);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[460] flex max-w-[min(calc(100vw-2rem),19.75rem)] justify-end"
      aria-live="polite"
    >
      <AnimatePresence>
        {banner ? (
          <motion.div
            key="runtime-update-banner"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "pointer-events-auto relative w-full rounded-xl border p-2.5 shadow-lg backdrop-blur-md",
              "border-[var(--app-border)] bg-[var(--app-surface)]/85 text-[var(--app-text)]",
              "dark:bg-[var(--app-bg)]/75",
            )}
          >
            <button
              type="button"
              onClick={() => dismiss()}
              className="absolute right-2 top-2 rounded-full p-0.5 text-[var(--app-muted)] transition hover:bg-black/[0.06] hover:text-[var(--app-text)] dark:hover:bg-white/10"
              aria-label={t("common.close")}
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>

            <div className="flex items-start gap-2 pr-6">
              <div className="flex shrink-0 text-sky-600 dark:text-sky-400">
                <Info className="h-[1.05rem] w-[1.05rem]" strokeWidth={2} aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <h4 className="text-[0.8125rem] font-semibold leading-snug text-[var(--app-text)]">
                  {t("settings.runtime.updateBannerTitle")}
                </h4>
                <p className="text-[0.6875rem] leading-relaxed text-[var(--app-muted)]">
                  {t("settings.runtime.updateBannerDescription", { tag: banner.tag })}
                </p>
                <button
                  type="button"
                  onClick={() => openSettingsToRuntime()}
                  className="mt-0.5 w-fit rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/80 px-2 py-1 text-[0.6875rem] font-semibold text-[var(--app-text)] transition hover:bg-[var(--chat-composer-toolbar-hover)] dark:bg-white/5 dark:hover:bg-white/10"
                >
                  {t("settings.runtime.updateBannerCta")}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

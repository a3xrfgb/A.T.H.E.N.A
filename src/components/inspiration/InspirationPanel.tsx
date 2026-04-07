import { useCallback } from "react";
import { INSPIRATION_INDEX_SECTIONS } from "../../constants/inspirationIndexData";
import { useTranslation } from "../../i18n/I18nContext";
import { openExternalUrl } from "../../lib/openExternalUrl";
import { cn } from "../../lib/utils";
import { GradientDots } from "./GradientDots";

function IndexSiteCard({
  name,
  url,
  thumb,
}: {
  name: string;
  url: string;
  thumb: string;
}) {
  const onOpen = useCallback(() => {
    void openExternalUrl(url);
  }, [url]);

  const isMidjourneyThumb = thumb.includes("midjourney");
  /** Black wordmarks / symbols from Commons — stay visible on dark glass panels. */
  const isDarkInvertLogo = thumb.includes("Runway_Black_Logo");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${name} in browser`}
      className={cn(
        "group relative flex w-[min(100%,176px)] flex-shrink-0 flex-col overflow-hidden rounded-xl border text-left transition-all duration-300 ease-out",
        "border-white/55 bg-gradient-to-br from-white/50 via-white/35 to-white/25",
        "shadow-[0_10px_40px_-12px_rgba(15,23,42,0.28),0_4px_20px_-6px_rgba(15,23,42,0.14),inset_0_1px_0_0_rgba(255,255,255,0.72),inset_0_-1px_0_0_rgba(255,255,255,0.2)]",
        "backdrop-blur-xl backdrop-saturate-150",
        "hover:-translate-y-2 hover:scale-[1.03] hover:border-accent/40",
        "hover:shadow-[0_24px_56px_-16px_rgba(15,23,42,0.38),0_12px_32px_-10px_rgba(15,23,42,0.22),inset_0_1px_0_0_rgba(255,255,255,0.85)]",
        "hover:from-white/65 hover:via-white/45 hover:to-white/35",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]",
        "dark:border-white/[0.14] dark:from-white/[0.12] dark:via-white/[0.08] dark:to-white/[0.05]",
        "dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.65),0_4px_20px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.1)]",
        "dark:hover:border-accent/45 dark:hover:from-white/[0.18] dark:hover:via-white/[0.12] dark:hover:to-white/[0.08]",
        "dark:hover:shadow-[0_24px_56px_-16px_rgba(0,0,0,0.75),0_12px_32px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.14)]",
        "active:scale-[0.98] active:translate-y-0",
      )}
    >
      <div
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden",
          "rounded-t-xl border-b border-white/30 bg-white/25 shadow-inner shadow-black/[0.06] backdrop-blur-md",
          "dark:border-white/[0.08] dark:bg-white/[0.06] dark:shadow-inner dark:shadow-black/30",
          "transition-[background-color,box-shadow] duration-300 group-hover:bg-white/40 dark:group-hover:bg-white/[0.1]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-0 flex items-center justify-center p-1.5 sm:p-2">
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              "relative z-[1] max-h-full max-w-full object-contain object-center transition duration-300 ease-out",
              "group-hover:scale-110 group-hover:drop-shadow-md",
              isMidjourneyThumb && "brightness-0 dark:invert",
              isDarkInvertLogo && "dark:invert",
            )}
          />
        </div>
      </div>
      <span
        className={cn(
          "w-full min-w-0 px-2.5 pb-2.5 pt-1 text-center text-[11px] font-medium leading-snug tracking-tight text-[var(--app-muted)]",
          "line-clamp-2 group-hover:text-[var(--app-text)]/90",
        )}
      >
        {name}
      </span>
    </button>
  );
}

export function InspirationPanel() {
  const { t } = useTranslation();
  const lead = t("inspiration.panel.lead").trim();
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden text-[var(--app-text)]">
      <GradientDots className="pointer-events-none z-0" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-16 pt-6">
        <h1 className="text-xl font-semibold">{t("app.titleInspiration")}</h1>
        {lead ? (
          <p className="mt-1 text-sm text-[var(--app-muted)]">{lead}</p>
        ) : null}

        <div className="mt-10 flex flex-col gap-14">
          {INSPIRATION_INDEX_SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-6">
              <h2 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
                {section.title}
              </h2>
              <div className="flex flex-row flex-wrap gap-5 sm:gap-6">
                {section.cards.map((c) => (
                  <IndexSiteCard key={c.url} name={c.name} url={c.url} thumb={c.thumb} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

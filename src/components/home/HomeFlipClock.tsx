import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";

function get12hParts(d: Date) {
  let h = d.getHours();
  const isPm = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;
  return {
    hourStr: String(h).padStart(2, "0"),
    minuteStr: String(d.getMinutes()).padStart(2, "0"),
    secondStr: String(d.getSeconds()).padStart(2, "0"),
    isPm,
  };
}

/** Minimal flip-tile style clock: HOUR · MIN · SEC (12-hour, no on-screen AM/PM). */
export function HomeFlipClock({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { hourStr, minuteStr, secondStr, isPm } = get12hParts(now);
  const meridiem = isPm ? t("home.clock.pm") : t("home.clock.am");
  const ariaTime = `${hourStr}:${minuteStr}:${secondStr} ${meridiem}`;

  return (
    <div
      className={
        compact
          ? "mx-auto flex w-fit max-w-full flex-col justify-center rounded-2xl border border-black/20 bg-[#000000] px-3 py-2.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)] sm:px-4 sm:py-3"
          : "mx-auto flex w-fit max-w-full flex-col justify-center rounded-[2.6rem] border border-black/20 bg-[#000000] px-[1.625rem] py-[1.3rem] shadow-[0_16px_48px_-20px_rgba(0,0,0,0.55)] sm:px-[1.95rem] sm:py-[1.625rem]"
      }
      role="timer"
      aria-live="polite"
      aria-label={t("home.clock.aria", { time: ariaTime })}
    >
      <div
        className={
          compact
            ? "flex w-fit max-w-full items-stretch justify-center gap-2 sm:gap-3"
            : "flex w-fit max-w-full items-stretch justify-center gap-4 sm:gap-[1.3rem]"
        }
      >
        <FlipTile compact={compact} label={t("home.clock.hour")} value={hourStr} />
        <FlipTile compact={compact} label={t("home.clock.min")} value={minuteStr} />
        <FlipTile compact={compact} label={t("home.clock.sec")} value={secondStr} />
      </div>
    </div>
  );
}

function FlipTile({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex min-w-0 w-[4.85rem] shrink-0 flex-col items-center justify-end sm:w-[5.5rem]"
          : "flex min-w-0 w-[9.1rem] shrink-0 flex-col items-center justify-end sm:w-[10.4rem]"
      }
    >
      <div
        className={
          compact
            ? "relative flex h-[4.25rem] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl sm:h-[4.75rem]"
            : "relative flex h-[7.8rem] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl sm:h-[8.45rem]"
        }
        style={{ background: "#2B2B2B" }}
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 -translate-y-px border-t border-b border-black/55 bg-black/25"
          style={{ height: compact ? 3 : 5.2 }}
          aria-hidden
        />
        <span
          className="relative z-0 select-none tabular-nums tracking-tight text-white"
          style={{
            fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif',
            fontSize: compact
              ? "clamp(2.35rem, 6vw, 2.85rem)"
              : "clamp(4.3rem, 10.4vw, 5.6rem)",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      <div className={compact ? "mt-1.5 h-5 shrink-0" : "mt-3 h-9 shrink-0"} aria-hidden />
      <p
        className={
          compact
            ? "mt-1.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/90 sm:text-xs"
            : "mt-3 text-center text-[26px] font-medium uppercase tracking-[0.28em] text-white/90"
        }
      >
        {label}
      </p>
    </div>
  );
}

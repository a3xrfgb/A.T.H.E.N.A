import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { openExternalUrl } from "../../lib/openExternalUrl";
import { cn } from "../../lib/utils";

const QR_SRC = "/support-qr.png";
const LINKTREE_URL = "https://linktr.ee/ababiyaworku";

/** Sam Herbert (@sherb) — http://goo.gl/7AJzbL */
function SupportHeartsAnimation({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-[min(200px,85%)] text-[#FF380F]", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M30.262 57.02L7.195 40.723c-5.84-3.976-7.56-12.06-3.842-18.063 3.715-6 11.467-7.65 17.306-3.68l4.52 3.76 2.6-5.274c3.717-6.002 11.47-7.65 17.305-3.68 5.84 3.97 7.56 12.054 3.842 18.062L34.49 56.118c-.897 1.512-2.793 1.915-4.228.9z" fillOpacity={0.5}>
        <animate
          attributeName="fill-opacity"
          begin="0s"
          dur="1.4s"
          values="0.5;1;0.5"
          calcMode="linear"
          repeatCount="indefinite"
        />
      </path>
      <path d="M105.512 56.12l-14.44-24.272c-3.716-6.008-1.996-14.093 3.843-18.062 5.835-3.97 13.588-2.322 17.306 3.68l2.6 5.274 4.52-3.76c5.84-3.97 13.592-2.32 17.307 3.68 3.718 6.003 1.998 14.088-3.842 18.064L109.74 57.02c-1.434 1.014-3.33.61-4.228-.9z" fillOpacity={0.5}>
        <animate
          attributeName="fill-opacity"
          begin="0.7s"
          dur="1.4s"
          values="0.5;1;0.5"
          calcMode="linear"
          repeatCount="indefinite"
        />
      </path>
      <path d="M67.408 57.834l-23.01-24.98c-5.864-6.15-5.864-16.108 0-22.248 5.86-6.14 15.37-6.14 21.234 0L70 16.168l4.368-5.562c5.863-6.14 15.375-6.14 21.235 0 5.863 6.14 5.863 16.098 0 22.247l-23.007 24.98c-1.43 1.556-3.757 1.556-5.188 0z" />
    </svg>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const MAX_TILT = 11;

function SupportGlassTiltCard({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [hover, setHover] = useState(false);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      setTilt({
        rx: -y * MAX_TILT * 2,
        ry: x * MAX_TILT * 2,
      });
    },
    [reducedMotion],
  );

  const onLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 });
    setHover(false);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full max-w-[280px] [perspective:1200px]"
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
    >
      <div
        className={cn(
          "relative transform-gpu rounded-2xl will-change-transform",
          !reducedMotion && "transition-[transform] duration-300 ease-out",
          hover && !reducedMotion && "duration-75 ease-out",
        )}
        style={{
          transform: reducedMotion
            ? undefined
            : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
        }}
      >
        <div
          className={cn(
            "relative overflow-visible rounded-2xl",
            "border border-white/25 bg-white/[0.08] shadow-[0_28px_56px_-16px_rgba(0,0,0,0.35),0_12px_24px_-10px_rgba(0,0,0,0.2)]",
            "backdrop-blur-xl dark:border-white/15 dark:bg-white/[0.06]",
            "dark:shadow-[0_28px_56px_-16px_rgba(0,0,0,0.55),0_12px_24px_-10px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex -translate-y-[42%] justify-center">
            <SupportHeartsAnimation />
          </div>
          <div className="relative z-0 px-5 pb-6 pt-10 sm:px-6 sm:pb-7 sm:pt-12">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSupportPanel() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 flex-col px-8 pb-3 pt-10">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="mx-auto mb-8 max-w-md text-center text-sm leading-relaxed text-[var(--app-muted)]">
          {t("settings.support.lead")}
        </p>
        <div className="flex flex-col items-center pb-6">
          <SupportGlassTiltCard>
            <div className="flex flex-col items-center">
              <img
                src={QR_SRC}
                alt={t("settings.support.qrAlt")}
                className="h-auto w-full max-w-[220px] rounded-md object-contain"
                draggable={false}
              />
              <p className="mt-4 text-center text-xs text-[var(--app-muted)]">{t("settings.support.scanHint")}</p>
            </div>
          </SupportGlassTiltCard>
        </div>
      </div>

      <div className="flex shrink-0 justify-center pb-1 pt-1">
        <button
          type="button"
          onClick={() => void openExternalUrl(LINKTREE_URL)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/80 px-3 py-2 transition",
            "hover:border-[#43E55C]/50 hover:bg-[var(--app-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#43E55C]",
          )}
          aria-label={t("settings.support.linktreeAria")}
        >
          <img
            src="/icons/linktree.svg"
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] shrink-0"
            draggable={false}
          />
          <span className="text-center text-[11px] font-semibold tracking-wide text-[var(--app-text)]">
            {t("settings.support.linktreeName")}
          </span>
        </button>
      </div>
    </div>
  );
}

import { motion, useReducedMotion, useSpring } from "framer-motion";
import { useCallback, useRef, type MouseEvent } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { cn } from "../../lib/utils";
import { AthenaLogo } from "../layout/AthenaLogo";

const MAX_TILT_X = 14;
const MAX_TILT_Y = 18;

function AboutGlassLogo3D({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 260, damping: 28, mass: 0.85 });
  const rotateY = useSpring(0, { stiffness: 260, damping: 28, mass: 0.85 });

  const handleMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      rotateX.set(y * -MAX_TILT_X);
      rotateY.set(x * MAX_TILT_Y);
    },
    [reduceMotion, rotateX, rotateY],
  );

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative mx-auto [perspective:1100px]", className)}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* Soft floor shadow — stays flat while card tilts */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-3 left-1/2 h-8 w-[78%] -translate-x-1/2 rounded-[100%] blur-2xl",
          "bg-[color-mix(in_srgb,var(--app-text)_14%,transparent)] opacity-70",
          "dark:bg-black/55 dark:opacity-90",
        )}
      />
      <motion.div
        style={{
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "relative rounded-[1.65rem] border p-7 sm:p-8",
          "border-white/45 bg-gradient-to-br from-white/[0.55] via-white/35 to-white/[0.2]",
          "shadow-[0_28px_56px_-18px_rgba(15,23,42,0.22),0_10px_22px_-10px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.75),inset_0_-1px_0_0_rgba(148,163,184,0.12)]",
          "backdrop-blur-2xl backdrop-saturate-[1.75]",
          "dark:border-white/[0.14] dark:from-white/[0.12] dark:via-white/[0.06] dark:to-white/[0.03]",
          "dark:shadow-[0_36px_72px_-24px_rgba(0,0,0,0.72),0_14px_28px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-1px_0_0_rgba(0,0,0,0.35)]",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.55rem] opacity-90"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 42%, transparent 58%, rgba(255,255,255,0.08) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[1.55rem] dark:opacity-40"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, transparent 45%, rgba(0,0,0,0.2) 100%)",
          }}
        />
        <div
          className="relative flex items-center justify-center [transform:translateZ(36px)]"
          style={{ transformStyle: "preserve-3d" }}
        >
          <AthenaLogo
            className="relative z-[1] h-20 w-20 object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.15)] dark:drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)] sm:h-24 sm:w-24"
            alt=""
          />
        </div>
      </motion.div>
    </div>
  );
}

export function SettingsAboutPanel() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[min(78vh,620px)] flex-col justify-between px-8 pb-8 pt-10">
      <div>
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <AboutGlassLogo3D />
          <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-[var(--app-text)]">
            {t("settings.sidebarBrandName")}
          </p>
          <p className="mt-2 text-xs text-[var(--app-muted)]">{t("settings.sidebarBrandTagline")}</p>
        </div>

        <div className="mx-auto mt-10 max-w-xl space-y-4 text-sm leading-relaxed text-[var(--app-text)]">
          {(["settings.about.p1", "settings.about.p2", "settings.about.p3"] as const).map((key) => {
            const text = t(key).trim();
            if (!text) return null;
            return (
              <p key={key} className="text-[var(--app-muted)]">
                {text}
              </p>
            );
          })}
        </div>
      </div>

      <p className="max-w-xl self-center text-balance text-center font-roboto text-[15px] font-normal leading-snug text-[var(--app-muted)]">
        {t("settings.about.credit")}
      </p>
    </div>
  );
}

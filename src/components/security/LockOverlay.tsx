import { useRef, useState } from "react";
import { api } from "../../lib/tauri";
import { useTranslation } from "../../i18n/I18nContext";
import { useLockStore } from "../../store/lockStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { LockNeuralVortexBackground } from "./LockNeuralVortexBackground";

export function LockOverlay() {
  const { t } = useTranslation();
  const locked = useLockStore((s) => s.locked);
  const setLocked = useLockStore((s) => s.setLocked);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const pushToast = useUiStore((s) => s.pushToast);
  const pinInputRef = useRef<HTMLInputElement>(null);

  if (!locked) return null;

  const submit = async () => {
    setErr("");
    try {
      const ok = await api.verifyAppPin(pin);
      if (ok) {
        setPin("");
        setLocked(false);
        useLockStore.getState().touchActivity();
        pushToast(t("lock.unlocked"), "success");
      } else {
        setErr(t("lock.incorrectPin"));
      }
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex min-h-0 flex-col items-center justify-center overflow-hidden px-6">
      {/* Opaque base: hides all app UI beneath the WebGL layer (canvas uses partial alpha). */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-white dark:bg-[var(--app-bg)]"
        aria-hidden
      />
      <LockNeuralVortexBackground className="z-[1]" />
      <button
        type="button"
        aria-label={t("lock.heading")}
        onClick={() => pinInputRef.current?.focus()}
        className={cn(
          "relative z-10 mb-12 flex h-[8.5rem] w-[8.5rem] shrink-0 items-center justify-center rounded-full transition-transform sm:h-40 sm:w-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-text)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]",
          "active:scale-[0.98]",
          /* Light: white disc + soft layered shadow */
          "border border-black/[0.07] bg-white",
          "shadow-[0_28px_90px_-20px_rgba(15,23,42,0.28),0_14px_36px_-18px_rgba(15,23,42,0.12),0_4px_12px_-4px_rgba(15,23,42,0.08)]",
          /* Dark: glassmorphism on the control only */
          "dark:border-white/20 dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_32px_100px_-28px_rgba(0,0,0,0.85)]",
          "dark:backdrop-blur-2xl dark:backdrop-saturate-150",
        )}
      >
        <img
          src="/lock-icon.png"
          alt=""
          draggable={false}
          className={cn(
            "h-[66%] w-[66%] object-contain select-none pointer-events-none",
            "dark:brightness-0 dark:invert dark:opacity-90",
          )}
        />
      </button>

      <div className="relative z-10 w-full max-w-[17.5rem] space-y-4">
        <div className="space-y-1 text-center">
          <h2 className="text-[15px] font-medium tracking-tight text-[var(--app-text)]">
            {t("lock.heading")}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--app-muted)]">{t("lock.enterPinContinue")}</p>
        </div>
        <input
          ref={pinInputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          className={cn(
            "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-center",
            "text-lg tracking-[0.35em] text-[var(--app-text)] outline-none transition",
            "placeholder:text-[var(--app-muted)]/50 focus:border-[var(--app-text)]/25",
          )}
          placeholder="••••"
          value={pin}
          maxLength={6}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        {err ? <p className="text-center text-xs text-red-500 dark:text-red-400">{err}</p> : null}
        <button
          type="button"
          className={cn(
            "w-full rounded-xl py-3 text-sm font-medium transition",
            "bg-[var(--app-text)] text-[var(--app-bg)]",
            "hover:opacity-90 active:opacity-[0.85]",
          )}
          onClick={() => void submit()}
        >
          {t("lock.unlock")}
        </button>
      </div>
    </div>
  );
}

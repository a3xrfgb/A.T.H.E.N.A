import { useCallback, useState } from "react";
import { api } from "../../lib/tauri";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { SettingsGlassSelect } from "./SettingsGlassSelect";

const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: "Off", value: 0 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
];

/** Frosted panels + soft layered shadow (light + dark). */
const glassCard =
  "rounded-xl border border-white/70 bg-gradient-to-br from-white/75 via-white/50 to-white/35 p-3.5 " +
  "shadow-[0_12px_40px_-10px_rgba(15,23,42,0.18),0_6px_20px_-8px_rgba(15,23,42,0.1),0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1px_0_0_rgba(255,255,255,0.95)] " +
  "backdrop-blur-2xl backdrop-saturate-150 " +
  "dark:border-white/20 dark:from-white/[0.14] dark:via-white/[0.09] dark:to-white/[0.06] " +
  "dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55),0_8px_24px_-10px_rgba(0,0,0,0.35),0_2px_12px_-4px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.12)]";

export function SettingsSecurityPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const hasPin = Boolean(settings.securityPinHash?.length);
  const [pinA, setPinA] = useState("");
  const [pinB, setPinB] = useState("");
  const [busy, setBusy] = useState(false);

  const resetPinFields = () => {
    setPinA("");
    setPinB("");
  };

  const submitPin = useCallback(async () => {
    const a = pinA.replace(/\D/g, "");
    const b = pinB.replace(/\D/g, "");
    if (a.length < 4 || a.length > 6) {
      pushToast("PIN must be 4–6 digits", "error");
      return;
    }
    if (a !== b) {
      pushToast("PINs do not match", "error");
      return;
    }
    setBusy(true);
    try {
      await api.setAppPin(a);
      await loadSettings();
      resetPinFields();
      pushToast(hasPin ? "PIN updated" : "PIN enabled", "success");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }, [pinA, pinB, hasPin, loadSettings, pushToast]);

  const removePin = useCallback(async () => {
    setBusy(true);
    try {
      await api.clearAppPin();
      await loadSettings();
      resetPinFields();
      pushToast("PIN removed", "info");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(false);
    }
  }, [loadSettings, pushToast]);

  const onAutoLockChange = async (value: number) => {
    try {
      await save({ securityAutoLockMinutes: value });
      pushToast("Auto-lock updated", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const inputClass =
    "w-full rounded-md border border-[var(--app-border)]/80 bg-white/55 px-2.5 py-1.5 text-sm text-[var(--app-text)] outline-none backdrop-blur-sm transition-colors " +
    "focus:border-accent focus:ring-1 focus:ring-accent/30 " +
    "dark:border-white/15 dark:bg-black/25";

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-10 min-h-[min(560px,72vh)]">
      <div className="w-full max-w-[20rem] space-y-5">
        <header className="flex flex-col items-center text-center">
          <div
            className="mb-2 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--app-border)]/90 bg-[var(--app-bg)] shadow-sm"
            aria-hidden
          >
            <img
              src="/lock-icon.png"
              alt=""
              draggable={false}
              className={cn(
                "h-16 w-16 object-contain select-none pointer-events-none",
                "dark:brightness-0 dark:invert dark:opacity-90",
              )}
            />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--app-text)]">
            Security
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-muted)]">
            PIN and idle lock. Stored hashed on this device.
          </p>
        </header>

        <div className={cn(glassCard, "space-y-3")}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
              App PIN
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--app-muted)]/90">
              {hasPin
                ? "New PIN twice to change, or remove below."
                : "4–6 digits. Lock from the sidebar."}
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              placeholder="New PIN"
              value={pinA}
              onChange={(e) => setPinA(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              placeholder="Confirm"
              value={pinB}
              onChange={(e) => setPinB(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
            <button
              type="button"
              disabled={busy || pinA.length < 4}
              onClick={() => void submitPin()}
              className={cn(
                "w-full rounded-md bg-[#0080ff] px-3 py-1.5 text-xs font-medium text-white",
                "transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {hasPin ? "Update PIN" : "Set PIN"}
            </button>
          </div>
          {hasPin ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removePin()}
              className="w-full text-center text-[11px] font-medium text-[var(--dropdown-danger)] hover:underline disabled:opacity-50"
            >
              Remove PIN
            </button>
          ) : null}
        </div>

        <div className={cn(glassCard, "space-y-2.5")}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
              Auto-lock
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--app-muted)]/90">
              After idle time when a PIN is set.
            </p>
          </div>
          <SettingsGlassSelect
            className="w-full"
            triggerClassName="px-2.5 py-2 text-sm"
            value={String(settings.securityAutoLockMinutes)}
            disabled={!hasPin}
            onValueChange={(v) => void onAutoLockChange(Number(v))}
            options={AUTO_LOCK_OPTIONS.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
          />
          {!hasPin ? (
            <p className="text-[10px] text-[var(--app-muted)]">Set a PIN first.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

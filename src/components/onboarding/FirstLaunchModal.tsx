import * as Dialog from "@radix-ui/react-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { open as openNativeFileDialog } from "@tauri-apps/plugin-dialog";
import { ArrowRight, Camera, ChevronLeft, Moon, Sparkles, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import {
  completeFirstLaunchOnboarding,
  hasCompletedFirstLaunchOnboarding,
} from "../../lib/firstLaunchOnboarding";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";
import { getEffectiveDark, useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { AthenaLogo } from "../layout/AthenaLogo";
import { ProfileAvatar } from "../profile/ProfileAvatar";

/** Theme + profile (splash is step 0, not counted). */
const ONBOARDING_STEPS = 2;
/** Show Continue on splash after logo + title + subtitle have appeared. */
const SPLASH_CONTINUE_DELAY_MS = 3000;

type FirstLaunchModalProps = {
  onFlowComplete?: () => void;
};

/**
 * First open only: splash (Continue after 3s) → theme (pick atmosphere + Continue) → profile → Home.
 * Outside click / overlay close disabled until the flow finishes.
 */
export function FirstLaunchModal({ onFlowComplete }: FirstLaunchModalProps) {
  const { t } = useTranslation();
  const loaded = useSettingsStore((s) => s.loaded);
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const [open, setOpen] = useState(false);
  /** 0 = splash, 1 = theme, 2 = profile */
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [splashContinueVisible, setSplashContinueVisible] = useState(false);
  /** True after user taps Light or Dark on the theme step (reset when arriving from splash only). */
  const [hasPickedAtmosphere, setHasPickedAtmosphere] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevStepRef = useRef(step);

  useEffect(() => {
    if (!loaded) return;
    if (!hasCompletedFirstLaunchOnboarding()) setOpen(true);
  }, [loaded]);

  useEffect(() => {
    if (!open || step !== 0) {
      setSplashContinueVisible(false);
      return;
    }
    setSplashContinueVisible(false);
    const id = window.setTimeout(() => setSplashContinueVisible(true), SPLASH_CONTINUE_DELAY_MS);
    return () => clearTimeout(id);
  }, [open, step]);

  useEffect(() => {
    if (step === 2) setDisplayName(settings.profileFullName);
  }, [step, settings.profileFullName]);

  useEffect(() => {
    if (step === 1 && prevStepRef.current === 0) setHasPickedAtmosphere(false);
    prevStepRef.current = step;
  }, [step]);

  const pickImage = useCallback(async () => {
    try {
      if (isTauri()) {
        const selected = await openNativeFileDialog({
          multiple: false,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
        });
        if (selected === null || Array.isArray(selected)) return;
        const dest = await api.importProfilePicture(selected);
        await save({ profilePicturePath: dest });
        pushToast(t("settings.profile.photoSaved"), "success");
        return;
      }
      fileRef.current?.click();
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [save, pushToast, t]);

  const onFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (file.size > 1_500_000) {
        pushToast(t("profile.imageTooLarge"), "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result ?? "");
        void save({ profilePicturePath: data }).then(() =>
          pushToast(t("settings.profile.photoSaved"), "success"),
        );
      };
      reader.readAsDataURL(file);
    },
    [save, pushToast, t],
  );

  const finishFlow = useCallback(async () => {
    try {
      await save({ profileFullName: displayName.trim() });
    } catch (e) {
      pushToast(String(e), "error");
      return;
    }
    completeFirstLaunchOnboarding();
    setOpen(false);
    onFlowComplete?.();
  }, [displayName, save, pushToast, onFlowComplete]);

  const selectTheme = useCallback(
    (mode: "light" | "dark") => {
      setHasPickedAtmosphere(true);
      void save({ theme: mode }).catch((e) => pushToast(String(e), "error"));
    },
    [save, pushToast],
  );

  const onOpenChange = useCallback((next: boolean) => {
    if (next) setOpen(true);
  }, []);

  const systemDark = settings.theme === "system" ? getEffectiveDark("system") : false;
  const isLightSelected =
    settings.theme === "light" ||
    settings.theme === "cream" ||
    settings.theme === "beige" ||
    settings.theme === "rose" ||
    (settings.theme === "system" && !systemDark);
  const isDarkSelected =
    settings.theme === "dark" ||
    settings.theme === "slate" ||
    settings.theme === "ocean" ||
    settings.theme === "forest" ||
    (settings.theme === "system" && systemDark);

  const cardShell = cn(
    "first-launch-onboarding-dialog relative w-[min(92vw,440px)] max-h-[min(88vh,640px)]",
    "overflow-x-hidden overflow-y-auto overscroll-contain",
    "rounded-[28px] border border-[var(--app-border)]",
    "bg-[var(--app-surface)]/92 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.35)]",
    "dark:bg-[var(--app-surface)]/88 dark:shadow-[0_32px_90px_-24px_rgba(0,0,0,0.75)]",
  );

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[540] animate-first-launch-overlay transition-[backdrop-filter,background-color] duration-500",
            step === 0
              ? "bg-[var(--app-bg)]"
              : "bg-[var(--app-bg)]/[0.72] backdrop-blur-xl backdrop-saturate-150",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed inset-0 z-[541] flex flex-col items-center justify-center outline-none focus:outline-none",
            step === 0 ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto px-4 py-8",
          )}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            if (step === 2) setStep(1);
          }}
        >
          <Dialog.Title className="sr-only">{t("onboarding.srTitle")}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("onboarding.srDescription")}
          </Dialog.Description>

          {step === 0 ? (
            <div className="flex flex-col items-center justify-center px-8">
              <AthenaLogo className="h-[5.5rem] w-[5.5rem] shrink-0 object-contain sm:h-28 sm:w-28 animate-onboarding-splash-logo" />
              <h1 className="mt-10 text-center font-sans text-[1.65rem] font-medium tracking-[-0.02em] text-[var(--app-text)] sm:text-[1.85rem] animate-onboarding-splash-title">
                {t("onboarding.splashTitle")}
              </h1>
              <p className="mt-3 max-w-[20rem] text-center text-[13px] leading-snug text-[var(--app-muted)] sm:text-sm animate-onboarding-splash-subtitle">
                {t("onboarding.splashSubtitle")}
              </p>
              <div className="mt-10 flex min-h-[52px] items-center justify-center">
                {splashContinueVisible ? (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full px-10 py-3.5",
                      "text-[15px] font-medium tracking-wide text-white",
                      "bg-[var(--app-text)] shadow-lg transition duration-300",
                      "hover:scale-[1.02] hover:opacity-[0.92] active:scale-[0.99]",
                      "dark:text-[var(--app-bg)]",
                      "animate-onboarding-splash-cta",
                    )}
                  >
                    {t("onboarding.continue")}
                    <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={cn(cardShell, "animate-onboarding-step px-0")}>
              <div
                className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-accent/25 blur-3xl animate-first-launch-glow dark:bg-accent/20"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl dark:bg-accent/12"
                aria-hidden
              />

              <div
                key={step}
                className="relative px-9 pb-10 pt-9 sm:px-11 sm:pt-10 animate-onboarding-step"
              >
                {step === 1 ? (
                  <>
                    <p className="text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--app-muted)]">
                      {t("onboarding.stepProgress", { current: 1, total: ONBOARDING_STEPS })}
                    </p>
                    <div className="mb-8 mt-6 flex flex-col items-center gap-4">
                      <div
                        className="h-px w-20 bg-[length:200%_100%] animate-first-launch-shimmer"
                        style={{
                          backgroundImage:
                            "linear-gradient(90deg, transparent, var(--accent, #7c6af7), transparent)",
                        }}
                        aria-hidden
                      />
                      <AthenaLogo className="h-12 w-12 shrink-0 object-contain opacity-90" />
                      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--app-muted)]">
                        {t("onboarding.themeEyebrow")}
                      </p>
                      <h2 className="text-center font-sans text-[1.65rem] font-light leading-tight tracking-[-0.03em] text-[var(--app-text)] sm:text-[1.85rem]">
                        {t("onboarding.themeTitle")}
                      </h2>
                    </div>
                    <p className="mx-auto max-w-[34ch] text-center text-[14px] leading-relaxed text-[var(--app-muted)]">
                      {t("onboarding.themeSubtitle")}
                    </p>
                    <p className="mx-auto mt-3 max-w-[34ch] text-center text-[12px] text-[var(--app-muted)]/85">
                      {t("onboarding.themePickHint")}
                    </p>

                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => selectTheme("light")}
                        className={cn(
                          "group flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-center transition duration-300",
                          "border-[var(--app-border)] bg-[var(--app-bg)]/60 hover:border-[var(--app-text)]/20",
                          isLightSelected &&
                            "border-[var(--app-text)]/35 ring-2 ring-[var(--app-text)]/15 ring-offset-2 ring-offset-[var(--app-surface)]",
                        )}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                          <Sun className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                        </span>
                        <span className="text-sm font-medium text-[var(--app-text)]">
                          {t("onboarding.themeLight")}
                        </span>
                        <span className="text-[11px] leading-snug text-[var(--app-muted)]">
                          {t("onboarding.themeLightHint")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => selectTheme("dark")}
                        className={cn(
                          "group flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 text-center transition duration-300",
                          "border-[var(--app-border)] bg-[var(--app-bg)]/60 hover:border-[var(--app-text)]/20",
                          isDarkSelected &&
                            "border-[var(--app-text)]/35 ring-2 ring-[var(--app-text)]/15 ring-offset-2 ring-offset-[var(--app-surface)]",
                        )}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-indigo-300">
                          <Moon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                        </span>
                        <span className="text-sm font-medium text-[var(--app-text)]">
                          {t("onboarding.themeDark")}
                        </span>
                        <span className="text-[11px] leading-snug text-[var(--app-muted)]">
                          {t("onboarding.themeDarkHint")}
                        </span>
                      </button>
                    </div>

                    <div className="mt-10 flex justify-center">
                      <button
                        type="button"
                        disabled={!hasPickedAtmosphere}
                        onClick={() => setStep(2)}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-full px-9 py-3.5",
                          "text-[15px] font-medium tracking-wide transition duration-300",
                          hasPickedAtmosphere
                            ? cn(
                                "text-white bg-[var(--app-text)] shadow-lg",
                                "hover:scale-[1.02] hover:opacity-[0.92] active:scale-[0.99]",
                                "dark:text-[var(--app-bg)]",
                              )
                            : "cursor-not-allowed bg-[var(--app-border)] text-[var(--app-muted)] opacity-70",
                        )}
                      >
                        {t("onboarding.continue")}
                        <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--app-muted)]">
                      {t("onboarding.stepProgress", { current: 2, total: ONBOARDING_STEPS })}
                    </p>
                    <div className="mb-6 mt-4 flex flex-col items-center gap-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[var(--app-muted)]">
                        {t("onboarding.profileEyebrow")}
                      </p>
                      <h2 className="text-center font-sans text-[1.55rem] font-light leading-tight tracking-[-0.03em] text-[var(--app-text)]">
                        {t("onboarding.profileTitle")}
                      </h2>
                    </div>
                    <p className="mx-auto max-w-[34ch] text-center text-[14px] leading-relaxed text-[var(--app-muted)]">
                      {t("onboarding.profileSubtitle")}
                    </p>

                    <div className="mt-8 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void pickImage()}
                        className="group relative rounded-full outline-none ring-offset-2 ring-offset-[var(--app-surface)] focus-visible:ring-2 focus-visible:ring-[var(--app-text)]/25"
                        aria-label={t("settings.profile.addPhoto")}
                      >
                        <ProfileAvatar
                          containerClassName="h-28 w-28 transition duration-300 group-hover:scale-[1.03] group-active:scale-[0.98]"
                          iconClassName="h-12 w-12"
                        />
                        <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] shadow-md">
                          <Camera className="h-4 w-4 text-[var(--app-text)]" strokeWidth={2} aria-hidden />
                        </span>
                      </button>
                      <p className="text-[11px] text-[var(--app-muted)]">{t("onboarding.profilePhotoHint")}</p>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onFileInput(e)}
                      />
                    </div>

                    <div className="mt-8">
                      <label
                        className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]"
                        htmlFor="onboarding-name"
                      >
                        {t("onboarding.profileNameLabel")}
                      </label>
                      <input
                        id="onboarding-name"
                        autoComplete="name"
                        placeholder={t("onboarding.profileNamePlaceholder")}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={cn(
                          "mt-2 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3",
                          "text-[15px] text-[var(--app-text)] outline-none transition",
                          "placeholder:text-[var(--app-muted)]/55 focus:border-[var(--app-text)]/25",
                        )}
                      />
                    </div>

                    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-medium",
                          "text-[var(--app-muted)] transition hover:text-[var(--app-text)]",
                        )}
                      >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
                        {t("onboarding.back")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void finishFlow()}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-full px-9 py-3.5",
                          "text-[15px] font-medium tracking-wide text-white",
                          "bg-[var(--app-text)] shadow-lg transition duration-300",
                          "hover:scale-[1.02] hover:opacity-[0.92] active:scale-[0.99]",
                          "dark:text-[var(--app-bg)]",
                        )}
                      >
                        <Sparkles className="h-4 w-4 opacity-80" strokeWidth={1.75} aria-hidden />
                        {t("onboarding.goHome")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

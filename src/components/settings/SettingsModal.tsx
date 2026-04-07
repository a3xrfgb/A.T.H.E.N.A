import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  Code2,
  Cpu,
  HeartHandshake,
  Info,
  Palette,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { cn } from "../../lib/utils";
import { SettingsAppearancePanel } from "./SettingsAppearancePanel";
import { SettingsDeveloperPanel } from "./SettingsDeveloperPanel";
import { SettingsGeneralPanel } from "./SettingsGeneralPanel";
import { SettingsAboutPanel } from "./SettingsAboutPanel";
import { SettingsHardwarePanel } from "./SettingsHardwarePanel";
import { SettingsSupportPanel } from "./SettingsSupportPanel";
import { SettingsProfilePanel } from "./SettingsProfilePanel";
import { SettingsSecurityPanel } from "./SettingsSecurityPanel";
import { SettingsRuntimePanel } from "./SettingsRuntimePanel";
import {
  defaultSettingsModalSize,
  SettingsModalResizeHandles,
} from "./SettingsModalResizeHandles";
import { settingsNavActiveBeforeGradient } from "./settingsGradients";
import { AthenaLogo } from "../layout/AthenaLogo";

/** Active settings nav: four-color horizontal sweep (same motion as settings switches). */
const NAV_ACTIVE = cn(
  "relative overflow-hidden text-white shadow-sm",
  "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:content-['']",
  settingsNavActiveBeforeGradient,
);

type SettingsNavId =
  | "general"
  | "appearance"
  | "developer"
  | "profile"
  | "security"
  | "runtime"
  | "hardware"
  | "support"
  | "about";

const ALL_SETTINGS_NAV_IDS: SettingsNavId[] = [
  "general",
  "appearance",
  "profile",
  "runtime",
  "security",
  "developer",
  "hardware",
  "support",
  "about",
];

function isSettingsNavId(s: string): s is SettingsNavId {
  return (ALL_SETTINGS_NAV_IDS as readonly string[]).includes(s);
}

const SETTINGS_DEF: {
  id: SettingsNavId;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: "general", icon: Settings },
  { id: "appearance", icon: Palette },
  { id: "profile", icon: UserRound },
  { id: "runtime", icon: Activity },
  { id: "security", icon: ShieldCheck },
  { id: "developer", icon: Code2 },
];

function NavSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div
        className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--settings-nav-section)" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors",
        active
          ? NAV_ACTIVE
          : "text-[var(--settings-nav-text)] hover:bg-[var(--settings-nav-hover)]",
      )}
    >
      <Icon
        className="relative z-10 h-[18px] w-[18px] shrink-0 opacity-90"
        strokeWidth={2}
      />
      <span className="relative z-10 truncate">{label}</span>
    </button>
  );
}

/** Three-bar SMIL strip — black in light mode, white in dark (`currentColor`). */
function SettingsHeaderMotionStrip() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 14 32 4"
      fill="currentColor"
      preserveAspectRatio="none"
      className="pointer-events-none h-3 w-[4.75rem] shrink-0 text-black dark:text-white"
      aria-hidden
    >
      <path opacity={0.8} d="M2 14 V18 H6 V14z">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 24 0; 0 0"
          dur="2s"
          begin="0s"
          repeatCount="indefinite"
          keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
          calcMode="spline"
        />
      </path>
      <path opacity={0.5} d="M0 14 V18 H8 V14z">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 24 0; 0 0"
          dur="2s"
          begin="0.1s"
          repeatCount="indefinite"
          keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
          calcMode="spline"
        />
      </path>
      <path opacity={0.25} d="M0 14 V18 H8 V14z">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 24 0; 0 0"
          dur="2s"
          begin="0.2s"
          repeatCount="indefinite"
          keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
          calcMode="spline"
        />
      </path>
    </svg>
  );
}

function SettingsSidebarBrand() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 px-2 pt-1">
      <AthenaLogo className="h-10 w-10 object-contain" alt="" />
      <p className="text-center text-[13px] font-semibold tracking-[0.22em] text-[var(--app-text)]">
        {t("settings.sidebarBrandName")}
      </p>
      <p className="max-w-[11.5rem] text-center text-[10px] leading-snug text-[var(--app-muted)]">
        {t("settings.sidebarBrandTagline")}
      </p>
    </div>
  );
}

function SettingsPanel({ id }: { id: SettingsNavId }) {
  switch (id) {
    case "general":
      return <SettingsGeneralPanel />;
    case "appearance":
      return <SettingsAppearancePanel />;
    case "developer":
      return <SettingsDeveloperPanel />;
    case "profile":
      return <SettingsProfilePanel />;
    case "security":
      return <SettingsSecurityPanel />;
    case "runtime":
      return <SettingsRuntimePanel />;
    case "hardware":
      return <SettingsHardwarePanel />;
    case "support":
      return <SettingsSupportPanel />;
    case "about":
      return <SettingsAboutPanel />;
    default:
      return null;
  }
}

/**
 * Settings shell with LM Studio–style left navigation (Settings + System).
 * Panels are placeholders until each section is implemented.
 */
export function SettingsModal() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const developerMode = useSettingsStore((s) => s.settings.developerMode);
  const [active, setActive] = useState<SettingsNavId>("general");
  const [modalSize, setModalSize] = useState(defaultSettingsModalSize);
  const appliedSettingsEntryRef = useRef(false);

  const settingsItems = useMemo(
    () =>
      SETTINGS_DEF.map((item) => ({
        ...item,
        label: t(`settings.nav.${item.id}`),
      })),
    [t],
  );
  const systemItems = useMemo(() => {
    const defs: {
      id: SettingsNavId;
      icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    }[] = [];
    if (developerMode) defs.push({ id: "hardware", icon: Cpu });
    defs.push({ id: "support", icon: HeartHandshake });
    defs.push({ id: "about", icon: Info });
    return defs.map((item) => ({
      ...item,
      label: t(`settings.nav.${item.id}`),
    }));
  }, [developerMode, t]);

  useEffect(() => {
    if (open) setModalSize(defaultSettingsModalSize());
  }, [open]);

  useEffect(() => {
    if (!developerMode && active === "hardware") {
      setActive("general");
    }
  }, [developerMode, active]);

  useEffect(() => {
    if (!open) {
      appliedSettingsEntryRef.current = false;
      return;
    }
    if (appliedSettingsEntryRef.current) return;
    appliedSettingsEntryRef.current = true;
    const entry = useUiStore.getState().settingsEntryNavId;
    useUiStore.getState().setSettingsEntryNavId(null);
    if (entry && isSettingsNavId(entry)) {
      setActive(entry);
    } else {
      setActive("general");
    }
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[500] bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed inset-0 z-[510] flex items-center justify-center p-4 outline-none",
            "pointer-events-none",
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">{t("settings.srTitle")}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("settings.srDesc")}
          </Dialog.Description>

          <div
            className={cn(
              "pointer-events-auto relative max-h-[min(90vh,900px)] max-w-[min(96vw,100%)] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]",
            )}
            style={{ width: modalSize.w, height: modalSize.h }}
          >
            <SettingsModalResizeHandles size={modalSize} onSizeChange={setModalSize} />
            <div className="absolute inset-2 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl">
              <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--app-border)] px-5 py-3.5">
                <h2 className="justify-self-start text-base font-semibold tracking-tight text-[var(--app-text)]">
                  {t("settings.title")}
                </h2>
                <div className="flex justify-center justify-self-center px-2">
                  <SettingsHeaderMotionStrip />
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="justify-self-end rounded-lg p-2 text-[var(--app-muted)] hover:bg-black/[0.06] hover:text-[var(--app-text)] dark:hover:bg-white/10"
                    aria-label={t("common.close")}
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </Dialog.Close>
              </header>

              <div className="flex min-h-0 min-w-0 flex-1">
                <nav
                  className="flex w-[min(240px,32vw)] min-h-0 shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]"
                  aria-label="Settings categories"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
                    <NavSection title={t("settings.navSettings")}>
                      {settingsItems.map((item) => (
                        <NavButton
                          key={item.id}
                          icon={item.icon}
                          label={item.label}
                          active={active === item.id}
                          onClick={() => setActive(item.id)}
                        />
                      ))}
                    </NavSection>
                    <NavSection title={t("settings.navSystem")}>
                      {systemItems.map((item) => (
                        <NavButton
                          key={item.id}
                          icon={item.icon}
                          label={item.label}
                          active={active === item.id}
                          onClick={() => setActive(item.id)}
                        />
                      ))}
                    </NavSection>
                  </div>
                  <div className="shrink-0 border-t border-[var(--app-border)]/70 px-2 pb-4 pt-3">
                    <SettingsSidebarBrand />
                  </div>
                </nav>

                <main
                  className={cn(
                    "min-h-0 min-w-0 flex-1 bg-[var(--app-surface)]",
                    active === "hardware" || active === "support"
                      ? "flex flex-col overflow-hidden"
                      : "overflow-y-auto",
                  )}
                >
                  <div
                    className={cn(
                      "mx-auto w-full min-w-0 max-w-[min(56rem,100%)]",
                      active === "hardware" || active === "support"
                        ? "flex h-full min-h-0 flex-1 flex-col"
                        : "",
                    )}
                  >
                    <SettingsPanel id={active} />
                  </div>
                </main>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

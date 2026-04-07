import * as Switch from "@radix-ui/react-switch";
import { Code2 } from "lucide-react";
import { useTranslation } from "../../i18n/I18nContext";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { settingsToggleGradientBg, settingsToggleOnLightBg } from "./settingsGradients";

const TOGGLE_ON = `${settingsToggleOnLightBg} ${settingsToggleGradientBg} dark:animate-settings-selection-gradient motion-reduce:dark:animate-none`;

export function SettingsDeveloperPanel() {
  const { t } = useTranslation();
  const developerMode = useSettingsStore((s) => s.settings.developerMode);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  return (
    <div className="px-8 py-10">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)]"
          aria-hidden
        >
          <Code2 className="h-5 w-5 text-[var(--app-muted)]" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
            {t("settings.developer.heading")}
          </h3>
          <p className="mt-1 max-w-lg text-sm text-[var(--app-muted)]">
            {t("settings.developer.lead")}
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-md">
        <div className="flex flex-col gap-2 border-b border-[var(--app-border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--app-text)]">
              {t("settings.developer.mode")}
            </p>
            <p className="text-xs text-[var(--app-muted)]">{t("settings.developer.modeHint")}</p>
          </div>
          <Switch.Root
            checked={developerMode}
            onCheckedChange={(c) => {
              void save({ developerMode: c }).catch((e) => pushToast(String(e), "error"));
            }}
            className={cn(
              "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent outline-none transition-colors",
              developerMode ? TOGGLE_ON : "bg-[var(--app-border)]",
            )}
          >
            <Switch.Thumb
              className={cn(
                "block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]",
              )}
            />
          </Switch.Root>
        </div>
      </div>
    </div>
  );
}

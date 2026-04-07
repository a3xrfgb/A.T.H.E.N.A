import * as Switch from "@radix-ui/react-switch";
import { useTranslation } from "../../i18n/I18nContext";
import { normalizeLang } from "../../i18n/messages";
import { FONT_STYLE_IDS, normalizeFontStyleId } from "../../lib/fontStyles";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { SettingsGlassSelect } from "./SettingsGlassSelect";
import { settingsToggleGradientBg, settingsToggleOnLightBg } from "./settingsGradients";

const TOGGLE_ON = `${settingsToggleOnLightBg} ${settingsToggleGradientBg} dark:animate-settings-selection-gradient motion-reduce:dark:animate-none`;

const THEME_VALUES = [
  "dark",
  "light",
  "system",
  "cream",
  "beige",
  "rose",
  "slate",
  "ocean",
  "forest",
] as const;

const WEIGHT_VALUES = ["normal", "bold"] as const;

const THINKING_VALUES = ["bubble", "block", "rotate", "wide"] as const;

export function SettingsAppearancePanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);
  const isEnglishUi = normalizeLang(settings.language) === "en";

  const onSave = (partial: Parameters<typeof save>[0]) => {
    void save(partial).catch((e) => pushToast(String(e), "error"));
  };

  return (
    <div className="px-8 py-10">
      <div className="max-w-lg space-y-8">
        <section>
          <label className="text-sm font-semibold text-[var(--app-text)]" htmlFor="settings-theme">
            {t("settings.appearance.theme")}
          </label>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.appearance.themeHint")}
          </p>
          <SettingsGlassSelect
            id="settings-theme"
            className="mt-2 w-full"
            triggerClassName="px-3 py-2.5"
            value={settings.theme}
            onValueChange={(theme) => onSave({ theme })}
            options={THEME_VALUES.map((v) => ({
              value: v,
              label: t(`theme.${v}`),
            }))}
          />
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text)]">
                {t("settings.appearance.fontSize")}
              </p>
              <p className="text-xs text-[var(--app-muted)]">
                {t("settings.appearance.fontSizeHint")}
              </p>
            </div>
            <span className="tabular-nums text-sm text-[var(--app-muted)]">
              {Math.round(settings.fontSizeScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.35}
            step={0.05}
            className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--app-border)] accent-[#0080ff]"
            value={settings.fontSizeScale}
            onChange={(e) => onSave({ fontSizeScale: Number(e.target.value) })}
          />
        </section>

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="shrink-0 text-sm font-semibold text-[var(--app-text)]"
              htmlFor="settings-weight"
            >
              {t("settings.appearance.fontWeight")}
            </label>
            <SettingsGlassSelect
              id="settings-weight"
              className="min-w-[8.5rem] max-w-full shrink-0 sm:min-w-[10.25rem]"
              triggerClassName="px-2.5 py-2"
              value={settings.fontWeightPreset === "bold" ? "bold" : "normal"}
              onValueChange={(fontWeightPreset) =>
                onSave({ fontWeightPreset: fontWeightPreset as "normal" | "bold" })
              }
              options={WEIGHT_VALUES.map((w) => ({
                value: w,
                label: t(`fontWeight.${w}`),
              }))}
            />
          </div>
        </section>

        {isEnglishUi && (
          <section>
            <label
              className="text-sm font-semibold text-[var(--app-text)]"
              htmlFor="settings-font-style"
            >
              {t("settings.appearance.fontStyle")}
            </label>
            <p className="mt-0.5 text-xs text-[var(--app-muted)]">
              {t("settings.appearance.fontStyleHint")}
            </p>
            <SettingsGlassSelect
              id="settings-font-style"
              className="mt-2 w-full"
              triggerClassName="px-3 py-2.5"
              value={normalizeFontStyleId(settings.fontStyle)}
              onValueChange={(fontStyle) => onSave({ fontStyle })}
              options={FONT_STYLE_IDS.map((id) => ({
                value: id,
                label: t(`fontStyle.${id}`),
              }))}
            />
          </section>
        )}

        <section className="border-t border-[var(--app-border)] pt-8">
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {t("settings.appearance.homeSection")}
          </p>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.appearance.homeSectionHint")}
          </p>
          <div className="mt-4 space-y-4">
            {(
              [
                ["homeShowFlipClock", "settings.appearance.homeClock"] as const,
                ["homeShowInspiration", "settings.appearance.homeInspiration"] as const,
                ["homeShowStats", "settings.appearance.homeStats"] as const,
                ["homeCompactLayout", "settings.appearance.homeCompact"] as const,
              ] as const
            ).map(([key, labelKey]) => {
              const checked = Boolean(settings[key]);
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 border-b border-[var(--app-border)] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-medium text-[var(--app-text)]">{t(labelKey)}</p>
                  <Switch.Root
                    checked={checked}
                    onCheckedChange={(c) =>
                      onSave({ [key]: c } as Parameters<typeof save>[0])
                    }
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent outline-none transition-colors",
                      checked ? TOGGLE_ON : "bg-[var(--app-border)]",
                    )}
                  >
                    <Switch.Thumb
                      className={cn(
                        "block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]",
                      )}
                    />
                  </Switch.Root>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <p className="text-sm font-semibold text-[var(--app-text)]">
            {t("settings.appearance.thinkingStyle")}
          </p>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.appearance.thinkingHint")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {THINKING_VALUES.map((sty) => (
              <button
                key={sty}
                type="button"
                title={t(`settings.appearance.thinking.${sty}Hint`)}
                onClick={() => onSave({ thinkingStyle: sty })}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition",
                  settings.thinkingStyle === sty
                    ? "border-[#0080ff] bg-[#0080ff]/10 font-medium text-[var(--app-text)]"
                    : "border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-bg)]",
                )}
              >
                {t(`settings.appearance.thinking.${sty}`)}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, PanelRight, Shrink, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { ICONS } from "../../lib/icons";
import { useLockStore } from "../../store/lockStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../i18n/I18nContext";

const chromeBtn =
  "flex h-8 w-10 items-center justify-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-black/[0.06] hover:text-[var(--app-text)] dark:hover:bg-white/[0.08]";

export function TopBar({
  title,
  hasPin,
  maximized,
}: {
  title: string;
  hasPin: boolean;
  maximized: boolean;
}) {
  const { t } = useTranslation();
  const right = useUiStore((s) => s.rightPanelOpen);
  const setRight = useUiStore((s) => s.setRightPanel);
  const dark = useEffectiveDark();
  const locked = useLockStore((s) => s.locked);
  const setLocked = useLockStore((s) => s.setLocked);
  const barImg = cn("h-5 w-5", dark ? "brightness-0 invert" : "brightness-0");

  const [tauri, setTauri] = useState(false);
  useEffect(() => {
    setTauri(isTauri());
  }, []);

  const onMinimize = useCallback(() => {
    void getCurrentWindow().minimize();
  }, []);
  const onToggleMaximize = useCallback(() => {
    void getCurrentWindow().toggleMaximize();
  }, []);
  const onClose = useCallback(() => {
    void getCurrentWindow().close();
  }, []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 px-2 backdrop-blur sm:px-4">
      <div
        className="flex min-h-0 min-w-0 flex-1 cursor-default select-none items-center pr-2"
        data-tauri-drag-region
      >
        <h1 className="truncate text-sm font-medium text-[var(--app-text)]">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {hasPin && !locked && (
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"
            title={t("topBar.lockApp")}
            onClick={() => setLocked(true)}
          >
            <img src={ICONS.lockLocked} alt="" className={barImg} width={20} height={20} />
          </button>
        )}
        <button
          type="button"
          className="rounded-lg p-2 text-[var(--app-muted)] hover:bg-black/5 dark:hover:bg-white/10"
          title={t("topBar.toggleInspector")}
          onClick={() => setRight(!right)}
        >
          <PanelRight className="h-4 w-4" />
        </button>
        {tauri && (
          <div className="ml-1 flex items-center border-l border-[var(--app-border)] pl-1">
            <button
              type="button"
              className={chromeBtn}
              title={t("topBar.minimize")}
              onClick={onMinimize}
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={chromeBtn}
              title={maximized ? t("topBar.restore") : t("topBar.maximize")}
              onClick={onToggleMaximize}
            >
              {maximized ? (
                <Shrink className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <Square className="h-3 w-3" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              className={cn(
                chromeBtn,
                "hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400",
              )}
              title={t("topBar.close")}
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

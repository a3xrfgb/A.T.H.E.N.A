import { useEffect, useRef } from "react";
import { api } from "../lib/tauri";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";

/**
 * On startup, if enabled in settings, compares installed llama.cpp tag to GitHub latest and shows a banner when newer.
 * At most one banner per app session while notifications stay enabled.
 */
export function useRuntimeUpdateCheck() {
  const loaded = useSettingsStore((s) => s.loaded);
  const notify = useSettingsStore((s) => s.settings.runtimeNotifyUpdates);
  const showRuntimeUpdateBanner = useUiStore((s) => s.showRuntimeUpdateBanner);
  const sessionBannerShown = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    if (!notify) {
      sessionBannerShown.current = false;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const variant = useSettingsStore.getState().settings.runtimeVariant;
        const info = await api.getLlamaRuntimeInfo(variant);
        if (cancelled) return;
        if (!info.supported) return;
        if (info.updateAvailable && !sessionBannerShown.current) {
          sessionBannerShown.current = true;
          showRuntimeUpdateBanner(info.latestTag);
        }
      } catch {
        /* offline or rate limit — ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, notify, showRuntimeUpdateBanner]);
}

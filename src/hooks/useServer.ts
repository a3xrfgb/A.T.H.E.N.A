import { useCallback } from "react";
import { translateInstant } from "../i18n/messages";
import { api } from "../lib/tauri";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";

export function useServerSync() {
  const settings = useSettingsStore((s) => s.settings);
  const pushToast = useUiStore((s) => s.pushToast);

  const sync = useCallback(async () => {
    if (!settings.serverEnabled) {
      await api.stopServer();
      return;
    }
    try {
      await api.startServer(
        settings.serverPort,
        settings.apiKey?.trim() ? settings.apiKey : null,
      );
      pushToast(translateInstant(settings.language, "server.localStarted"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  }, [settings.apiKey, settings.serverEnabled, settings.serverPort, pushToast]);

  return { sync };
}

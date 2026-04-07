import { useEffect, useState } from "react";
import { getEffectiveDark, useSettingsStore } from "../store/settingsStore";

export function useEffectiveDark(): boolean {
  const theme = useSettingsStore((s) => s.settings.theme);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setTick((t) => t + 1);
      useSettingsStore.getState().applyTheme();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    useSettingsStore.getState().applyTheme();
  }, [theme, tick]);

  return getEffectiveDark(theme);
}

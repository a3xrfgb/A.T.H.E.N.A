import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSettingsStore } from "../store/settingsStore";
import { interpolate } from "./core";
import { en } from "./flat/en";
import { getMessages, setDocumentDirection } from "./messages";

type I18nValue = {
  t: (key: string, vars?: Record<string, string | number | undefined>) => string;
  locale: string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);

  const dict = useMemo(() => getMessages(language), [language]);

  useEffect(() => {
    setDocumentDirection(language);
  }, [language]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number | undefined>) => {
      const raw = dict[key] ?? en[key] ?? key;
      return interpolate(raw, vars);
    },
    [dict],
  );

  const value = useMemo(
    () => ({ t, locale: language || "en" }),
    [t, language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return ctx;
}

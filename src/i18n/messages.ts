import { en } from "./flat/en";
import { interpolate } from "./core";
import { LOCALE_PATCHES } from "./locales";

const RTL = new Set(["ar", "ur"]);

/** BCP-47 primary tag; settings store uses values like `zh`, `en`. */
export function normalizeLang(code: string): string {
  if (!code) return "en";
  const base = code.trim().split("-")[0];
  return base.toLowerCase();
}

export function getMessages(lang: string): Record<string, string> {
  const n = normalizeLang(lang);
  const patch = LOCALE_PATCHES[n];
  if (!patch) return { ...en };
  return { ...en, ...patch };
}

export function setDocumentDirection(lang: string): void {
  document.documentElement.dir = RTL.has(normalizeLang(lang)) ? "rtl" : "ltr";
}

/** For non-React code (hooks, listeners) — pass current language from settings. */
export function translateInstant(
  lang: string,
  key: string,
  vars?: Record<string, string | number | undefined>,
): string {
  const dict = getMessages(lang);
  const raw = dict[key] ?? en[key] ?? key;
  return interpolate(raw, vars);
}

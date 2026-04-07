import { normalizeLang } from "../i18n/messages";

const FONT_LINK_ID = "athena-ui-font-style";

/** Stored in settings / Rust (`snake_case` ids). */
export const FONT_STYLE_IDS = [
  "inter",
  "roboto",
  "open_sans",
  "lato",
  "poppins",
  "montserrat",
  "merriweather",
  "nunito",
  "source_sans_3",
  "playfair_display",
] as const;

export type FontStyleId = (typeof FONT_STYLE_IDS)[number];

const DISPLAY_NAMES: Record<FontStyleId, string> = {
  inter: "Inter",
  roboto: "Roboto",
  open_sans: "Open Sans",
  lato: "Lato",
  poppins: "Poppins",
  montserrat: "Montserrat",
  merriweather: "Merriweather",
  nunito: "Nunito",
  source_sans_3: "Source Sans 3",
  playfair_display: "Playfair Display",
};

/** Google Fonts CSS2 `family=` parameter (weights 400–700 for UI). `undefined` = bundled / system only. */
const GOOGLE_QUERY: Partial<Record<FontStyleId, string>> = {
  roboto: "Roboto:wght@400;500;600;700",
  open_sans: "Open+Sans:wght@400;500;600;700",
  lato: "Lato:wght@400;700",
  poppins: "Poppins:wght@400;500;600;700",
  montserrat: "Montserrat:wght@400;500;600;700",
  merriweather: "Merriweather:wght@400;700",
  nunito: "Nunito:wght@400;500;600;700",
  source_sans_3: "Source+Sans+3:wght@400;500;600;700",
  playfair_display: "Playfair+Display:wght@400;500;600;700",
};

function cssPrimaryFontToken(displayName: string): string {
  return displayName.includes(" ") ? `'${displayName.replace(/'/g, "\\'")}'` : displayName;
}

export function isValidFontStyleId(id: string): id is FontStyleId {
  return (FONT_STYLE_IDS as readonly string[]).includes(id);
}

export function normalizeFontStyleId(id: string | undefined | null): FontStyleId {
  if (id && isValidFontStyleId(id)) return id;
  return "inter";
}

function syncGoogleFontLink(id: FontStyleId): void {
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  const q = GOOGLE_QUERY[id];
  if (!q) {
    existing?.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
  if (existing) {
    if (existing.href === href) return;
    existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * When UI language is English, sets `--font-ui-primary` for Tailwind `font-sans` and loads Google Font if needed.
 * For non-English languages, clears the variable so the default Inter stack is used.
 */
export function applyAppFontStyle(language: string, fontStyleId: string): void {
  const root = document.documentElement;
  const isEn = normalizeLang(language) === "en";
  if (!isEn) {
    root.style.removeProperty("--font-ui-primary");
    document.getElementById(FONT_LINK_ID)?.remove();
    return;
  }

  const id = normalizeFontStyleId(fontStyleId);
  const display = DISPLAY_NAMES[id];
  root.style.setProperty("--font-ui-primary", cssPrimaryFontToken(display));
  syncGoogleFontLink(id);
}

export function fontStyleLabelKey(id: FontStyleId): string {
  return `fontStyle.${id}`;
}

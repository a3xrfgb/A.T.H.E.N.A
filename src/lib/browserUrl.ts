/** Default destinations for the in-app browser (home, new tab, empty omnibox). */
export const BROWSER_HOME_URLS = [
  "https://openai.com/",
  "https://ai.com/",
] as const;

function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** One shuffled order per page load — new tabs cycle through this ring. */
let shuffledHomeRing: string[] | null = null;

function ensureShuffledRing(): string[] {
  if (!shuffledHomeRing) {
    shuffledHomeRing = shuffleArray(BROWSER_HOME_URLS);
  }
  return shuffledHomeRing;
}

/** Random pick from the default set (e.g. first tab, home after close-all, empty resolve). */
export function getBrowserDefaultHome(): string {
  const ring = ensureShuffledRing();
  return ring[Math.floor(Math.random() * ring.length)]!;
}

/** Cycle through the shuffled ring (0 = first new tab, 1 = second, …). */
export function getBrowserHomeByRotation(step: number): string {
  const ring = ensureShuffledRing();
  const n = ring.length;
  return ring[((step % n) + n) % n]!;
}

/** Normalize user input into an http(s) URL, or null if invalid / unsafe. */
export function normalizeBrowserUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return getBrowserDefaultHome();

  let candidate = t;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Omnibox: URLs and hostnames navigate; plain phrases open Google search (like major browsers).
 */
export function resolveBrowserInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return getBrowserDefaultHome();

  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    return normalizeBrowserUrl(t);
  }

  if (/\s/.test(t)) {
    return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
  }

  const localhostish =
    /^localhost(:\d+)?(\/|$)/i.test(t) ||
    /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(t);
  if (localhostish) {
    return normalizeBrowserUrl(t.includes("://") ? t : `https://${t}`);
  }

  if (!t.includes(".")) {
    return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
  }

  const asUrl = normalizeBrowserUrl(t);
  if (asUrl != null) return asUrl;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

/** Short label for a tab from a URL (hostname or “Search”). */
export function tabLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "www.google.com" && u.pathname.startsWith("/search")) {
      const q = u.searchParams.get("q");
      if (q) return q.length > 24 ? `${q.slice(0, 22)}…` : q;
    }
    return u.hostname.replace(/^www\./, "") || url.slice(0, 32);
  } catch {
    return url.slice(0, 24) || "…";
  }
}

import ePub, { type Book, type Rendition } from "epubjs";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

function useHtmlDarkClass(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** Renders an EPUB from a blob or asset URL (canvas document card). */
export function CanvasEpubViewer({ src }: { src: string }) {
  const dark = useHtmlDarkClass();
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    let book: Book | null = null;
    let rendition: Rendition | null = null;

    void (async () => {
      try {
        setErr(null);
        el.innerHTML = "";
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        if (cancelled || !el) return;
        book = ePub(buf);
        await book.ready;
        if (cancelled || !el) return;
        rendition = book.renderTo(el, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        if (dark && rendition.themes) {
          rendition.themes.register("canvas", {
            body: { background: "#161412", color: "#f5f2eb" },
            a: { color: "#fdba74" },
          });
          rendition.themes.select("canvas");
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        rendition?.destroy?.();
      } catch {
        /* ignore */
      }
      try {
        book?.destroy?.();
      } catch {
        /* ignore */
      }
      if (el) el.innerHTML = "";
    };
  }, [src, dark]);

  if (err) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-[var(--app-muted)]">
        {err}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={cn("h-full min-h-[200px] w-full", dark ? "bg-[#161412]" : "bg-[#faf8f5]")}
    />
  );
}

import { isTauri } from "@tauri-apps/api/core";
import { ArrowDownToLine, Copy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { useUiStore } from "../../store/uiStore";
import type { GalleryImage, ImageSourceKey } from "../../types/images";
import type { MidjourneyGalleryItem } from "../../types/midjourney";
import type { SoraGalleryItem } from "../../types/sora";

/** Prompt modal header (always dark glass): white silhouette */
const MONO_MODAL_BRAND_IMG = "h-6 w-6 shrink-0 brightness-0 invert";

const SORA_BRAND_ICON = "/icons/sora-icon.png";
const REVE_BRAND_ICON = "/icons/reve-icon.png";
const MIDJOURNEY_BRAND_ICON = "/icons/midjourney.svg";
/** Nano Banana (Google) — thesvg.org */
const NANO_BANANA_ICON = "https://thesvg.org/icons/nano-banana-google/default.svg";

const SOURCE_DEFS: Array<{
  key: ImageSourceKey;
  label: string;
  href: string;
  iconUrl: string;
}> = [
  {
    key: "nanoBanana",
    label: "Nano Banana",
    href: "https://youmind.com/nano-banana-pro-prompts",
    iconUrl: NANO_BANANA_ICON,
  },
  {
    key: "sora",
    label: "Sora",
    href: "https://huggingface.co/datasets/a3xrfgb/gpt-image-mega-4k",
    iconUrl: SORA_BRAND_ICON,
  },
  {
    key: "midjourney",
    label: "Midjourney",
    href: "https://huggingface.co/datasets/a3xrfgb/Midjourney_gallery/tree/main",
    iconUrl: MIDJOURNEY_BRAND_ICON,
  },
  {
    key: "reve",
    label: "Reve Art",
    href: "https://revart.org/explore",
    iconUrl: REVE_BRAND_ICON,
  },
];

function chipMonoBrandClass(effectiveDark: boolean) {
  return cn(
    "h-5 w-5 shrink-0 object-contain",
    effectiveDark ? "brightness-0 invert" : "brightness-0",
  );
}

/** Sora mascot PNG: light UI = dark logo; dark UI = white (invert). */
function soraChipIconClass(effectiveDark: boolean) {
  return cn("h-5 w-5 shrink-0 object-contain", effectiveDark && "invert");
}

/** Midjourney SVG: dark UI = white (invert). */
function midjourneyChipIconClass(effectiveDark: boolean) {
  return cn("h-5 w-5 shrink-0 object-contain", effectiveDark && "invert");
}

const SORA_PAGE_SIZE = 80;
const MIDJOURNEY_PAGE_SIZE = 80;
/** Nano catalog is paged from YouMind Open Lab reference JSON on GitHub (lazy-loaded per category). */
const NANO_PAGE_SIZE = 80;

/** Lightbox: target 170% of intrinsic size (70% bigger than original), then fit inside the frame. */
const LIGHTBOX_DISPLAY_RATIO = 1.7;

type FetchState = "idle" | "loading" | "done" | "error";

export function ImagesPanel() {
  const effectiveDark = useEffectiveDark();
  const pushToast = useUiStore((s) => s.pushToast);
  const [source, setSource] = useState<ImageSourceKey>("nanoBanana");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const lightboxFrameRef = useRef<HTMLDivElement>(null);
  const [lightboxFramePx, setLightboxFramePx] = useState({ w: 0, h: 0 });
  const [lightboxNatural, setLightboxNatural] = useState<{ w: number; h: number } | null>(null);

  const [soraItems, setSoraItems] = useState<SoraGalleryItem[]>([]);
  const [soraTotal, setSoraTotal] = useState(0);
  const [soraLoading, setSoraLoading] = useState(false);
  const [soraLoadingMore, setSoraLoadingMore] = useState(false);
  const [soraError, setSoraError] = useState<string | null>(null);
  type PromptModalState =
    | { mode: "sora"; item: SoraGalleryItem }
    | { mode: "gallery"; img: GalleryImage };
  const [promptModal, setPromptModal] = useState<PromptModalState | null>(null);
  const [soraPromptText, setSoraPromptText] = useState("");
  const [soraPromptLoading, setSoraPromptLoading] = useState(false);
  const soraLoadingMoreRef = useRef(false);
  /** Next offset for HF paging; updated before await to prevent duplicate page fetches. */
  const soraNextOffsetRef = useRef(0);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const [nanoItems, setNanoItems] = useState<GalleryImage[]>([]);
  const [nanoTotal, setNanoTotal] = useState(0);
  const [nanoLoading, setNanoLoading] = useState(false);
  const [nanoLoadingMore, setNanoLoadingMore] = useState(false);
  const [nanoError, setNanoError] = useState<string | null>(null);
  const nanoLoadingMoreRef = useRef(false);
  const nanoNextOffsetRef = useRef(0);

  const [mjvItems, setMjvItems] = useState<MidjourneyGalleryItem[]>([]);
  const [mjvTotal, setMjvTotal] = useState(0);
  const [mjvLoading, setMjvLoading] = useState(false);
  const [mjvLoadingMore, setMjvLoadingMore] = useState(false);
  const [mjvError, setMjvError] = useState<string | null>(null);
  const mjvLoadingMoreRef = useRef(false);
  const mjvNextOffsetRef = useRef(0);

  const imagesForView = useMemo(() => {
    if (source !== "reve") return [];
    return images.filter((img) => img.source === "reve");
  }, [images, source]);

  const webGridImages = useMemo((): GalleryImage[] => {
    if (source === "reve") return imagesForView;
    if (source === "nanoBanana") return nanoItems;
    return [];
  }, [source, imagesForView, nanoItems]);

  const webGalleryRowKey = (img: GalleryImage) =>
    img.title ? `${img.source}-${img.title}` : `${img.source}-${img.src}`;

  const mergeSoraItemsDeduped = useCallback((prev: SoraGalleryItem[], batch: SoraGalleryItem[]) => {
    const seen = new Set(prev.map((i) => i.imageUrl));
    const next = [...prev];
    for (const item of batch) {
      if (!seen.has(item.imageUrl)) {
        seen.add(item.imageUrl);
        next.push(item);
      }
    }
    return next;
  }, []);

  const mergeMjvItemsDeduped = useCallback((prev: MidjourneyGalleryItem[], batch: MidjourneyGalleryItem[]) => {
    const seen = new Set(prev.map((i) => i.imageUrl));
    const next = [...prev];
    for (const item of batch) {
      if (!seen.has(item.imageUrl)) {
        seen.add(item.imageUrl);
        next.push(item);
      }
    }
    return next;
  }, []);

  const mergeNanoItemsDeduped = useCallback((prev: GalleryImage[], batch: GalleryImage[]) => {
    const seen = new Set(prev.map((i) => webGalleryRowKey(i)));
    const next = [...prev];
    for (const item of batch) {
      const k = webGalleryRowKey(item);
      if (!seen.has(k)) {
        seen.add(k);
        next.push(item);
      }
    }
    return next;
  }, []);

  const onDownloadImage = async (url: string) => {
    if (downloadingUrl) return;
    setDownloadingUrl(url);
    try {
      if (isTauri()) {
        await api.downloadImageToDownloads(url);
        pushToast("Saved to your Downloads folder", "success");
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        pushToast("Opened image in browser (use Save as)", "info");
      }
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setDownloadingUrl(null);
    }
  };

  useEffect(() => {
    setLightboxNatural(null);
  }, [lightbox?.src]);

  useEffect(() => {
    if (!lightbox) return;
    const el = lightboxFrameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setLightboxFramePx({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [lightbox]);

  const lightboxImgSize = useMemo(() => {
    if (!lightboxNatural || lightboxFramePx.w < 8 || lightboxFramePx.h < 8) return null;
    const targetW = lightboxNatural.w * LIGHTBOX_DISPLAY_RATIO;
    const targetH = lightboxNatural.h * LIGHTBOX_DISPLAY_RATIO;
    const scale = Math.min(1, lightboxFramePx.w / targetW, lightboxFramePx.h / targetH);
    return {
      width: targetW * scale,
      height: targetH * scale,
    };
  }, [lightboxNatural, lightboxFramePx]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  useEffect(() => {
    if (source !== "reve") return;
    let cancelled = false;
    const run = async () => {
      setFetchState("loading");
      setError(null);
      try {
        const res = await api.fetchGalleryImages("reve", 200);
        if (!cancelled) {
          setImages(res);
          setFetchState(res.length ? "done" : "error");
          setError(
            res.length
              ? null
              : "Could not extract image thumbnails from this site (it may be loaded dynamically).",
          );
        }
      } catch (e) {
        if (cancelled) return;
        setFetchState("error");
        setError(String(e));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source !== "nanoBanana") return;
    let cancelled = false;
    setNanoLoading(true);
    setNanoError(null);
    setNanoItems([]);
    setNanoTotal(0);
    nanoLoadingMoreRef.current = false;
    nanoNextOffsetRef.current = 0;
    void (async () => {
      try {
        const { items, total } = await api.fetchNanoBananaPage(0, NANO_PAGE_SIZE);
        if (!cancelled) {
          const deduped = mergeNanoItemsDeduped([], items);
          setNanoItems(deduped);
          setNanoTotal(total);
          nanoNextOffsetRef.current = items.length;
          setNanoLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setNanoError(String(e));
          setNanoLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, mergeNanoItemsDeduped]);

  useEffect(() => {
    if (source !== "sora") return;
    let cancelled = false;
    setSoraLoading(true);
    setSoraError(null);
    setSoraItems([]);
    setSoraTotal(0);
    soraLoadingMoreRef.current = false;
    soraNextOffsetRef.current = 0;
    void (async () => {
      try {
        const { items, total } = await api.fetchSoraGalleryPage(0, SORA_PAGE_SIZE);
        if (!cancelled) {
          const deduped = mergeSoraItemsDeduped([], items);
          setSoraItems(deduped);
          setSoraTotal(total);
          soraNextOffsetRef.current = deduped.length;
          setSoraLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setSoraError(String(e));
          setSoraLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, mergeSoraItemsDeduped]);

  useEffect(() => {
    if (source !== "midjourney") return;
    let cancelled = false;
    setMjvLoading(true);
    setMjvError(null);
    setMjvItems([]);
    setMjvTotal(0);
    mjvLoadingMoreRef.current = false;
    mjvNextOffsetRef.current = 0;
    void (async () => {
      try {
        const { items, total } = await api.fetchMidjourneyGalleryPage(0, MIDJOURNEY_PAGE_SIZE);
        if (!cancelled) {
          const deduped = mergeMjvItemsDeduped([], items);
          setMjvItems(deduped);
          setMjvTotal(total);
          mjvNextOffsetRef.current = deduped.length;
          setMjvLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setMjvError(String(e));
          setMjvLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, mergeMjvItemsDeduped]);

  const loadMoreSora = useCallback(async () => {
    if (source !== "sora" || soraLoadingMoreRef.current || soraLoading) return;
    if (soraItems.length === 0) return;
    const offset = soraNextOffsetRef.current;
    if (soraTotal > 0 && offset >= soraTotal) return;
    // Reserve the next slice so a second scroll tick cannot request the same offset twice.
    soraNextOffsetRef.current = offset + SORA_PAGE_SIZE;
    soraLoadingMoreRef.current = true;
    setSoraLoadingMore(true);
    try {
      const { items } = await api.fetchSoraGalleryPage(offset, SORA_PAGE_SIZE);
      soraNextOffsetRef.current = offset + items.length;
      if (items.length === 0) return;
      setSoraItems((prev) => mergeSoraItemsDeduped(prev, items));
    } catch (e) {
      soraNextOffsetRef.current = offset;
      pushToast(String(e), "error");
    } finally {
      soraLoadingMoreRef.current = false;
      setSoraLoadingMore(false);
    }
  }, [source, soraLoading, soraItems.length, soraTotal, pushToast, mergeSoraItemsDeduped]);

  const loadMoreMidjourney = useCallback(async () => {
    if (source !== "midjourney" || mjvLoadingMoreRef.current || mjvLoading) return;
    if (mjvItems.length === 0) return;
    const offset = mjvNextOffsetRef.current;
    if (mjvTotal > 0 && offset >= mjvTotal) return;
    mjvNextOffsetRef.current = offset + MIDJOURNEY_PAGE_SIZE;
    mjvLoadingMoreRef.current = true;
    setMjvLoadingMore(true);
    try {
      const { items } = await api.fetchMidjourneyGalleryPage(offset, MIDJOURNEY_PAGE_SIZE);
      mjvNextOffsetRef.current = offset + items.length;
      if (items.length === 0) return;
      setMjvItems((prev) => mergeMjvItemsDeduped(prev, items));
    } catch (e) {
      mjvNextOffsetRef.current = offset;
      pushToast(String(e), "error");
    } finally {
      mjvLoadingMoreRef.current = false;
      setMjvLoadingMore(false);
    }
  }, [source, mjvLoading, mjvItems.length, mjvTotal, pushToast, mergeMjvItemsDeduped]);

  const loadMoreNano = useCallback(async () => {
    if (source !== "nanoBanana" || nanoLoadingMoreRef.current || nanoLoading) return;
    if (nanoItems.length === 0) return;
    const offset = nanoNextOffsetRef.current;
    if (nanoTotal > 0 && offset >= nanoTotal) return;
    nanoLoadingMoreRef.current = true;
    setNanoLoadingMore(true);
    try {
      const { items } = await api.fetchNanoBananaPage(offset, NANO_PAGE_SIZE);
      if (items.length === 0) {
        nanoNextOffsetRef.current = offset;
        return;
      }
      nanoNextOffsetRef.current = offset + items.length;
      setNanoItems((prev) => mergeNanoItemsDeduped(prev, items));
    } catch (e) {
      nanoNextOffsetRef.current = offset;
      pushToast(String(e), "error");
    } finally {
      nanoLoadingMoreRef.current = false;
      setNanoLoadingMore(false);
    }
  }, [source, nanoLoading, nanoItems.length, nanoTotal, pushToast, mergeNanoItemsDeduped]);

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight >= 480) return;

      if (source === "sora") {
        if (soraLoading || soraLoadingMoreRef.current) return;
        if (soraItems.length >= soraTotal && soraTotal > 0) return;
        void loadMoreSora();
      } else if (source === "midjourney") {
        if (mjvLoading || mjvLoadingMoreRef.current) return;
        if (mjvItems.length >= mjvTotal && mjvTotal > 0) return;
        void loadMoreMidjourney();
      } else if (source === "nanoBanana") {
        if (nanoLoading || nanoLoadingMoreRef.current) return;
        if (nanoItems.length >= nanoTotal && nanoTotal > 0) return;
        void loadMoreNano();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [
    source,
    soraLoading,
    soraItems.length,
    soraTotal,
    loadMoreSora,
    mjvLoading,
    mjvItems.length,
    mjvTotal,
    loadMoreMidjourney,
    nanoLoading,
    nanoItems.length,
    nanoTotal,
    loadMoreNano,
  ]);

  useEffect(() => {
    if (!promptModal || promptModal.mode !== "sora") {
      setSoraPromptText("");
      setSoraPromptLoading(false);
      return;
    }
    const { item } = promptModal;
    let cancelled = false;
    setSoraPromptLoading(true);
    setSoraPromptText("");
    void api
      .fetchSoraPrompt(item.promptUrl)
      .then((text) => {
        if (!cancelled) {
          setSoraPromptText(text);
          setSoraPromptLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSoraPromptText(String(e));
          setSoraPromptLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [promptModal]);

  useEffect(() => {
    if (!promptModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPromptModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promptModal]);

  const openSource = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const overlayPromptBody =
    promptModal?.mode === "sora"
      ? soraPromptLoading
        ? "Loading prompt…"
        : soraPromptText || "—"
      : promptModal?.mode === "gallery"
        ? (promptModal.img.prompt?.trim() || "—")
        : "—";

  const copyOverlayPrompt = async () => {
    const text =
      promptModal?.mode === "sora"
        ? soraPromptText
        : promptModal?.mode === "gallery"
          ? promptModal.img.prompt?.trim() ?? ""
          : "";
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      pushToast("Prompt copied", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  const downloadBtnClass =
    "p-0.5 text-[var(--app-text)]/75 transition hover:text-[var(--app-text)] dark:text-white/75 dark:hover:text-white [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.45))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.85))] disabled:opacity-40";

  const downloadIconGridCls = "h-[9px] w-[9px]";
  const downloadIconOverlayCls = "h-[10.5px] w-[10.5px]";

  const showReveLoading = source === "reve" && fetchState === "loading";
  const showNanoLoading = source === "nanoBanana" && nanoLoading && nanoItems.length === 0;
  const showSoraLoading = source === "sora" && soraLoading && soraItems.length === 0;
  const showMidjourneyLoading = source === "midjourney" && mjvLoading && mjvItems.length === 0;

  return (
    <div
      ref={scrollRootRef}
      className="flex h-full flex-col overflow-y-auto bg-[var(--app-bg)] p-6 text-[var(--app-text)]"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Gallery</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {SOURCE_DEFS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
                source === s.key
                  ? "border-accent bg-accent/10 text-[var(--app-text)]"
                  : "border-[var(--app-border)] bg-white/0 text-[var(--app-muted)] hover:bg-black/[0.04] dark:hover:bg-white/5",
              )}
              onClick={() => setSource(s.key)}
            >
              <>
                <img
                  src={s.iconUrl}
                  alt=""
                  width={20}
                  height={20}
                  className={
                    s.key === "nanoBanana"
                      ? "h-5 w-5 shrink-0 object-contain"
                      : s.key === "midjourney"
                        ? midjourneyChipIconClass(effectiveDark)
                        : s.key === "sora"
                          ? soraChipIconClass(effectiveDark)
                          : chipMonoBrandClass(effectiveDark)
                  }
                  draggable={false}
                />
                <span>{s.label}</span>
              </>
            </button>
          ))}
        </div>
      </div>

      {source === "sora" && soraTotal > 0 && !soraLoading && (
        <p className="mb-3 text-xs text-[var(--app-muted)]">
          {soraItems.length.toLocaleString()} of {soraTotal.toLocaleString()} images — scroll to load more. Prompts load when you open an image.
        </p>
      )}

      {source === "midjourney" && mjvTotal > 0 && !mjvLoading && (
        <p className="mb-3 text-xs text-[var(--app-muted)]">
          {mjvItems.length.toLocaleString()} of {mjvTotal.toLocaleString()} images — scroll to load more. From{" "}
          <a
            className="underline decoration-[var(--app-border)] underline-offset-2 hover:text-[var(--app-text)]"
            href="https://huggingface.co/datasets/a3xrfgb/Midjourney_gallery"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hugging Face (Midjourney_gallery)
          </a>
          .
        </p>
      )}

      {source === "nanoBanana" && nanoTotal > 0 && !nanoLoading && (
        <p className="mb-3 text-xs text-[var(--app-muted)]">
          {nanoItems.length.toLocaleString()} of {nanoTotal.toLocaleString()} prompts — scroll to load more. Catalog from{" "}
          <a
            className="underline decoration-[var(--app-border)] underline-offset-2 hover:text-[var(--app-text)]"
            href="https://github.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill/tree/main/references"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouMind Open Lab (GitHub)
          </a>
          .
        </p>
      )}

      {showReveLoading && (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--app-muted)]">
          Loading images…
        </div>
      )}

      {showNanoLoading && (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--app-muted)]">
          Loading Nano Banana catalog (first batch may fetch a large category from GitHub)…
        </div>
      )}

      {showSoraLoading && (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--app-muted)]">
          Loading Sora gallery (indexing dataset)…
        </div>
      )}

      {showMidjourneyLoading && (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--app-muted)]">
          Loading Midjourney gallery (indexing dataset)…
        </div>
      )}

      {source === "reve" && fetchState !== "loading" && error && imagesForView.length === 0 && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
          <div className="font-medium text-[var(--app-text)]">No thumbnails extracted</div>
          <div className="mt-2">
            The site likely renders the gallery dynamically. You can open the page in your browser:
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOURCE_DEFS.filter((s) => s.key !== "sora").map((s) => (
              <button
                key={s.key}
                type="button"
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5"
                onClick={() => openSource(s.href)}
              >
                Open {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {source === "sora" && !soraLoading && soraError && soraItems.length === 0 && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
          <div className="font-medium text-[var(--app-text)]">Could not load Sora gallery</div>
          <div className="mt-2">{soraError}</div>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5"
            onClick={() => openSource(SOURCE_DEFS.find((s) => s.key === "sora")!.href)}
          >
            Open dataset on Hugging Face
          </button>
        </div>
      )}

      {source === "midjourney" && !mjvLoading && mjvError && mjvItems.length === 0 && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
          <div className="font-medium text-[var(--app-text)]">Could not load Midjourney gallery</div>
          <div className="mt-2">{mjvError}</div>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5"
            onClick={() => openSource(SOURCE_DEFS.find((s) => s.key === "midjourney")!.href)}
          >
            Open dataset on Hugging Face
          </button>
        </div>
      )}

      {source !== "sora" && source !== "midjourney" && webGridImages.length > 0 && (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
          {webGridImages.map((img) => (
            <div
              key={webGalleryRowKey(img)}
              className="group relative mb-3 w-full break-inside-avoid rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                className="block w-full p-0 text-left"
                onClick={() => {
                  const p = img.prompt?.trim();
                  if (p) setPromptModal({ mode: "gallery", img });
                  else setLightbox(img);
                }}
                aria-label={img.prompt?.trim() ? "View image and prompt" : "View image"}
              >
                <img
                  src={img.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="block w-full rounded-xl"
                />
              </button>
              <button
                type="button"
                className={cn("absolute bottom-1.5 right-1.5", downloadBtnClass)}
                aria-label="Download image"
                disabled={downloadingUrl === img.src}
                onClick={(e) => {
                  e.stopPropagation();
                  void onDownloadImage(img.src);
                }}
              >
                <ArrowDownToLine className={downloadIconGridCls} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {source === "sora" && soraItems.length > 0 && (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
          {soraItems.map((item) => (
            <div
              key={item.imageUrl}
              className="group relative mb-3 w-full break-inside-avoid rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                className="block w-full p-0 text-left"
                onClick={() => setPromptModal({ mode: "sora", item })}
                aria-label="View image and prompt"
              >
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="block w-full rounded-xl"
                />
              </button>
              <button
                type="button"
                className={cn("absolute bottom-1.5 right-1.5", downloadBtnClass)}
                aria-label="Download image"
                disabled={downloadingUrl === item.imageUrl}
                onClick={(e) => {
                  e.stopPropagation();
                  void onDownloadImage(item.imageUrl);
                }}
              >
                <ArrowDownToLine className={downloadIconGridCls} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {source === "midjourney" && mjvItems.length > 0 && (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6">
          {mjvItems.map((item) => (
            <div
              key={item.imageUrl}
              className="group relative mb-3 w-full break-inside-avoid rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                type="button"
                className="block w-full p-0 text-left"
                onClick={() =>
                  setLightbox({
                    src: item.imageUrl,
                    source: "midjourney",
                  })
                }
                aria-label="View image"
              >
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="block w-full rounded-xl"
                />
              </button>
              <button
                type="button"
                className={cn("absolute bottom-1.5 right-1.5", downloadBtnClass)}
                aria-label="Download image"
                disabled={downloadingUrl === item.imageUrl}
                onClick={(e) => {
                  e.stopPropagation();
                  void onDownloadImage(item.imageUrl);
                }}
              >
                <ArrowDownToLine className={downloadIconGridCls} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {source === "sora" && soraLoadingMore && (
        <div className="py-6 text-center text-sm text-[var(--app-muted)]">Loading more…</div>
      )}

      {source === "midjourney" && mjvLoadingMore && (
        <div className="py-6 text-center text-sm text-[var(--app-muted)]">Loading more…</div>
      )}

      {source === "nanoBanana" && nanoLoadingMore && (
        <div className="py-6 text-center text-sm text-[var(--app-muted)]">Loading more…</div>
      )}

      {source === "nanoBanana" && !nanoLoading && nanoError && nanoItems.length === 0 && (
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
          <div className="font-medium text-[var(--app-text)]">Could not load Nano Banana catalog</div>
          <div className="mt-2">{nanoError}</div>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5"
            onClick={() => openSource(SOURCE_DEFS.find((s) => s.key === "nanoBanana")!.href)}
          >
            Open on YouMind
          </button>
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[200]"
        >
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-md"
            onClick={() => setLightbox(null)}
          />
          <button
            type="button"
            className="absolute right-4 top-4 z-[201] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
            <div
              ref={lightboxFrameRef}
              role="presentation"
              className="relative grid h-[clamp(240px,62vh,min(92vh,1200px))] w-[clamp(280px,62vw,min(96vw,2000px))] min-h-0 min-w-0 place-items-center pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative inline-flex max-h-full max-w-full items-center justify-center leading-none">
                <img
                  src={lightbox.src}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={cn(
                    "pointer-events-auto block align-middle",
                    lightboxImgSize ? "h-auto max-h-none w-auto max-w-none" : "max-h-full max-w-full object-contain",
                  )}
                  style={
                    lightboxImgSize
                      ? {
                          width: lightboxImgSize.width,
                          height: lightboxImgSize.height,
                        }
                      : undefined
                  }
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setLightboxNatural({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                />
                <button
                  type="button"
                  className={cn(
                    "pointer-events-auto absolute bottom-1.5 right-1.5 z-[201]",
                    downloadBtnClass,
                    "text-white/90 hover:text-white",
                  )}
                  aria-label="Download image"
                  disabled={downloadingUrl === lightbox.src}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDownloadImage(lightbox.src);
                  }}
                >
                  <ArrowDownToLine className={downloadIconOverlayCls} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {promptModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image and prompt"
          className="fixed inset-0 z-[200]"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={() => setPromptModal(null)}
          />
          <button
            type="button"
            className="absolute right-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-lg backdrop-blur-md transition hover:bg-black/50"
            aria-label="Close"
            onClick={() => setPromptModal(null)}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute inset-0 z-[205] flex h-full min-h-0 w-full items-center justify-center overflow-y-auto px-4 py-6 pt-16 pb-12 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8">
            <div className="pointer-events-auto inline-flex max-w-full flex-col items-start gap-2.5 lg:flex-row lg:gap-3">
              <div className="relative shrink-0">
                <div className="relative inline-flex max-h-[min(85vh,1200px)] max-w-[min(92vw,calc(100vw-2.5rem))] items-center justify-center leading-none lg:max-w-[min(72vw,1100px)]">
                  <img
                    src={promptModal.mode === "sora" ? promptModal.item.imageUrl : promptModal.img.src}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="pointer-events-auto block max-h-[min(85vh,1200px)] w-auto max-w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                  />
                  <button
                    type="button"
                    className={cn(
                      "pointer-events-auto absolute bottom-2 right-2 z-[1]",
                      downloadBtnClass,
                      "text-white/90 hover:text-white",
                    )}
                    aria-label="Download image"
                    disabled={
                      downloadingUrl ===
                      (promptModal.mode === "sora" ? promptModal.item.imageUrl : promptModal.img.src)
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDownloadImage(
                        promptModal.mode === "sora" ? promptModal.item.imageUrl : promptModal.img.src,
                      );
                    }}
                  >
                    <ArrowDownToLine className={downloadIconOverlayCls} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "flex w-full shrink-0 flex-col rounded-2xl border border-white/20",
                  "bg-white/[0.07] shadow-[0_8px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150",
                  "dark:bg-black/25",
                  "max-h-[min(85vh,900px)] min-h-0 w-full lg:w-[min(420px,26vw)]",
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-white/95">
                    {promptModal.mode === "sora" ? (
                      <img
                        src={SORA_BRAND_ICON}
                        alt="Sora gallery"
                        width={24}
                        height={24}
                        className="h-6 w-6 shrink-0 object-contain invert"
                        draggable={false}
                      />
                    ) : promptModal.img.source === "nanoBanana" ? (
                      <img
                        src={NANO_BANANA_ICON}
                        alt="Nano Banana (Google)"
                        width={24}
                        height={24}
                        className="h-6 w-6 shrink-0 object-contain"
                        draggable={false}
                      />
                    ) : (
                      <img
                        src={REVE_BRAND_ICON}
                        alt="Reve Art"
                        width={24}
                        height={24}
                        className={MONO_MODAL_BRAND_IMG}
                        draggable={false}
                      />
                    )}
                    Prompt
                  </span>
                  <button
                    type="button"
                    title="Copy prompt"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/95 transition hover:bg-white/20 disabled:opacity-40"
                    disabled={
                      promptModal.mode === "sora"
                        ? soraPromptLoading || !soraPromptText
                        : !promptModal.img.prompt?.trim()
                    }
                    onClick={() => void copyOverlayPrompt()}
                  >
                    <Copy className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <p className="select-text whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                    {overlayPromptBody}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

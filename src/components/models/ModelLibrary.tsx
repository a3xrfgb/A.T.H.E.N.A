import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MODEL_CATALOG } from "../../constants/modelCatalog";
import { cn } from "../../lib/utils";
import { useModelStore } from "../../store/modelStore";
import { DownloadProgressBar } from "./DownloadProgress";
import { ModelCatalogCard } from "./ModelCatalogCard";

/** Dot grid on a full-height layer so it covers the entire scrollable canvas (not just the card block). */
const dotGridLight: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at center, rgba(15, 23, 42, 0.12) 1.25px, transparent 1.35px)",
  backgroundSize: "20px 20px",
};

const dotGridDark: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at center, rgba(255, 255, 255, 0.08) 1.25px, transparent 1.35px)",
  backgroundSize: "20px 20px",
};

export function ModelLibrary() {
  const loadLocalModels = useModelStore((s) => s.loadLocalModels);
  const downloadingModels = useModelStore((s) => s.downloadingModels);
  const [queueOpen, setQueueOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const activeDownloads = useMemo(
    () => Object.values(downloadingModels).filter((p) => p.status === "downloading"),
    [downloadingModels],
  );

  useEffect(() => {
    void loadLocalModels();
  }, [loadLocalModels]);

  useEffect(() => {
    if (!queueOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(ev.target as Node)) {
        setQueueOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [queueOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="relative min-h-full pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 dark:hidden"
          style={dotGridLight}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 hidden dark:block"
          style={dotGridDark}
        />
        <div className="relative z-[1] flex flex-col gap-6 p-4">
          <section>
            <h2 className="text-sm font-semibold text-[var(--app-text)]">Athena model catalog</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--app-muted)]">
              Download your preferred model to chat.
            </p>
            <div className="mt-4 grid grid-cols-5 gap-5">
              {MODEL_CATALOG.map((entry) => (
                <ModelCatalogCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-20 flex justify-end pr-3 pb-3 pt-2">
          <div ref={fabRef} className="relative flex flex-col items-end gap-2">
            {queueOpen ? (
              <div
                className={cn(
                  "w-[min(20rem,calc(100vw-2rem))] max-h-[min(18rem,40vh)] overflow-y-auto rounded-xl border p-2 shadow-lg",
                  "border-[var(--app-border)] bg-[var(--app-bg)]/95 backdrop-blur-md",
                )}
                role="dialog"
                aria-label="Download queue"
              >
                {activeDownloads.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-[var(--app-muted)]">
                    No active downloads
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {activeDownloads.map((p) => (
                      <DownloadProgressBar key={p.modelId} p={p} />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setQueueOpen((o) => !o)}
              title={queueOpen ? "Hide download queue" : "Show download queue"}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition-all",
                "border-[var(--app-border)] bg-[var(--app-bg)]/90 text-[var(--app-text)] backdrop-blur-md",
                "hover:border-accent/40 hover:shadow-[0_0_24px_-4px_rgba(124,106,247,0.35)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                activeDownloads.length === 0 && "opacity-70",
              )}
            >
              <Download className="h-5 w-5" strokeWidth={2} aria-hidden />
              {activeDownloads.length > 0 ? (
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                    "bg-accent text-[10px] font-bold text-white shadow-sm",
                  )}
                >
                  {activeDownloads.length > 9 ? "9+" : activeDownloads.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Check, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogEntry } from "../../constants/modelCatalog";
import { isCatalogFileOnDisk } from "../../lib/modelDisk";
import { cn } from "../../lib/utils";
import { useTranslation } from "../../i18n/I18nContext";
import { useModelStore } from "../../store/modelStore";
import { useUiStore } from "../../store/uiStore";

/** Accent #7c6af7 — glow + ring on hover */
const GLOW =
  "group-hover/card:shadow-[0_0_0_1px_rgba(124,106,247,0.35),0_12px_48px_-10px_rgba(124,106,247,0.28),0_0_72px_-12px_rgba(124,106,247,0.38),0_8px_32px_-8px_rgba(15,23,42,0.12)]";
const GLOW_DARK =
  "dark:group-hover/card:shadow-[0_0_0_1px_rgba(124,106,247,0.45),0_8px_40px_-8px_rgba(124,106,247,0.22),0_0_88px_-20px_rgba(124,106,247,0.32)]";

export function ModelCatalogCard({ entry }: { entry: CatalogEntry }) {
  const { t } = useTranslation();
  const localModels = useModelStore((s) => s.localModels);
  const downloadingModels = useModelStore((s) => s.downloadingModels);
  const downloadModelFiles = useModelStore((s) => s.downloadModelFiles);
  const pushToast = useUiStore((s) => s.pushToast);
  const [imgOk, setImgOk] = useState(true);

  const fileIds = entry.files.map((f) => f.modelId);
  const localIds = useMemo(
    () => new Set(localModels.map((m) => m.id)),
    [localModels],
  );
  const allDownloaded =
    entry.files.length > 0 && fileIds.every((id) => isCatalogFileOnDisk(localIds, id));
  const isBusy = fileIds.some((id) => {
    const u = id.replace(/\./g, "_");
    const p = downloadingModels[id] ?? (u !== id ? downloadingModels[u] : undefined);
    return p && p.status === "downloading";
  });
  const canDownload = entry.files.length > 0;

  const onDownload = async () => {
    if (!canDownload || isBusy || allDownloaded) return;
    try {
      await downloadModelFiles(
        entry.files.map((f) => ({ id: f.modelId, url: f.url })),
        entry.bundleDir ?? entry.files[0]?.modelId,
      );
      pushToast("Download complete — pick this model in chat to start.", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  return (
    <div className="group/card relative mx-auto flex min-w-0 w-full max-w-[19.5rem] flex-col items-stretch gap-2">
      {/* Soft outer bloom — visible behind frosted card */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-3 z-0 rounded-[28px] opacity-0 blur-xl transition-all duration-300 ease-out",
          "bg-accent/35 group-hover/card:opacity-100 group-hover/card:blur-2xl",
        )}
        aria-hidden
      />

      <div
        className={cn(
          "relative z-[1] flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ease-out will-change-transform",
          /* Glass — strong blur + saturation so frost reads on dot grid */
          "border-white/70 bg-gradient-to-br from-white/75 via-white/55 to-white/40",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),inset_0_-1px_0_0_rgba(255,255,255,0.25),0_16px_48px_-18px_rgba(15,23,42,0.22),0_6px_20px_-8px_rgba(15,23,42,0.1)]",
          "backdrop-blur-2xl backdrop-saturate-[1.8]",
          "dark:border-white/25 dark:from-white/[0.18] dark:via-white/[0.11] dark:to-white/[0.06]",
          "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),inset_0_-1px_0_0_rgba(0,0,0,0.15),0_20px_56px_-20px_rgba(0,0,0,0.55)]",
          "dark:backdrop-blur-2xl",
          /* Hover motion */
          "hover:-translate-y-1.5 hover:scale-[1.02]",
          GLOW,
          GLOW_DARK,
        )}
      >
        {/* Inner violet wash on the frosted surface (hover) */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          style={{
            background:
              "radial-gradient(ellipse 100% 75% at 50% -10%, rgba(124, 106, 247, 0.28) 0%, rgba(124, 106, 247, 0.08) 42%, transparent 68%)",
          }}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col">
          <div
            className={cn(
              "relative aspect-[3/4] w-full overflow-hidden transition-[background-color,box-shadow] duration-300",
              "ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.12]",
              "group-hover/card:shadow-[inset_0_0_48px_-12px_rgba(124,106,247,0.2)]",
              "dark:group-hover/card:shadow-[inset_0_0_48px_-12px_rgba(124,106,247,0.25)]",
              "bg-white dark:bg-neutral-950",
            )}
          >
            {entry.logoUrl && imgOk ? (
              <img
                src={entry.logoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-contain p-7 transition-transform duration-300 ease-out group-hover/card:scale-105 drop-shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]"
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-4 text-center text-neutral-800 dark:text-neutral-100">
                <span className="text-xl font-bold tracking-tight drop-shadow-sm">
                  {entry.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  GGUF
                </span>
              </div>
            )}
            {entry.vision ? (
              <span
                className={cn(
                  "absolute left-1.5 top-1.5 z-[2] rounded-md px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                  "bg-white/85 text-neutral-800 ring-1 ring-black/10 dark:bg-black/30 dark:text-neutral-100 dark:ring-white/15",
                )}
              >
                Vision
              </span>
            ) : null}
            {entry.featured ? (
              <span
                className={cn(
                  "absolute right-1.5 top-1.5 z-[2] rounded-md px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                  "bg-white/85 text-neutral-800 ring-1 ring-black/10 dark:bg-black/30 dark:text-neutral-100 dark:ring-white/15",
                )}
              >
                Featured
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              "border-t border-[var(--app-text)]/[0.08] px-3 py-2.5 dark:border-white/15",
              "bg-white/25 backdrop-blur-md dark:bg-white/[0.04]",
            )}
          >
            <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-[var(--app-text)]">
              {entry.name}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--app-muted)]">
              {entry.subtitle}
            </p>
          </div>
        </div>
      </div>

      {canDownload ? (
        <button
          type="button"
          disabled={isBusy || allDownloaded}
          onClick={() => void onDownload()}
          className={cn(
            "relative z-[1] flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl border py-2 text-sm font-semibold text-[var(--app-text)]",
            "border-white/60 bg-gradient-to-b from-white/55 to-white/35 backdrop-blur-2xl backdrop-saturate-150",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_8px_28px_-10px_rgba(15,23,42,0.18),0_2px_12px_-4px_rgba(15,23,42,0.1)]",
            "transition-all duration-300 ease-out",
            !allDownloaded &&
              "hover:-translate-y-0.5 hover:border-accent/40 hover:from-white/70 hover:to-white/45",
            !allDownloaded &&
              "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),0_0_40px_-8px_rgba(124,106,247,0.25),0_12px_32px_-12px_rgba(15,23,42,0.15)]",
            "dark:border-white/20 dark:from-white/[0.14] dark:to-white/[0.08]",
            "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_10px_32px_-12px_rgba(0,0,0,0.45)]",
            !allDownloaded && "dark:hover:border-accent/45 dark:hover:shadow-[0_0_48px_-10px_rgba(124,106,247,0.28)]",
            !allDownloaded && "active:translate-y-0 active:scale-[0.99]",
            "disabled:cursor-not-allowed disabled:hover:translate-y-0",
            isBusy && "disabled:opacity-50",
            allDownloaded &&
              "border-emerald-500/35 bg-gradient-to-b from-emerald-500/15 to-emerald-600/10 text-emerald-800 dark:border-emerald-400/30 dark:from-emerald-500/12 dark:to-emerald-600/8 dark:text-emerald-100/95",
            allDownloaded && "disabled:opacity-100",
          )}
        >
          {allDownloaded ? (
            <Check className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.5} />
          ) : (
            <Download className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
          )}
          {isBusy ? "…" : allDownloaded ? t("model.catalog.downloaded") : t("welcome.download")}
        </button>
      ) : entry.hfPage ? (
        <a
          href={entry.hfPage}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Hugging Face"
          className={cn(
            "relative z-[1] flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl border py-2 text-sm font-semibold leading-tight text-[var(--app-text)]",
            "border-white/60 bg-gradient-to-b from-white/55 to-white/35 backdrop-blur-2xl backdrop-saturate-150",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_8px_28px_-10px_rgba(15,23,42,0.18),0_2px_12px_-4px_rgba(15,23,42,0.1)]",
            "transition-all duration-300 ease-out",
            "hover:-translate-y-0.5 hover:border-accent/40 hover:from-white/70 hover:to-white/45",
            "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),0_0_40px_-8px_rgba(124,106,247,0.25),0_12px_32px_-12px_rgba(15,23,42,0.15)]",
            "dark:border-white/20 dark:from-white/[0.14] dark:to-white/[0.08]",
            "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_10px_32px_-12px_rgba(0,0,0,0.45)]",
            "dark:hover:border-accent/45 dark:hover:shadow-[0_0_48px_-10px_rgba(124,106,247,0.28)]",
            "active:scale-[0.99]",
          )}
        >
          <ExternalLink className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
          HF
        </a>
      ) : null}
    </div>
  );
}

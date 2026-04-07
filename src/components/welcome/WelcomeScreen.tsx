import { Brain, Eye, Hammer } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type WelcomeModelBundle,
  WELCOME_MODEL_BUNDLES,
} from "../../constants/welcomeModelBundles";
import { useTranslation } from "../../i18n/I18nContext";
import { isCatalogFileOnDisk } from "../../lib/modelDisk";
import { cn } from "../../lib/utils";
import { useModelStore } from "../../store/modelStore";
import { useUiStore } from "../../store/uiStore";
import { AthenaLogo } from "../layout/AthenaLogo";
import { DownloadProgressBar } from "../models/DownloadProgress";

function PortraitLogoHero({
  bundle,
}: {
  bundle: WelcomeModelBundle;
}) {
  const [imgOk, setImgOk] = useState(true);
  const plate = bundle.logoPlate ?? "dark";

  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden rounded-xl border border-white/30 shadow-inner",
        "aspect-[3/5] max-h-[182px] min-h-[130px] sm:max-h-[208px]",
        plate === "light"
          ? "bg-gradient-to-b from-white via-white/95 to-neutral-100/90 dark:from-white/95 dark:via-white/90 dark:to-neutral-200/80"
          : "bg-gradient-to-b from-white/20 via-white/10 to-transparent dark:from-white/[0.12] dark:via-white/[0.06]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 35%, ${bundle.gradient[1]}55, transparent 65%)`,
        }}
        aria-hidden
      />
      {imgOk ? (
        <img
          src={bundle.logoUrl}
          alt={bundle.logoAlt}
          className={cn(
            "relative z-[1] h-full w-full object-contain p-5 sm:p-[1.35rem]",
            "transition-transform duration-500 ease-out group-hover:scale-[1.04]",
            plate === "light" ? "drop-shadow-[0_4px_14px_rgba(0,0,0,0.12)]" : "drop-shadow-[0_6px_20px_rgba(0,0,0,0.2)]",
          )}
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center">
          <span className="text-xl font-bold tracking-tight text-[var(--app-text)]">
            {bundle.title
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            GGUF
          </span>
        </div>
      )}
    </div>
  );
}

export function WelcomeScreen() {
  const { t } = useTranslation();
  const downloadModelFiles = useModelStore((s) => s.downloadModelFiles);
  const localModels = useModelStore((s) => s.localModels);
  const downloadingModels = useModelStore((s) => s.downloadingModels);
  const pushToast = useUiStore((s) => s.pushToast);

  const localIds = useMemo(() => new Set(localModels.map((m) => m.id)), [localModels]);

  const onDownloadBundle = async (bundle: WelcomeModelBundle) => {
    try {
      await downloadModelFiles(bundle.files, bundle.bundleDir ?? bundle.files[0]?.id);
      pushToast(t("welcome.downloadedToast"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-[#f4f2ee] px-4 py-10 dark:bg-[var(--app-bg)] sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-col items-center">
        <AthenaLogo className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24" />
      </div>
      <h1 className="text-center font-sans text-2xl font-semibold tracking-tight text-neutral-900 dark:text-[var(--app-text)] sm:text-[1.75rem]">
        {t("welcome.title")}
      </h1>
      <p className="mt-3 max-w-xl px-2 text-center text-[15px] leading-relaxed text-neutral-600 dark:text-[var(--app-muted)]">
        {t("welcome.subtitle")}
      </p>

      <div className="mt-10 flex w-full max-w-5xl flex-col flex-wrap items-center justify-center gap-6 md:flex-row md:items-stretch md:gap-5 lg:gap-7">
        {WELCOME_MODEL_BUNDLES.map((bundle) => {
          const fileIds = bundle.files.map((f) => f.id);
          const allDownloaded = fileIds.every((id) => isCatalogFileOnDisk(localIds, id));
          const isBusy = fileIds.some((id) => {
            const u = id.replace(/\./g, "_");
            const p = downloadingModels[id] ?? (u !== id ? downloadingModels[u] : undefined);
            return p?.status === "downloading";
          });
          const progressFiles = bundle.files.filter(
            (f) => downloadingModels[f.id]?.status === "downloading",
          );

          return (
            <div
              key={bundle.key}
              className="group relative flex w-full max-w-[182px] flex-col [perspective:780px]"
            >
              {/* Soft colored bloom behind card */}
              <div
                className="pointer-events-none absolute -inset-4 z-0 rounded-2xl opacity-35 blur-2xl transition-opacity duration-500 group-hover:opacity-65"
                style={{
                  background: `linear-gradient(180deg, ${bundle.gradient[0]}77, ${bundle.gradient[1]}44)`,
                }}
                aria-hidden
              />

              <div
                className={cn(
                  "relative z-[1] flex min-h-[min(338px,51vh)] w-full flex-col overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-b from-white/55 via-white/35 to-white/[0.12] p-2.5 pb-3 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.28),0_8px_18px_-8px_rgba(15,23,42,0.15),inset_0_1px_0_0_rgba(255,255,255,0.65)] backdrop-blur-xl backdrop-saturate-[1.65] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
                  "dark:border-white/20 dark:from-white/[0.16] dark:via-white/[0.09] dark:to-white/[0.04] dark:shadow-[0_21px_47px_-16px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.12)]",
                  "group-hover:-translate-y-1 group-hover:shadow-[0_26px_52px_-13px_rgba(15,23,42,0.38),0_13px_26px_-10px_rgba(15,23,42,0.2)]",
                  "group-hover:[transform:translateZ(8px)_rotateX(5deg)_rotateY(-2deg)]",
                  "dark:group-hover:shadow-[0_26px_58px_-18px_rgba(0,0,0,0.65)]",
                )}
              >
                <PortraitLogoHero bundle={bundle} />

                <div className="mt-2.5 flex min-h-0 flex-1 flex-col px-0.5">
                  <p className="text-center text-[13px] font-semibold leading-tight text-neutral-900 dark:text-[var(--app-text)]">
                    {bundle.title}
                  </p>
                  <ul
                    className="mt-2 flex list-none items-center justify-center gap-2.5 text-neutral-600 dark:text-[var(--app-muted)]"
                    aria-label={t("welcome.capabilityGroupLabel")}
                  >
                    <li title={t("welcome.capabilityVision")} aria-label={t("welcome.capabilityVision")}>
                      <Eye className="h-[13px] w-[13px] opacity-85" strokeWidth={2.1} aria-hidden />
                    </li>
                    <li title={t("welcome.capabilityThinking")} aria-label={t("welcome.capabilityThinking")}>
                      <Brain className="h-[13px] w-[13px] opacity-85" strokeWidth={2.1} aria-hidden />
                    </li>
                    <li title={t("welcome.capabilityTools")} aria-label={t("welcome.capabilityTools")}>
                      <Hammer className="h-[13px] w-[13px] opacity-85" strokeWidth={2.1} aria-hidden />
                    </li>
                  </ul>
                  <p className="mt-2 text-center text-[10px] font-medium leading-tight text-neutral-500 dark:text-[var(--app-muted)]">
                    {bundle.subtitle}
                  </p>

                  <button
                    type="button"
                    disabled={isBusy || allDownloaded}
                    className={cn(
                      "mt-3 w-full rounded-xl px-2.5 py-2 text-[13px] font-semibold leading-tight text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55",
                    )}
                    style={{
                      background: `linear-gradient(100deg, ${bundle.gradient[0]}, ${bundle.gradient[1]})`,
                    }}
                    onClick={() => void onDownloadBundle(bundle)}
                  >
                    {allDownloaded
                      ? t("welcome.downloaded")
                      : isBusy
                        ? t("welcome.downloading")
                        : t("welcome.download")}
                  </button>
                </div>
              </div>

              {progressFiles.length > 0 ? (
                <div className="relative z-[2] mt-2.5 w-full space-y-1.5">
                  {progressFiles.map((f) => {
                    const p = downloadingModels[f.id];
                    if (!p) return null;
                    return <DownloadProgressBar key={f.id} p={p} />;
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

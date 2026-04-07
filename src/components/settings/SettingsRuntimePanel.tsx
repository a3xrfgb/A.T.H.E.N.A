import * as Switch from "@radix-ui/react-switch";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CircuitBoard, Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";
import type { LlamaRuntimeInfo } from "../../types/runtime";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { SettingsGlassSelect } from "./SettingsGlassSelect";
import { settingsToggleGradientBg, settingsToggleOnLightBg } from "./settingsGradients";

const TOGGLE_ON = `${settingsToggleOnLightBg} ${settingsToggleGradientBg} dark:animate-settings-selection-gradient motion-reduce:dark:animate-none`;

const RELEASES_URL = "https://github.com/ggml-org/llama.cpp/releases";

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type DownloadPayload = {
  bytesDownloaded?: number;
  totalBytes?: number;
  percentage?: number;
  status?: string;
  phase?: string;
};

export function SettingsRuntimePanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const [info, setInfo] = useState<LlamaRuntimeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingCudart, setDownloadingCudart] = useState(false);
  const [dlPct, setDlPct] = useState(0);
  const [dlPhase, setDlPhase] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    if (!isTauri()) return;
    setLoading(true);
    try {
      const r = await api.getLlamaRuntimeInfo(settings.runtimeVariant);
      setInfo(r);
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast, settings.runtimeVariant]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (!isTauri()) return;
    let un: (() => void) | undefined;
    void (async () => {
      un = await listen<DownloadPayload>("athena-runtime-download", (e) => {
        const p = e.payload;
        if (p?.status === "downloading" && typeof p.percentage === "number") {
          setDlPct(Math.min(100, Math.max(0, p.percentage)));
          setDlPhase(typeof p.phase === "string" ? p.phase : null);
        }
      });
    })();
    return () => {
      un?.();
    };
  }, []);

  const onDownload = async () => {
    if (!isTauri() || !info?.supported) return;
    setDownloading(true);
    setDlPct(0);
    setDlPhase(null);
    try {
      await api.downloadLlamaRuntime(settings.runtimeVariant);
      setDlPct(100);
      setDlPhase(null);
      pushToast(t("settings.runtime.downloadComplete"), "success");
      void loadInfo();
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setDownloading(false);
    }
  };

  const onDownloadCudartOnly = async () => {
    if (!isTauri() || !info?.supported) return;
    setDownloadingCudart(true);
    setDlPct(0);
    setDlPhase(null);
    try {
      await api.downloadCudartRuntime();
      setDlPct(100);
      pushToast(t("settings.runtime.cudartDownloadComplete"), "success");
      void loadInfo();
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setDownloadingCudart(false);
      setDlPhase(null);
    }
  };

  const busy = downloading || downloadingCudart;

  return (
    <div className="px-8 py-10">
      {!isTauri() ? (
        <p className="max-w-lg text-sm text-[var(--app-muted)]">{t("settings.runtime.webOnly")}</p>
      ) : (
        <div className="max-w-xl space-y-8">
          <section>
            <label className="text-sm font-semibold text-[var(--app-text)]" htmlFor="runtime-variant">
              {t("settings.runtime.variant")}
            </label>
            <SettingsGlassSelect
              id="runtime-variant"
              className="mt-2 w-full"
              triggerClassName="px-3 py-2"
              value={settings.runtimeVariant}
              onValueChange={(runtimeVariant) => {
                void save({ runtimeVariant: runtimeVariant as typeof settings.runtimeVariant }).catch(
                  (err) => pushToast(String(err), "error"),
                );
              }}
              options={[
                { value: "cpu", label: t("settings.runtime.variantCpu") },
                { value: "cuda12", label: t("settings.runtime.variantCuda12") },
                { value: "vulkan", label: t("settings.runtime.variantVulkan") },
              ]}
            />
          </section>

          <div className="flex flex-col gap-2 border-b border-[var(--app-border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--app-text)]">
                {t("settings.runtime.notifyUpdates")}
              </p>
            </div>
            <Switch.Root
              checked={settings.runtimeNotifyUpdates}
              onCheckedChange={(c) => {
                void save({ runtimeNotifyUpdates: c }).catch((e) => pushToast(String(e), "error"));
              }}
              className={cn(
                "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent outline-none transition-colors",
                settings.runtimeNotifyUpdates ? TOGGLE_ON : "bg-[var(--app-border)]",
              )}
            >
              <Switch.Thumb
                className={cn(
                  "block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]",
                )}
              />
            </Switch.Root>
          </div>

          {/* CUDA runtime DLLs (cudart) — same archive as upstream; paired with CUDA 12 engine download */}
          {info?.supported ? (
            <section
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4"
              aria-labelledby="runtime-cuda-heading"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]"
                  aria-hidden
                >
                  <CircuitBoard className="h-4 w-4 text-[var(--app-muted)]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 id="runtime-cuda-heading" className="text-sm font-semibold text-[var(--app-text)]">
                    {t("settings.runtime.cudaSectionTitle")}
                  </h4>
                  {info.cudartAssetName ? (
                    <p className="mt-2 font-mono text-[11px] text-[var(--app-text)]/90">
                      {info.cudartAssetName}{" "}
                      <span className="text-[var(--app-muted)]">({formatBytes(info.cudartSize)})</span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !info.cudartAssetName}
                    onClick={() => void onDownloadCudartOnly()}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" strokeWidth={2} />
                    {t("settings.runtime.downloadCudartOnly")}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadInfo()}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-bg)] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} strokeWidth={2} />
                {t("settings.runtime.checkUpdates")}
              </button>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#0080ff] underline-offset-2 hover:underline"
              >
                {t("settings.runtime.releaseNotes")}
              </a>
            </div>

            {info && (
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 text-sm">
                {!info.supported ? (
                  <p className="text-[var(--app-muted)]">{t("settings.runtime.unsupportedPlatform")}</p>
                ) : !info.assetName ? (
                  <p className="text-amber-700 dark:text-amber-300">{t("settings.runtime.noMatchingAsset")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--app-text)]">
                      <span>
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.latest")} </span>
                        <span className="font-mono">{info.latestTag}</span>
                      </span>
                      <span>
                        <span className="text-[var(--app-muted)]">{t("settings.runtime.installed")} </span>
                        <span className="font-mono">{info.installedTag ?? "—"}</span>
                      </span>
                    </div>
                    {info.binDir && (
                      <p className="mt-2 break-all font-mono text-xs text-[var(--app-muted)]">
                        {t("settings.runtime.binDir")} {info.binDir}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {info.updateAvailable && info.assetName ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDownload()}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0080ff] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0070e0] disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} />
                          {t("settings.runtime.downloadUpdate")}
                        </button>
                      ) : !info.updateAvailable ? (
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {t("settings.runtime.latestInstalled")}
                        </span>
                      ) : null}
                    </div>
                    {busy && (
                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--app-border)]">
                          <div
                            className="h-full bg-[#0080ff] transition-[width] duration-300"
                            style={{ width: `${dlPct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-[var(--app-muted)]">
                          {Math.round(dlPct)}%
                          {dlPhase ? (
                            <span className="ml-2 font-mono text-[10px] opacity-80">{dlPhase}</span>
                          ) : null}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

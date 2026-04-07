import * as Switch from "@radix-ui/react-switch";
import { isTauri } from "@tauri-apps/api/core";
import { FolderOpen, HelpCircle, RefreshCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { filterMainChatModels } from "../../lib/modelDisk";
import { cn } from "../../lib/utils";
import { api } from "../../lib/tauri";
import { useModelStore } from "../../store/modelStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { SETTINGS_LANGUAGES } from "./languages";
import {
  clampContext,
  estimateInferenceVramGb,
  inferenceLaunchSnapshot,
} from "./inferenceSettingsHelpers";
import { SettingsGlassSelect } from "./SettingsGlassSelect";
import { settingsToggleGradientBg, settingsToggleOnLightBg } from "./settingsGradients";

const TOGGLE_ON = `${settingsToggleOnLightBg} ${settingsToggleGradientBg} dark:animate-settings-selection-gradient motion-reduce:dark:animate-none`;

function joinModelsPath(dataDir: string): string {
  const base = dataDir.replace(/[/\\]+$/, "");
  if (!base) return "…/models";
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}models`;
}

function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-semibold text-[var(--app-text)]">{children}</span>
      {hint ? (
        <span title={hint} className="inline-flex text-[var(--app-muted)]">
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

function rangeClassName(disabled?: boolean) {
  return cn(
    "h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--app-border)] accent-[#0080ff] disabled:opacity-50",
    disabled && "cursor-not-allowed",
  );
}

export function SettingsGeneralPanel() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const localModels = useModelStore((s) => s.localModels);
  const activeModelId = useModelStore((s) => s.activeModelId);
  const loadLocalModels = useModelStore((s) => s.loadLocalModels);

  const modelsPath = useMemo(() => joinModelsPath(settings.dataDir), [settings.dataDir]);

  const appliedInferenceRef = useRef<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [hwLoading, setHwLoading] = useState(true);
  const [hwGpuName, setHwGpuName] = useState<string | null>(null);
  const [hwVramBytes, setHwVramBytes] = useState<number | null>(null);
  const cpuMaxThreads = useMemo(
    () => Math.min(128, Math.max(4, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8) * 2)),
    [],
  );

  useEffect(() => {
    void loadLocalModels();
  }, [loadLocalModels]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const snap = await api.getHardwareSnapshot();
        if (cancelled) return;
        const g0 = snap.gpus[0];
        setHwGpuName(g0?.name ?? (snap.gpus.length ? null : t("settings.general.inference.noGpu")));
        setHwVramBytes(snap.vramTotalBytes ?? g0?.vramTotalBytes ?? null);
      } catch {
        if (!cancelled) {
          setHwGpuName(null);
          setHwVramBytes(null);
        }
      } finally {
        if (!cancelled) setHwLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (appliedInferenceRef.current === null) {
      appliedInferenceRef.current = inferenceLaunchSnapshot(
        useSettingsStore.getState().settings,
      );
    }
  }, []);

  const selectableModels = useMemo(() => filterMainChatModels(localModels), [localModels]);

  const activeModel = useMemo(() => {
    const id = settings.defaultModel || activeModelId;
    return selectableModels.find((m) => m.id === id) ?? selectableModels[0];
  }, [selectableModels, settings.defaultModel, activeModelId]);

  const maxCtx = useMemo(() => {
    const raw = activeModel?.maxContextTokens;
    if (raw != null && raw > 0) return raw;
    return 131072;
  }, [activeModel?.maxContextTokens]);

  const layerCount = useMemo(() => {
    const raw = activeModel?.layerCount;
    if (raw != null && raw > 0) return raw;
    return 40;
  }, [activeModel?.layerCount]);

  const maxGpuSlider = useMemo(() => {
    const raw = activeModel?.layerCount;
    if (raw != null && raw > 0) return raw;
    return 128;
  }, [activeModel?.layerCount]);

  const suggestedDefaultNgl = useMemo(() => {
    const cap = typeof activeModel?.layerCount === "number" && activeModel.layerCount! > 0
      ? activeModel.layerCount!
      : 40;
    return Math.min(40, cap);
  }, [activeModel?.layerCount]);

  const currentSnapshot = useMemo(() => inferenceLaunchSnapshot(settings), [settings]);
  const needsInferenceReload =
    appliedInferenceRef.current !== null && currentSnapshot !== appliedInferenceRef.current;

  const vramEstimateGb = useMemo(() => {
    if (!activeModel) return 0;
    return estimateInferenceVramGb({
      sizeBytes: activeModel.sizeBytes,
      layerCount,
      gpuLayers: settings.gpuLayers,
      contextLength: settings.contextLength,
    });
  }, [activeModel, layerCount, settings.gpuLayers, settings.contextLength]);

  const gpuAuto = settings.gpuLayers < 0;

  const cpuAuto = settings.cpuThreads < 1;

  const onReloadModel = useCallback(async () => {
    if (!isTauri()) {
      pushToast(t("settings.general.inference.reloadWeb"), "info");
      return;
    }
    setRestarting(true);
    try {
      await api.restartInferenceEngine();
      appliedInferenceRef.current = inferenceLaunchSnapshot(
        useSettingsStore.getState().settings,
      );
      pushToast(t("settings.general.inference.reloadDone"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setRestarting(false);
    }
  }, [pushToast, t]);

  const setContextLength = (n: number) => {
    void save({ contextLength: clampContext(n, maxCtx) }).catch((err) =>
      pushToast(String(err), "error"),
    );
  };

  const setGpuLayers = (v: number) => {
    void save({ gpuLayers: v }).catch((err) => pushToast(String(err), "error"));
  };

  const setCpuThreads = (v: number) => {
    void save({ cpuThreads: v }).catch((err) => pushToast(String(err), "error"));
  };

  return (
    <div className="px-8 py-10">
      <div className="max-w-3xl space-y-8">
        <section>
          <label className="text-sm font-semibold text-[var(--app-text)]" htmlFor="settings-lang">
            {t("settings.general.language")}
          </label>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.general.languageHint")}
          </p>
          <SettingsGlassSelect
            id="settings-lang"
            className="mt-2 w-full max-w-lg"
            triggerClassName="px-3 py-2"
            value={settings.language}
            onValueChange={(language) => {
              void save({ language }).catch((err) => pushToast(String(err), "error"));
            }}
            options={SETTINGS_LANGUAGES.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
        </section>

        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
            <FolderOpen className="h-4 w-4 opacity-80" strokeWidth={2} />
            {t("settings.general.modelsDir")}
          </div>
          <p className="mt-0.5 text-xs text-[var(--app-muted)]">
            {t("settings.general.modelsDirHint")}
          </p>
          <div className="mt-2 flex max-w-lg items-stretch gap-2">
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 font-mono text-[13px] text-[var(--app-text)]">
              <span className="break-all">{modelsPath}</span>
            </div>
            <button
              type="button"
              title={t("settings.general.openModelsFolder")}
              aria-label={t("settings.general.openModelsFolder")}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[var(--app-text)] transition hover:bg-[var(--app-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0080ff]"
              onClick={() => {
                if (!isTauri()) {
                  pushToast(t("settings.general.openModelsFolderWeb"), "info");
                  return;
                }
                void api.openModelsDir().catch((err) => pushToast(String(err), "error"));
              }}
            >
              <FolderOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--app-muted)]">
            {t("settings.general.dataRoot")}{" "}
            <span className="break-all font-mono text-[11px]">{settings.dataDir || "—"}</span>
          </p>
        </section>

        {/* —— Inference —— */}
        <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/40 p-5">
          {needsInferenceReload ? (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-[var(--app-text)]"
              role="status"
            >
              <span>{t("settings.general.inference.reloadBanner")}</span>
              <button
                type="button"
                disabled={restarting || !isTauri()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0080ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void onReloadModel()}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", restarting && "animate-spin")}
                  aria-hidden
                />
                {t("settings.general.inference.reloadButton")}
              </button>
            </div>
          ) : null}

          <div className="mt-6 space-y-8">
            <div>
              <SectionTitle hint={t("settings.general.inference.systemPromptHint")}>
                {t("settings.general.inference.systemPrompt")}
              </SectionTitle>
              <p className="mb-2 text-xs text-[var(--app-muted)]">
                {t("settings.general.inference.systemPromptLead")}
              </p>
              <textarea
                id="settings-system-prompt"
                rows={3}
                className="w-full resize-y rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0080ff]"
                placeholder={t("settings.general.inference.systemPromptPlaceholder")}
                value={settings.systemPrompt}
                onChange={(e) => {
                  void save({ systemPrompt: e.target.value }).catch((err) =>
                    pushToast(String(err), "error"),
                  );
                }}
              />
            </div>

            <div>
              <SectionTitle hint={t("settings.general.inference.contextHint")}>
                {t("settings.general.inference.context")}
              </SectionTitle>
              <p className="text-xs text-[var(--app-muted)]">
                {t("settings.general.inference.contextModelMax", {
                  max: maxCtx.toLocaleString(),
                })}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={256}
                  max={maxCtx}
                  className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0080ff]"
                  value={settings.contextLength}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setContextLength(v);
                  }}
                />
                <span className="text-xs text-[var(--app-muted)]">
                  {t("settings.general.inference.tokens")}
                </span>
              </div>
              <input
                type="range"
                min={256}
                max={maxCtx}
                step={
                  maxCtx > 32768 ? 2048 : maxCtx > 8192 ? 512 : 256
                }
                className={cn("mt-3", rangeClassName())}
                value={Math.min(settings.contextLength, maxCtx)}
                onChange={(e) => setContextLength(Number(e.target.value))}
              />
            </div>

            <div>
              <SectionTitle hint={t("settings.general.inference.gpuHint")}>
                {t("settings.general.inference.gpuTitle")}
              </SectionTitle>
              <p className="text-xs text-[var(--app-muted)]">
                {hwLoading
                  ? t("settings.general.inference.gpuDetecting")
                  : hwGpuName ??
                    t("settings.general.inference.noGpu")}
                {hwVramBytes != null && hwVramBytes > 0
                  ? ` · ${t("settings.general.inference.vramTotal", {
                      gb: (hwVramBytes / (1024 * 1024 * 1024)).toFixed(1),
                    })}`
                  : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-[var(--app-text)]">
                  <Switch.Root
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--app-border)] outline-none transition",
                      gpuAuto ? TOGGLE_ON : "bg-[var(--app-bg)]",
                    )}
                    checked={gpuAuto}
                    onCheckedChange={(on) => {
                      if (on) void save({ gpuLayers: -1 });
                      else void save({ gpuLayers: suggestedDefaultNgl });
                    }}
                  >
                    <Switch.Thumb
                      className={cn(
                        "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[1.35rem]",
                      )}
                    />
                  </Switch.Root>
                  {t("settings.general.inference.gpuAuto")}
                </label>
              </div>
              {!gpuAuto ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={maxGpuSlider}
                      className="w-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.gpuLayers}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        setGpuLayers(Math.min(maxGpuSlider, Math.max(0, v)));
                      }}
                    />
                    <span className="text-xs text-[var(--app-muted)]">
                      / {maxGpuSlider} {t("settings.general.inference.layers")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxGpuSlider}
                    className={cn("mt-2", rangeClassName())}
                    value={Math.min(settings.gpuLayers, maxGpuSlider)}
                    onChange={(e) => setGpuLayers(Number(e.target.value))}
                  />
                </>
              ) : null}
            </div>

            <div>
              <SectionTitle hint={t("settings.general.inference.cpuHint")}>
                {t("settings.general.inference.cpuTitle")}
              </SectionTitle>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-[var(--app-text)]">
                  <Switch.Root
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--app-border)] outline-none transition",
                      cpuAuto ? TOGGLE_ON : "bg-[var(--app-bg)]",
                    )}
                    checked={cpuAuto}
                    onCheckedChange={(on) => {
                      if (on) void save({ cpuThreads: -1 });
                      else void save({ cpuThreads: Math.min(12, cpuMaxThreads) });
                    }}
                  >
                    <Switch.Thumb
                      className={cn(
                        "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[1.35rem]",
                      )}
                    />
                  </Switch.Root>
                  {t("settings.general.inference.cpuAuto")}
                </label>
              </div>
              {!cpuAuto ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={cpuMaxThreads}
                      className="w-24 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.cpuThreads}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        setCpuThreads(Math.min(cpuMaxThreads, Math.max(1, v)));
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={cpuMaxThreads}
                    className={cn("mt-2", rangeClassName())}
                    value={Math.min(Math.max(1, settings.cpuThreads), cpuMaxThreads)}
                    onChange={(e) => setCpuThreads(Number(e.target.value))}
                  />
                </>
              ) : null}
            </div>

            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--app-text)]">
                  {t("settings.general.inference.memoryTitle")}
                </span>
                <span className="rounded-md bg-[var(--app-border)]/60 px-2 py-0.5 font-mono text-xs text-[var(--app-text)]">
                  {t("settings.general.inference.memoryGb", {
                    gb: vramEstimateGb.toFixed(2),
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                {t("settings.general.inference.memoryHint")}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--app-text)]">
                <Switch.Root
                  className={cn(
                    "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--app-border)] outline-none transition",
                    settings.showAdvancedInference ? TOGGLE_ON : "bg-[var(--app-bg)]",
                  )}
                  checked={settings.showAdvancedInference}
                  onCheckedChange={(showAdvancedInference) => {
                    void save({ showAdvancedInference }).catch((err) =>
                      pushToast(String(err), "error"),
                    );
                  }}
                >
                  <Switch.Thumb
                    className={cn(
                      "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[1.35rem]",
                    )}
                  />
                </Switch.Root>
                {t("settings.general.inference.advancedToggle")}
              </label>
            </div>

            {settings.showAdvancedInference ? (
              <div className="space-y-5 border-t border-[var(--app-border)] pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>{t("settings.general.inference.batch")}</SectionTitle>
                    <input
                      type="number"
                      min={32}
                      step={32}
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.inferenceBatchSize}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        void save({ inferenceBatchSize: Math.max(32, v) }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <SectionTitle>{t("settings.general.inference.ubatch")}</SectionTitle>
                    <input
                      type="number"
                      min={32}
                      step={32}
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.inferenceUbatchSize}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        void save({ inferenceUbatchSize: Math.max(32, v) }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                </div>

                <div>
                  <SectionTitle hint={t("settings.general.inference.parallelHint")}>
                    {t("settings.general.inference.parallel")}
                  </SectionTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={-1}
                      className="w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.inferenceParallel}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        void save({ inferenceParallel: v < 1 ? -1 : v }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                    <span className="text-xs text-[var(--app-muted)]">
                      {t("settings.general.inference.parallelAuto")}
                    </span>
                  </div>
                </div>

                <div>
                  <SectionTitle>{t("settings.general.inference.flashAttn")}</SectionTitle>
                  <SettingsGlassSelect
                    className="mt-1 w-full sm:max-w-xs"
                    triggerClassName="px-3 py-2"
                    value={settings.inferenceFlashAttn}
                    onValueChange={(inferenceFlashAttn) => {
                      void save({ inferenceFlashAttn }).catch((err) =>
                        pushToast(String(err), "error"),
                      );
                    }}
                    options={[
                      { value: "auto", label: t("settings.general.inference.flashAuto") },
                      { value: "on", label: t("settings.general.inference.flashOn") },
                      { value: "off", label: t("settings.general.inference.flashOff") },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {(
                    [
                      ["inferenceKvUnified", t("settings.general.inference.kvUnified")],
                      ["inferenceKvOffload", t("settings.general.inference.kvOffload")],
                      ["inferenceMmap", t("settings.general.inference.mmap")],
                      ["inferenceMlock", t("settings.general.inference.mlock")],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-[var(--app-text)]"
                    >
                      <Switch.Root
                        className={cn(
                          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--app-border)] outline-none transition",
                          settings[key] ? TOGGLE_ON : "bg-[var(--app-bg)]",
                        )}
                        checked={settings[key]}
                        onCheckedChange={(v) => {
                          if (key === "inferenceKvUnified")
                            void save({ inferenceKvUnified: v }).catch((err) =>
                              pushToast(String(err), "error"),
                            );
                          else if (key === "inferenceKvOffload")
                            void save({ inferenceKvOffload: v }).catch((err) =>
                              pushToast(String(err), "error"),
                            );
                          else if (key === "inferenceMmap")
                            void save({ inferenceMmap: v }).catch((err) =>
                              pushToast(String(err), "error"),
                            );
                          else void save({ inferenceMlock: v }).catch((err) =>
                            pushToast(String(err), "error"),
                          );
                        }}
                      >
                        <Switch.Thumb
                          className={cn(
                            "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[1.35rem]",
                          )}
                        />
                      </Switch.Root>
                      {label}
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <SectionTitle hint={t("settings.general.inference.ropeBaseHint")}>
                      {t("settings.general.inference.ropeBase")}
                    </SectionTitle>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0 = auto"
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.ropeFreqBase > 0 ? settings.ropeFreqBase : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? 0 : Number(raw);
                        void save({ ropeFreqBase: v }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <SectionTitle hint={t("settings.general.inference.ropeScaleHint")}>
                      {t("settings.general.inference.ropeScale")}
                    </SectionTitle>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0 = auto"
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      value={settings.ropeFreqScale > 0 ? settings.ropeFreqScale : ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? 0 : Number(raw);
                        void save({ ropeFreqScale: v }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <SectionTitle>{t("settings.general.inference.seed")}</SectionTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-[var(--app-muted)]">
                        <input
                          type="checkbox"
                          checked={settings.inferenceSeed < 0}
                          onChange={(e) => {
                            void save({
                              inferenceSeed: e.target.checked ? -1 : 0,
                            }).catch((err) => pushToast(String(err), "error"));
                          }}
                        />
                        {t("settings.general.inference.seedRandom")}
                      </label>
                      {settings.inferenceSeed >= 0 ? (
                        <input
                          type="number"
                          className="w-full min-w-[8rem] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm sm:w-32"
                          value={settings.inferenceSeed}
                          onChange={(e) => {
                            const v = Math.round(Number(e.target.value));
                            void save({ inferenceSeed: v }).catch((err) =>
                              pushToast(String(err), "error"),
                            );
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle hint={t("settings.general.inference.ctkHint")}>
                      {t("settings.general.inference.ctk")}
                    </SectionTitle>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      placeholder="f16, q8_0, …"
                      value={settings.inferenceCacheTypeK}
                      onChange={(e) => {
                        void save({ inferenceCacheTypeK: e.target.value }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                  <div>
                    <SectionTitle hint={t("settings.general.inference.ctvHint")}>
                      {t("settings.general.inference.ctv")}
                    </SectionTitle>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 font-mono text-sm"
                      placeholder="f16, q8_0, …"
                      value={settings.inferenceCacheTypeV}
                      onChange={(e) => {
                        void save({ inferenceCacheTypeV: e.target.value }).catch((err) =>
                          pushToast(String(err), "error"),
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

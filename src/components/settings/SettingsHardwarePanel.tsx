import * as Switch from "@radix-ui/react-switch";
import { Activity, HelpCircle } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../../lib/tauri";
import type { HardwareSnapshot } from "../../types/hardware";
import { useSettingsStore } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { cn } from "../../lib/utils";
import { settingsToggleGradientBg, settingsToggleOnLightBg } from "./settingsGradients";

/** On state: solid #ff4900 in light; animated blue/black gradient in dark. */
const TOGGLE_ON = `${settingsToggleOnLightBg} ${settingsToggleGradientBg} dark:animate-settings-selection-gradient motion-reduce:dark:animate-none`;

function gbFromBytes(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span className="text-sm font-semibold text-[var(--app-text)]">{children}</span>
      {hint ? (
        <span title={hint} className="inline-flex text-[var(--app-muted)]">
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FeatureBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--app-bg)] px-2 py-0.5 text-xs font-medium text-[var(--app-text)]">
      {children}
    </span>
  );
}

export function SettingsHardwarePanel() {
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const [snap, setSnap] = useState<HardwareSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getHardwareSnapshot();
      setSnap(s);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  const gpuAccelerationOn = settings.gpuLayers !== 0;

  const setGpuAcceleration = async (on: boolean) => {
    try {
      await save({ gpuLayers: on ? -1 : 0 });
      pushToast(on ? "GPU acceleration on (auto layers)" : "GPU acceleration off", "success");
    } catch (e) {
      pushToast(String(e), "error");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--app-border)] px-6 py-3">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--app-text)]">
          Hardware
        </h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {err ? (
          <p className="text-sm text-[var(--dropdown-danger)]">{err}</p>
        ) : null}
        {!snap && !err ? (
          <p className="text-sm text-[var(--app-muted)]">Detecting hardware…</p>
        ) : null}

        {snap ? (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
              <div className="flex min-h-0 flex-col">
                <SectionTitle
                  hint="Processor reported by the OS. AVX/AVX2 help many local inference builds."
                >
                  CPU
                </SectionTitle>
                <Card className="flex flex-1 flex-col">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    {snap.cpuCompatible ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        ✓ Compatible
                      </span>
                    ) : (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Limited (no AVX)
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--app-text)]">{snap.cpuName}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {snap.cpuFeatures.map((f) => (
                      <FeatureBadge key={f}>{f}</FeatureBadge>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="flex min-h-0 flex-col">
                <SectionTitle hint="System RAM and total dedicated GPU memory when reported.">
                  Memory capacity
                </SectionTitle>
                <Card className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-[var(--app-muted)]">RAM</span>
                    <span className="font-medium text-[var(--app-text)]">
                      {gbFromBytes(snap.ramTotalBytes)} GB
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4 text-sm">
                    <span className="text-[var(--app-muted)]">VRAM</span>
                    <span className="font-medium text-[var(--app-text)]">
                      {snap.vramTotalBytes != null
                        ? `${gbFromBytes(snap.vramTotalBytes)} GB`
                        : "—"}
                    </span>
                  </div>
                </Card>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <SectionTitle hint="NVIDIA GPUs use NVML when drivers are installed; otherwise WMI or nvidia-smi (Linux).">
                    GPUs
                  </SectionTitle>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--app-muted)] opacity-60"
                    title="Coming soon"
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--app-muted)] opacity-60"
                    title="Coming soon"
                  >
                    Open in new window
                  </button>
                </div>
              </div>
              <p className="mb-3 text-xs text-[var(--app-muted)]">{snap.gpuSummary}</p>

              <Card className="space-y-4">
                {snap.gpus.length === 0 ? (
                  <p className="text-sm text-[var(--app-muted)]">
                    No discrete GPU entries found. Install NVIDIA drivers for CUDA/NVML details.
                  </p>
                ) : (
                  snap.gpus.map((g) => (
                    <div
                      key={`${g.deviceIndex}-${g.name}`}
                      className="border-b border-[var(--app-border)] pb-4 last:border-0 last:pb-0"
                    >
                      <p className="font-semibold text-[var(--app-text)]">{g.name}</p>
                      <p className="mt-1 text-xs text-[var(--app-muted)]">
                        VRAM capacity:{" "}
                        {g.vramTotalBytes != null
                          ? `${gbFromBytes(g.vramTotalBytes)} GB`
                          : "Unknown"}{" "}
                        · {g.backend} · deviceId: {g.deviceIndex}
                      </p>
                    </div>
                  ))
                )}

                <div className="flex flex-col gap-2 border-b border-[var(--app-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      Use GPU acceleration
                    </p>
                    <p className="text-xs text-[var(--app-muted)]">
                      Maps to llama.cpp <code className="text-[11px]">-ngl</code> (auto when on, 0 when off).
                    </p>
                  </div>
                  <Switch.Root
                    checked={gpuAccelerationOn}
                    onCheckedChange={(c) => void setGpuAcceleration(c)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent outline-none transition-colors",
                      gpuAccelerationOn ? TOGGLE_ON : "bg-[var(--app-border)]",
                    )}
                  >
                    <Switch.Thumb
                      className={cn(
                        "block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform data-[state=checked]:translate-x-[22px]",
                      )}
                    />
                  </Switch.Root>
                </div>

                <div className="border-t border-[var(--app-border)] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-sm font-medium text-[var(--app-text)]">
                        Limit model offload to dedicated GPU memory
                        <span title="Reserved for a future llama.cpp option." className="text-[var(--app-muted)]">
                          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                        When off, weights may use shared memory if VRAM is full (not wired yet).
                      </p>
                    </div>
                    <Switch.Root
                      disabled
                      checked={false}
                      className="relative h-6 w-11 shrink-0 cursor-not-allowed rounded-full bg-[var(--app-border)] opacity-50"
                    >
                      <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
                    </Switch.Root>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
                  <div className="flex items-center gap-1 text-sm font-medium text-[var(--app-text)]">
                    Offload KV cache to GPU memory
                    <span title="Reserved for a future llama.cpp option." className="text-[var(--app-muted)]">
                      <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  </div>
                  <Switch.Root
                    disabled
                    checked
                    className={cn(
                      "relative h-6 w-11 shrink-0 cursor-not-allowed rounded-full opacity-50",
                      TOGGLE_ON,
                    )}
                  >
                    <Switch.Thumb className="block h-5 w-5 translate-x-[22px] rounded-full bg-white shadow" />
                  </Switch.Root>
                </div>
              </Card>
            </div>

            <div>
              <SectionTitle hint="Live samples every few seconds while this panel is open.">
                Resource monitor
              </SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--app-muted)]">
                    <Activity className="h-3.5 w-3.5" strokeWidth={2} />
                    RAM + VRAM (used)
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--app-text)]">
                    {snap.combinedMemUsedGb.toFixed(2)} GB
                  </p>
                </Card>
                <Card>
                  <div className="text-xs font-medium text-[var(--app-muted)]">CPU</div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--app-text)]">
                    {snap.cpuUsagePercent.toFixed(2)}%
                  </p>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import type { DownloadProgress as Dp } from "../../types/model";
import { cn } from "../../lib/utils";

export function DownloadProgressBar({ p, className }: { p: Dp; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3 text-xs text-[var(--app-muted)]",
        className,
      )}
    >
      <div className="flex justify-between">
        <span className="truncate font-mono text-[var(--app-text)]">{p.modelId}</span>
        <span className="shrink-0 capitalize">{p.status}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--app-border)]">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${Math.min(100, p.percentage)}%` }}
        />
      </div>
    </div>
  );
}

import { Trash2 } from "lucide-react";
import type { ModelInfo } from "../../types/model";
import { cn } from "../../lib/utils";

function formatBytes(n: number) {
  if (n > 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n > 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export function ModelCard({
  model,
  active,
  onDelete,
}: {
  model: ModelInfo;
  active: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-card border border-white/10 bg-surface/60 p-4",
        active && "border-accent/60 ring-1 ring-accent/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-[#f0f0f5]">{model.name}</div>
          <div className="text-xs text-muted">{model.filename}</div>
        </div>
        {active && (
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
            Active
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
        <span>Size: {formatBytes(model.sizeBytes)}</span>
        <span>Params: {model.parameters}</span>
        <span>Quant: {model.quantization}</span>
        <span>Format: {model.format}</span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

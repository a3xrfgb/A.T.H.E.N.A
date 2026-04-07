import type { ReactNode } from "react";
import { APP_CANVAS_PORTAL_ID } from "../../lib/appCanvasGlass";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";

export function MainPanel({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="flex min-h-0 flex-1">
        <div id={APP_CANVAS_PORTAL_ID} className="relative min-h-0 min-w-0 flex-1">
          {children}
        </div>
        <aside
          className={cn(
            "border-l border-[var(--app-border)] bg-[var(--app-bg)] transition-[width]",
            rightOpen ? "w-[280px] p-3" : "w-0 overflow-hidden p-0",
          )}
        >
          {rightOpen && right}
        </aside>
      </div>
    </div>
  );
}

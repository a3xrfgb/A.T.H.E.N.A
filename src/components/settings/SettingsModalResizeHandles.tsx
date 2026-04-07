import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "../../lib/utils";

export const SETTINGS_MODAL_MIN = { w: 520, h: 340 } as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function maxModalSize() {
  return {
    w: Math.max(SETTINGS_MODAL_MIN.w, Math.min(window.innerWidth - 32, 1400)),
    h: Math.max(SETTINGS_MODAL_MIN.h, Math.min(window.innerHeight - 32, 900)),
  };
}

export function defaultSettingsModalSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 920, h: 720 };
  const m = maxModalSize();
  return {
    w: Math.min(Math.floor(window.innerWidth * 0.96), 920, m.w),
    h: Math.min(Math.floor(window.innerHeight * 0.9), 720, m.h),
  };
}

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const hit = "pointer-events-auto select-none touch-none";

/**
 * Invisible edge/corner strips so the settings dialog can be resized like a native window.
 */
export function SettingsModalResizeHandles({
  size,
  onSizeChange,
}: {
  size: { w: number; h: number };
  onSizeChange: (next: { w: number; h: number }) => void;
}) {
  const dragRef = useRef<{
    edge: Edge;
    startW: number;
    startH: number;
    startX: number;
    startY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (edge: Edge) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        edge,
        startW: size.w,
        startH: size.h,
        startX: e.clientX,
        startY: e.clientY,
      };

      const apply = (clientX: number, clientY: number) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = clientX - d.startX;
        const dy = clientY - d.startY;
        const mx = maxModalSize();
        let w = d.startW;
        let h = d.startH;

        switch (d.edge) {
          case "e":
            w = d.startW + dx;
            break;
          case "w":
            w = d.startW - dx;
            break;
          case "n":
            h = d.startH + dy;
            break;
          case "s":
            h = d.startH + dy;
            break;
          case "ne":
            w = d.startW + dx;
            h = d.startH + dy;
            break;
          case "nw":
            w = d.startW - dx;
            h = d.startH + dy;
            break;
          case "se":
            w = d.startW + dx;
            h = d.startH + dy;
            break;
          case "sw":
            w = d.startW - dx;
            h = d.startH + dy;
            break;
          default:
            break;
        }

        onSizeChange({
          w: clamp(w, SETTINGS_MODAL_MIN.w, mx.w),
          h: clamp(h, SETTINGS_MODAL_MIN.h, mx.h),
        });
      };

      const move = (ev: PointerEvent) => {
        apply(ev.clientX, ev.clientY);
      };

      const up = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [onSizeChange, size.w, size.h],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className={cn("absolute top-0 left-2 right-2 h-2 cursor-ns-resize", hit)}
        onPointerDown={onPointerDown("n")}
        aria-hidden
      />
      <div
        className={cn("absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize", hit)}
        onPointerDown={onPointerDown("s")}
        aria-hidden
      />
      <div
        className={cn("absolute top-2 bottom-2 left-0 w-2 cursor-ew-resize", hit)}
        onPointerDown={onPointerDown("w")}
        aria-hidden
      />
      <div
        className={cn("absolute top-2 bottom-2 right-0 w-2 cursor-ew-resize", hit)}
        onPointerDown={onPointerDown("e")}
        aria-hidden
      />
      <div
        className={cn("absolute top-0 left-0 h-2 w-2 cursor-nwse-resize", hit)}
        onPointerDown={onPointerDown("nw")}
        aria-hidden
      />
      <div
        className={cn("absolute top-0 right-0 h-2 w-2 cursor-nesw-resize", hit)}
        onPointerDown={onPointerDown("ne")}
        aria-hidden
      />
      <div
        className={cn("absolute bottom-0 left-0 h-2 w-2 cursor-nesw-resize", hit)}
        onPointerDown={onPointerDown("sw")}
        aria-hidden
      />
      <div
        className={cn("absolute right-0 bottom-0 h-2 w-2 cursor-nwse-resize", hit)}
        onPointerDown={onPointerDown("se")}
        aria-hidden
      />
    </div>
  );
}

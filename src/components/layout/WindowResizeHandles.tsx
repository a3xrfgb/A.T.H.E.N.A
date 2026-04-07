import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState, type MouseEvent } from "react";

type Dir =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

/**
 * Frameless windows do not get OS resize hit-testing on the webview.
 * Edge/corner hit targets call `startResizeDragging` (requires
 * `core:window:allow-start-resize-dragging`). Inset corners match the outer
 * padding so the resize cursor appears on the rounded shell, not only the
 * screen edge.
 */
export function WindowResizeHandles({ disabled }: { disabled: boolean }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isTauri());
  }, []);

  if (!active || disabled) return null;

  const start = (dir: Dir) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startResizeDragging(dir);
  };

  const edge = "pointer-events-auto select-none touch-none";
  const zEdge = "z-[41]";
  const zCorner = "z-[42]";
  const zVisualCorner = "z-[43]";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45]"
      aria-hidden
    >
      {/* Edges (inset so corners own the diagonal). Slightly thick for easier targeting. */}
      <div
        className={`absolute top-0 left-2 right-2 h-2 cursor-ns-resize ${edge} ${zEdge}`}
        onMouseDown={start("North")}
      />
      <div
        className={`absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize ${edge} ${zEdge}`}
        onMouseDown={start("South")}
      />
      <div
        className={`absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize ${edge} ${zEdge}`}
        onMouseDown={start("West")}
      />
      <div
        className={`absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize ${edge} ${zEdge}`}
        onMouseDown={start("East")}
      />
      {/* Corners */}
      <div
        className={`absolute left-0 top-0 h-2.5 w-2.5 cursor-nwse-resize ${edge} ${zCorner}`}
        onMouseDown={start("NorthWest")}
      />
      <div
        className={`absolute right-0 top-0 h-2.5 w-2.5 cursor-nesw-resize ${edge} ${zCorner}`}
        onMouseDown={start("NorthEast")}
      />
      <div
        className={`absolute bottom-0 left-0 h-2.5 w-2.5 cursor-nesw-resize ${edge} ${zCorner}`}
        onMouseDown={start("SouthWest")}
      />
      <div
        className={`absolute bottom-0 right-0 h-2.5 w-2.5 cursor-nwse-resize ${edge} ${zCorner}`}
        onMouseDown={start("SouthEast")}
      />
      {/* Inset targets at the rounded shell (matches outer p-2) — users hover the white corner, not the screen edge */}
      <div
        className={`absolute bottom-2 right-2 h-3 w-3 cursor-nwse-resize ${edge} ${zVisualCorner}`}
        onMouseDown={start("SouthEast")}
      />
      <div
        className={`absolute bottom-2 left-2 h-3 w-3 cursor-nesw-resize ${edge} ${zVisualCorner}`}
        onMouseDown={start("SouthWest")}
      />
    </div>
  );
}

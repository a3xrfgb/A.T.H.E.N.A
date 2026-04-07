import { useCallback, useEffect, useRef, useState } from "react";

type Axis = "x" | "y";

/** Pointer drag that reports delta along one axis (for splitters). */
export function usePanelResize(
  axis: Axis,
  onDelta: (delta: number) => void,
  options?: { disabled?: boolean },
) {
  const active = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const disabled = options?.disabled ?? false;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      active.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis, disabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!active.current || disabled) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      const delta = axis === "x" ? dx : dy;
      if (delta !== 0) onDelta(delta);
    },
    [axis, onDelta, disabled],
  );

  const end = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      end();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    [end],
  );

  const onPointerCancel = useCallback(() => {
    end();
  }, [end]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const fn = () => setMatches(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return matches;
}

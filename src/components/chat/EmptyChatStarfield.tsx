import type { RefObject } from "react";
import { useEffectiveDark } from "../../hooks/useEffectiveDark";
import { Starfield } from "./Starfield";

type Props = {
  /** Container that fills the new-chat area (for sizing + coords). */
  panelRef: RefObject<HTMLElement | null>;
};

/**
 * Starfield backdrop for the empty thread (before first message).
 */
export function EmptyChatStarfield({ panelRef }: Props) {
  const dark = useEffectiveDark();

  return (
    <Starfield
      panelRef={panelRef}
      starColor={dark ? "rgba(255,255,255,0.82)" : "rgba(51,65,85,0.65)"}
      bgColor={dark ? "rgba(12,12,16,1)" : "rgba(248,250,252,1)"}
      opacity={0.12}
      speed={0.85}
      quantity={420}
      mouseAdjust
      easing={5}
      className="z-0"
    />
  );
}

/** Which corner or edge is being dragged to resize a canvas node. */
export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function computeResizedRect(
  edge: ResizeEdge,
  start: { x: number; y: number; w: number; h: number },
  ddx: number,
  ddy: number,
  minW: number,
  minH: number,
): { x: number; y: number; w: number; h: number } {
  const { x, y, w: sw, h: sh } = start;

  switch (edge) {
    case "se": {
      const nw = Math.max(minW, sw + ddx);
      const nh = Math.max(minH, sh + ddy);
      return { x, y, w: nw, h: nh };
    }
    case "nw": {
      let nw = sw - ddx;
      let nh = sh - ddy;
      let nx = x + ddx;
      let ny = y + ddy;
      if (nw < minW) {
        nx = x + sw - minW;
        nw = minW;
      }
      if (nh < minH) {
        ny = y + sh - minH;
        nh = minH;
      }
      return { x: nx, y: ny, w: nw, h: nh };
    }
    case "ne": {
      let nw = sw + ddx;
      let nh = sh - ddy;
      let ny = y + ddy;
      if (nw < minW) nw = minW;
      if (nh < minH) {
        ny = y + sh - minH;
        nh = minH;
      }
      return { x, y: ny, w: nw, h: nh };
    }
    case "sw": {
      let nw = sw - ddx;
      let nh = sh + ddy;
      let nx = x + ddx;
      if (nw < minW) {
        nx = x + sw - minW;
        nw = minW;
      }
      const nh2 = Math.max(minH, nh);
      return { x: nx, y, w: nw, h: nh2 };
    }
    case "n": {
      let nh = sh - ddy;
      let ny = y + ddy;
      if (nh < minH) {
        ny = y + sh - minH;
        nh = minH;
      }
      return { x, y: ny, w: sw, h: nh };
    }
    case "s": {
      const nh = Math.max(minH, sh + ddy);
      return { x, y, w: sw, h: nh };
    }
    case "e": {
      const nw = Math.max(minW, sw + ddx);
      return { x, y, w: nw, h: sh };
    }
    case "w": {
      let nw = sw - ddx;
      let nx = x + ddx;
      if (nw < minW) {
        nx = x + sw - minW;
        nw = minW;
      }
      return { x: nx, y, w: nw, h: sh };
    }
    default:
      return { x, y, w: sw, h: sh };
  }
}

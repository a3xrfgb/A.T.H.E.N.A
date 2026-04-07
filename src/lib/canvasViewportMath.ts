import type { CanvasNode, CanvasPoint } from "../types/canvasWorkspace";

/** Max dimension (px) for a media card — keeps DOM reasonable while preserving full decoded bitmap for zoom. */
export const MAX_MEDIA_DIM = 8192;

export const NODE_HEADER_H = 36;

export const MIN_ZOOM = 0.04;
export const MAX_ZOOM = 16;

export function clampMediaDimensions(nw: number, nh: number): { w: number; h: number } {
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) {
    return { w: 400, h: 300 };
  }
  const scale = Math.min(1, MAX_MEDIA_DIM / Math.max(nw, nh));
  return { w: Math.round(nw * scale), h: Math.round(nh * scale) };
}

/** Pan/zoom so the node is centered and as large as fits in the viewport (world space). */
export function fitNodeInViewport(
  node: CanvasNode,
  viewportEl: HTMLDivElement,
): { pan: CanvasPoint; zoom: number } {
  const r = viewportEl.getBoundingClientRect();
  const vw = r.width;
  const vh = r.height;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const margin = 0.9;
  const zoomFitX = (vw * margin) / Math.max(1, node.width);
  const zoomFitY = (vh * margin) / Math.max(1, node.height);
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zoomFitX, zoomFitY)));
  return {
    pan: {
      x: vw / 2 - cx * newZoom,
      y: vh / 2 - cy * newZoom,
    },
    zoom: newZoom,
  };
}

/** Fit the bounding box of several nodes (same math as a single virtual card). */
export function fitNodesInViewport(
  nodes: CanvasNode[],
  viewportEl: HTMLDivElement,
): { pan: CanvasPoint; zoom: number } | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const virtual: CanvasNode = {
    id: "__fit__",
    kind: "note",
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    title: "",
  };
  return fitNodeInViewport(virtual, viewportEl);
}

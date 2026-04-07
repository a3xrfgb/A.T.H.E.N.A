import {
  Code2,
  FileText,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Music,
  StickyNote,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { saveCanvasState, loadCanvasState } from "./canvasStorage";
import { cn } from "../../lib/utils";
import type {
  CanvasNode,
  CanvasNodeKind,
  CanvasPoint,
  CanvasPersistedState,
} from "../../types/canvasWorkspace";
import { useUiStore } from "../../store/uiStore";
import { useTranslation } from "../../i18n/I18nContext";
import {
  formatBytes,
  hydrateMediaUrlFromFilePath,
  isTauri,
  nodePartialFromAbsolutePath,
  subscribeTauriFileDrop,
} from "../../lib/canvasFileDrop";
import { documentPartialFromBrowserFile } from "../../lib/canvasDocumentPreview";
import { CanvasEpubViewer } from "./CanvasEpubViewer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_HEADER_H,
  clampMediaDimensions,
  fitNodesInViewport,
} from "../../lib/canvasViewportMath";
const WORLD = 12_000;

/** Pixels — start moving the node only after this, so clicks / scroll / controls still work. */
const NODE_DRAG_THRESHOLD_PX = 6;

/** Distinguish empty-canvas click (clear selection) from marquee drag. */
const MARQUEE_THRESHOLD_PX = 4;

const IMAGE_DATA_URL_MAX = 6 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function uid(): string {
  return crypto.randomUUID();
}

const DRAG_MIME = "application/x-athena-canvas";

export function CanvasWorkspace() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState<CanvasPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef<string[]>([]);
  /** video / audio elements for Enter → play */
  const mediaPlayRef = useRef<Map<string, HTMLMediaElement>>(new Map());

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  /** Multi-node drag: same delta applied to all selected origins. */
  const draggingNode = useRef<{
    ids: string[];
    origins: Map<string, CanvasPoint>;
    pointerStartWorld: CanvasPoint;
  } | null>(null);
  const pendingNodeDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);

  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const marqueeSessionRef = useRef<{
    pointerId: number;
    startWx: number;
    startWy: number;
    shiftKey: boolean;
    clientX: number;
    clientY: number;
  } | null>(null);
  const marqueeRectRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  /** Nodes the user resized manually — skip auto image/video dimension sync so load metadata doesn't reset size. */
  const userResizedNodeIdsRef = useRef<Set<string>>(new Set());

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): CanvasPoint => {
      const el = viewportRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: (clientX - r.left - pan.x) / zoom,
        y: (clientY - r.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const saved = loadCanvasState();
    if (saved?.pan && typeof saved.zoom === "number") {
      setPan(saved.pan);
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, saved.zoom)));
      if (saved.nodes) {
        setNodes(
          isTauri() ? saved.nodes.map((n) => hydrateMediaUrlFromFilePath(n)) : saved.nodes,
        );
      }
    } else {
      setPan({ x: r.width / 2 - WORLD / 2, y: r.height / 2 - WORLD / 2 });
    }
  }, []);

  useEffect(() => {
    const state: CanvasPersistedState = { pan, zoom, nodes };
    const id = window.setTimeout(() => saveCanvasState(state), 400);
    return () => clearTimeout(id);
  }, [pan, zoom, nodes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const applyMediaDimensionsFromNatural = useCallback((id: string, nw: number, nh: number) => {
    if (userResizedNodeIdsRef.current.has(id)) return;
    const { w: rw, h: rh } = clampMediaDimensions(nw, nh);
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== id) return node;
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const newW = rw;
        const newH = NODE_HEADER_H + rh;
        return {
          ...node,
          x: cx - newW / 2,
          y: cy - newH / 2,
          width: newW,
          height: newH,
        };
      }),
    );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const remove = new Set(selectedIds);
        setNodes((prev) => prev.filter((n) => !remove.has(n.id)));
        setSelectedIds([]);
        return;
      }

      if (e.key === "Enter" && selectedIds.length > 0) {
        e.preventDefault();
        const vp = viewportRef.current;
        if (!vp) return;
        const selected = nodes.filter((n) => selectedIds.includes(n.id));
        if (selected.length === 0) return;

        const fit = fitNodesInViewport(selected, vp);
        if (fit) {
          setPan(fit.pan);
          setZoom(fit.zoom);
        }

        for (const node of selected) {
          if (node.kind === "video" || node.kind === "audio") {
            const el = mediaPlayRef.current.get(node.id);
            void el?.play().catch(() => {
              pushToast(t("canvas.media.playFailed"), "info");
            });
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, nodes, pushToast, t]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const wx = (mx - pan.x) / zoom;
      const wy = (my - pan.y) / zoom;
      const delta = -e.deltaY * 0.0015;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));
      setPan({ x: mx - wx * next, y: my - wy * next });
      setZoom(next);
    },
    [pan.x, pan.y, zoom],
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      setIsPanning(true);
      panStart.current = { x: clientX, y: clientY, px: pan.x, py: pan.y };
      if (pointerId != null && viewportRef.current) {
        try {
          viewportRef.current.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [pan.x, pan.y],
  );

  const onPointerMoveWorld = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning && panStart.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
        return;
      }

      const sess = marqueeSessionRef.current;
      if (sess && e.pointerId === sess.pointerId) {
        const cd = Math.hypot(e.clientX - sess.clientX, e.clientY - sess.clientY);
        if (cd >= MARQUEE_THRESHOLD_PX) {
          const w = clientToWorld(e.clientX, e.clientY);
          const minX = Math.min(sess.startWx, w.x);
          const minY = Math.min(sess.startWy, w.y);
          const maxX = Math.max(sess.startWx, w.x);
          const maxY = Math.max(sess.startWy, w.y);
          const r = {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
          };
          marqueeRectRef.current = r;
          setMarqueeRect(r);
        }
        return;
      }

      const w = clientToWorld(e.clientX, e.clientY);
      const pend = pendingNodeDragRef.current;
      if (pend && !draggingNode.current && e.pointerId === pend.pointerId) {
        const dx = e.clientX - pend.startX;
        const dy = e.clientY - pend.startY;
        if (Math.hypot(dx, dy) > NODE_DRAG_THRESHOLD_PX) {
          const sel = selectedIdsRef.current;
          const idsToMove = sel.includes(pend.id) ? [...sel] : [pend.id];
          const origins = new Map<string, CanvasPoint>();
          for (const id of idsToMove) {
            const node = nodesRef.current.find((x) => x.id === id);
            if (node) origins.set(id, { x: node.x, y: node.y });
          }
          draggingNode.current = {
            ids: idsToMove,
            origins,
            pointerStartWorld: w,
          };
          pendingNodeDragRef.current = null;
        }
      }

      if (draggingNode.current) {
        const d = draggingNode.current;
        const dx = w.x - d.pointerStartWorld.x;
        const dy = w.y - d.pointerStartWorld.y;
        setNodes((prev) =>
          prev.map((n) => {
            if (!d.ids.includes(n.id)) return n;
            const o = d.origins.get(n.id);
            if (!o) return n;
            return { ...n, x: o.x + dx, y: o.y + dy };
          }),
        );
      }
    },
    [clientToWorld, isPanning],
  );

  const endPointer = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
    }

    const ms = marqueeSessionRef.current;
    if (ms) {
      marqueeSessionRef.current = null;
      const rect = marqueeRectRef.current;
      marqueeRectRef.current = null;
      setMarqueeRect(null);

      if (rect && rect.w >= MARQUEE_THRESHOLD_PX && rect.h >= MARQUEE_THRESHOLD_PX) {
        const intersects = (n: CanvasNode) => {
          const nx2 = n.x + n.width;
          const ny2 = n.y + n.height;
          const rx2 = rect.x + rect.w;
          const ry2 = rect.y + rect.h;
          return !(rect.x > nx2 || rx2 < n.x || rect.y > ny2 || ry2 < n.y);
        };
        const ids = nodesRef.current.filter(intersects).map((n) => n.id);
        if (ms.shiftKey) {
          setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
        } else {
          setSelectedIds(ids);
        }
      } else if (!ms.shiftKey) {
        setSelectedIds([]);
      }
    }

    if (draggingNode.current) draggingNode.current = null;
    pendingNodeDragRef.current = null;
  }, [isPanning]);

  const onPointerDownCaptureViewport = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      beginPan(e.clientX, e.clientY, e.pointerId);
    },
    [beginPan],
  );

  const onPointerDownViewport = useCallback(
    (e: React.PointerEvent) => {
      if (spaceHeld && e.button === 0) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        beginPan(e.clientX, e.clientY, e.pointerId);
        return;
      }
      if (e.button !== 0 || spaceHeld) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const w = clientToWorld(e.clientX, e.clientY);
      marqueeSessionRef.current = {
        pointerId: e.pointerId,
        startWx: w.x,
        startWy: w.y,
        shiftKey: e.shiftKey,
        clientX: e.clientX,
        clientY: e.clientY,
      };
    },
    [beginPan, clientToWorld, spaceHeld],
  );

  const nodePointerDown = useCallback(
    (e: React.PointerEvent, n: CanvasNode) => {
      if (spaceHeld) return;
      if (e.button === 1) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;

      if (target.closest("a[href]")) {
        e.stopPropagation();
        return;
      }
      if (target.closest("[data-canvas-doc-scroll]")) {
        e.stopPropagation();
        return;
      }
      if (target.tagName === "EMBED" || target.closest("embed")) {
        e.stopPropagation();
        return;
      }
      if (target.tagName === "IFRAME" || target.closest("iframe")) {
        e.stopPropagation();
        return;
      }

      if (target.tagName === "VIDEO") {
        const v = target as HTMLVideoElement;
        const r = v.getBoundingClientRect();
        const y = e.clientY - r.top;
        if (y > r.height - 52) {
          e.stopPropagation();
          return;
        }
      }
      if (target.tagName === "AUDIO") {
        const a = target as HTMLAudioElement;
        const r = a.getBoundingClientRect();
        const y = e.clientY - r.top;
        if (y > r.height - 44) {
          e.stopPropagation();
          return;
        }
      }

      e.stopPropagation();
      const toggle = e.metaKey || e.ctrlKey;
      const add = e.shiftKey;
      setSelectedIds((prev) => {
        if (toggle) {
          return prev.includes(n.id) ? prev.filter((id) => id !== n.id) : [...prev, n.id];
        }
        if (add) {
          return prev.includes(n.id) ? prev : [...prev, n.id];
        }
        return [n.id];
      });
      pendingNodeDragRef.current = {
        id: n.id,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
    },
    [spaceHeld],
  );

  const addNode = useCallback(
    (
      partial: Omit<CanvasNode, "id" | "x" | "y" | "width" | "height"> & {
        width?: number;
        height?: number;
      },
      cx: number,
      cy: number,
    ) => {
      const defaults: Record<CanvasNodeKind, { w: number; h: number }> = {
        chat: { w: 220, h: 100 },
        document: { w: 260, h: 160 },
        image: { w: 280, h: 220 },
        video: { w: 320, h: 200 },
        audio: { w: 320, h: 96 },
        note: { w: 200, h: 120 },
        code: { w: 280, h: 160 },
      };
      const d = defaults[partial.kind];
      const w = partial.width ?? d.w;
      const h = partial.height ?? d.h;
      const { width: _pw, height: _ph, ...rest } = partial;
      setNodes((prev) => [
        ...prev,
        {
          ...(rest as Omit<CanvasNode, "id" | "x" | "y" | "width" | "height">),
          id: uid(),
          x: cx - w / 2,
          y: cy - h / 2,
          width: w,
          height: h,
        },
      ]);
    },
    [],
  );

  /**
   * Tauri: OS file drops use native events — HTML5 `dataTransfer.files` is often empty on Windows.
   * Add dropped files as canvas nodes (same handling as `nodePartialFromAbsolutePath` / browser drop).
   */
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void subscribeTauriFileDrop((paths, clientX, clientY) => {
      const vp = viewportRef.current;
      if (!vp || paths.length === 0) return;
      const rect = vp.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return;
      }
      void (async () => {
        let offset = 0;
        for (const filePath of paths) {
          try {
            const partial = await nodePartialFromAbsolutePath(filePath);
            const w = clientToWorld(clientX + offset, clientY + offset);
            offset += 32;
            addNode(partial, w.x, w.y);
          } catch {
            pushToast(t("chatInput.importDocFailed"), "error");
          }
        }
      })();
    }).then((fn) => {
      if (!cancelled) unlisten = fn;
      else fn();
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addNode, clientToWorld, pushToast, t]);

  const onDropViewport = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const w = clientToWorld(e.clientX, e.clientY);
      const files = e.dataTransfer.files;

      if (files && files.length > 0) {
        void (async () => {
          let offset = 0;
          for (const file of Array.from(files)) {
            const cx = w.x + offset;
            const cy = w.y + offset;
            offset += 32;
            try {
              if (file.type.startsWith("image/")) {
                let mediaUrl: string;
                if (file.size <= IMAGE_DATA_URL_MAX) {
                  mediaUrl = await readFileAsDataUrl(file);
                } else {
                  mediaUrl = URL.createObjectURL(file);
                  pushToast(t("canvas.drop.largeImage"), "info");
                }
                addNode(
                  {
                    kind: "image",
                    title: file.name,
                    subtitle: file.type || "image",
                    mediaUrl,
                    width: 300,
                    height: 240,
                  },
                  cx,
                  cy,
                );
              } else if (file.type.startsWith("video/")) {
                const mediaUrl = URL.createObjectURL(file);
                addNode(
                  {
                    kind: "video",
                    title: file.name,
                    subtitle: `${file.type || "video"} · ${formatBytes(file.size)}`,
                    mediaUrl,
                    width: 340,
                    height: 220,
                  },
                  cx,
                  cy,
                );
              } else if (file.type.startsWith("audio/")) {
                const mediaUrl = URL.createObjectURL(file);
                addNode(
                  {
                    kind: "audio",
                    title: file.name,
                    subtitle: `${file.type || "audio"} · ${formatBytes(file.size)}`,
                    mediaUrl,
                    width: 320,
                    height: 96,
                  },
                  cx,
                  cy,
                );
              } else {
                const doc = await documentPartialFromBrowserFile(file);
                addNode(
                  {
                    kind: "document",
                    title: file.name,
                    subtitle: doc.subtitle,
                    mediaUrl: doc.mediaUrl,
                    documentText: doc.documentText,
                    documentPreview: doc.documentPreview,
                    width: doc.width,
                    height: doc.height,
                  },
                  cx,
                  cy,
                );
              }
            } catch (err) {
              pushToast(String(err), "error");
            }
          }
        })();
        return;
      }

      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      try {
        const payload = JSON.parse(raw) as {
          kind: CanvasNodeKind;
          title: string;
          threadId?: string;
          subtitle?: string;
          code?: string;
        };
        addNode(
          {
            kind: payload.kind,
            title: payload.title,
            subtitle: payload.subtitle,
            threadId: payload.threadId,
            code: payload.code,
          },
          w.x,
          w.y,
        );
      } catch {
        /* ignore */
      }
    },
    [addNode, clientToWorld, pushToast, t],
  );

  const cursorClass =
    spaceHeld || isPanning
      ? "cursor-grab active:cursor-grabbing"
      : marqueeRect
        ? "cursor-crosshair"
        : "cursor-default";

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-[var(--app-bg)]">
      {/* Viewport */}
      <div
        ref={viewportRef}
        className={cn("relative min-h-0 flex-1 touch-none", cursorClass)}
        onPointerDownCapture={onPointerDownCaptureViewport}
        onWheel={onWheel}
        onPointerMove={onPointerMoveWorld}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          if (e.buttons === 0) endPointer();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDropViewport}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: WORLD,
            height: WORLD,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* Grid */}
          <div
            className="pointer-events-none absolute left-0 top-0 bg-[var(--app-bg)]"
            style={{
              width: WORLD,
              height: WORLD,
              backgroundImage: `
                linear-gradient(var(--app-border) 1px, transparent 1px),
                linear-gradient(90deg, var(--app-border) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
              opacity: 0.55,
            }}
          />

          {/* Interaction layer — empty-board clicks + dragover for file drop */}
          <div
            className="absolute left-0 top-0"
            style={{ width: WORLD, height: WORLD, zIndex: 2 }}
            onPointerDown={onPointerDownViewport}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
          />

          {marqueeRect ? (
            <div
              className="pointer-events-none absolute z-[5] rounded-md border-2 border-sky-500/90 bg-sky-400/15"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
              }}
              aria-hidden
            />
          ) : null}

          {/* Nodes */}
          <div className="absolute left-0 top-0" style={{ width: WORLD, height: WORLD, zIndex: 3 }}>
            {nodes.map((n) => {
              const isSel = selectedIds.includes(n.id);
              const mediaPad =
                n.kind === "image" ||
                n.kind === "video" ||
                n.kind === "audio" ||
                (n.kind === "document" && (n.documentPreview === "pdf" || n.documentPreview === "epub"));
              return (
                <div
                  key={n.id}
                  className={cn("pointer-events-auto absolute z-[3]", isSel && "z-[4]")}
                  style={{ left: n.x, top: n.y, width: n.width, height: n.height }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                >
                  <div
                    className={cn(
                      "flex h-full w-full cursor-grab flex-col overflow-hidden rounded-xl border bg-[var(--app-surface)] shadow-md active:cursor-grabbing",
                      isSel
                        ? "border-sky-500 ring-2 ring-sky-500/80"
                        : "border-[var(--app-border)]",
                    )}
                    onPointerDown={(e) => nodePointerDown(e, n)}
                  >
                  <div className="flex shrink-0 items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-bg)]/80 px-2 py-1.5">
                    <NodeIcon kind={n.kind} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--app-text)]">
                      {n.title}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden text-[11px] text-[var(--app-muted)]",
                      mediaPad ? "p-0" : "p-2",
                    )}
                  >
                    {n.kind === "image" && n.mediaUrl ? (
                      <img
                        src={n.mediaUrl}
                        alt=""
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        onLoad={(e) =>
                          applyMediaDimensionsFromNatural(
                            n.id,
                            e.currentTarget.naturalWidth,
                            e.currentTarget.naturalHeight,
                          )
                        }
                        className="block h-full w-full max-w-none object-contain"
                        style={{
                          imageRendering: "auto",
                          WebkitBackfaceVisibility: "hidden",
                          backfaceVisibility: "hidden",
                        }}
                      />
                    ) : n.kind === "video" && n.mediaUrl ? (
                      <video
                        ref={(el) => {
                          if (el) mediaPlayRef.current.set(n.id, el);
                          else mediaPlayRef.current.delete(n.id);
                        }}
                        src={n.mediaUrl}
                        className="block h-full w-full max-w-none object-contain"
                        controls
                        playsInline
                        preload="metadata"
                        draggable={false}
                        onLoadedMetadata={(e) =>
                          applyMediaDimensionsFromNatural(
                            n.id,
                            e.currentTarget.videoWidth,
                            e.currentTarget.videoHeight,
                          )
                        }
                        style={{
                          imageRendering: "auto",
                          WebkitBackfaceVisibility: "hidden",
                          backfaceVisibility: "hidden",
                        }}
                      />
                    ) : n.kind === "audio" && n.mediaUrl ? (
                      <audio
                        ref={(el) => {
                          if (el) mediaPlayRef.current.set(n.id, el);
                          else mediaPlayRef.current.delete(n.id);
                        }}
                        src={n.mediaUrl}
                        className="w-full px-2 pb-2 pt-1"
                        controls
                        preload="metadata"
                        draggable={false}
                      />
                    ) : n.kind === "document" ? (
                      n.documentPreview === "pdf" && n.mediaUrl ? (
                        <embed
                          src={n.mediaUrl}
                          type="application/pdf"
                          className="h-full min-h-[200px] w-full border-0 bg-[var(--app-bg)]"
                          title={n.title}
                        />
                      ) : n.documentPreview === "epub" && n.mediaUrl ? (
                        <div className="h-full min-h-[240px] w-full">
                          <CanvasEpubViewer src={n.mediaUrl} />
                        </div>
                      ) : (n.documentPreview === "markdown" || n.documentPreview === "text") &&
                        n.documentText != null ? (
                        n.documentPreview === "markdown" ? (
                          <div
                            data-canvas-doc-scroll
                            className="max-h-full max-w-none overflow-auto p-2 text-[13px] leading-relaxed text-[var(--app-text)] [&_a]:text-sky-600 [&_a]:underline dark:[&_a]:text-sky-400 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:text-[11px] dark:[&_code]:bg-white/10 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-black/10 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5"
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.documentText}</ReactMarkdown>
                          </div>
                        ) : (
                          <pre
                            data-canvas-doc-scroll
                            className="h-full overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[var(--app-text)]"
                          >
                            {n.documentText}
                          </pre>
                        )
                        ) : n.documentPreview === "unsupported" ? (
                        <div className="flex flex-col gap-1.5">
                          {n.subtitle ? <p>{n.subtitle}</p> : null}
                          <p className="text-[10px] leading-relaxed">{t("canvas.document.previewUnavailable")}</p>
                        </div>
                      ) : (
                        <span className="line-clamp-4">
                          {n.subtitle ?? t("canvas.node.preview.document")}
                        </span>
                      )
                    ) : n.kind === "code" && n.code ? (
                      <pre
                        data-canvas-doc-scroll
                        className="overflow-auto font-mono text-[10px] leading-relaxed text-[var(--app-text)]"
                      >
                        {n.code}
                      </pre>
                    ) : n.subtitle ? (
                      n.subtitle
                    ) : (
                      <span className="line-clamp-4">{t(`canvas.node.preview.${n.kind}`)}</span>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Brand corner */}
      <div className="pointer-events-none absolute bottom-3 right-4 z-10 flex items-center gap-1.5 text-[10px] text-[var(--app-muted)]">
        <Layers className="h-3.5 w-3.5 opacity-50" />
        {t("canvas.hint")}
      </div>
    </div>
  );
}

function NodeIcon({ kind }: { kind: CanvasNode["kind"] }) {
  const c = "h-3.5 w-3.5 shrink-0 opacity-80";
  switch (kind) {
    case "chat":
      return <MessageSquare className={c} />;
    case "document":
      return <FileText className={c} />;
    case "image":
      return <ImageIcon className={c} />;
    case "video":
      return <Video className={c} />;
    case "audio":
      return <Music className={c} />;
    case "note":
      return <StickyNote className={c} />;
    case "code":
      return <Code2 className={c} />;
    default:
      return <Layers className={c} />;
  }
}

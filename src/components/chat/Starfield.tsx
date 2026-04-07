import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

type StarRow = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  boolean,
];

type Sd = {
  w: number;
  h: number;
  ctx: CanvasRenderingContext2D | null;
  cw: number;
  ch: number;
  x: number;
  y: number;
  z: number;
  star: { colorRatio: number; arr: StarRow[] };
  prevTime: number;
};

export type StarfieldProps = {
  /** Optional root for measuring size & mouse coords (e.g. new-chat panel). Falls back to canvas parent. */
  panelRef?: RefObject<HTMLElement | null>;
  starColor?: string;
  bgColor?: string;
  mouseAdjust?: boolean;
  tiltAdjust?: boolean;
  easing?: number;
  clickToWarp?: boolean;
  hyperspace?: boolean;
  warpFactor?: number;
  opacity?: number;
  speed?: number;
  quantity?: number;
  className?: string;
};

export function Starfield({
  panelRef,
  starColor = "rgba(255,255,255,1)",
  bgColor = "rgba(0,0,0,1)",
  mouseAdjust = false,
  tiltAdjust = false,
  easing = 1,
  clickToWarp = false,
  hyperspace = false,
  warpFactor = 10,
  opacity = 0.1,
  speed = 1,
  quantity = 512,
  className,
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpActiveRef = useRef(false);
  const mouse = useRef({ x: 0, y: 0 });
  const cursor = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const hyperspacePropRef = useRef(hyperspace);
  hyperspacePropRef.current = hyperspace;

  const sd = useRef<Sd>({
    w: 0,
    h: 0,
    ctx: null,
    cw: 0,
    ch: 0,
    x: 0,
    y: 0,
    z: 0,
    star: { colorRatio: 0, arr: [] },
    prevTime: 0,
  });

  const ratio = quantity / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getRoot = () =>
      panelRef?.current ?? canvas.parentElement;

    const measureViewport = () => {
      const el = getRoot();
      if (!el) return;
      const s = sd.current;
      s.w = el.clientWidth;
      s.h = el.clientHeight;
      s.x = Math.round(s.w / 2);
      s.y = Math.round(s.h / 2);
      s.z = (s.w + s.h) / 2;
      s.star.colorRatio = 1 / s.z;

      if (cursor.current.x === 0 || cursor.current.y === 0) {
        cursor.current.x = s.x;
        cursor.current.y = s.y;
      }
      if (mouse.current.x === 0 || mouse.current.y === 0) {
        mouse.current.x = cursor.current.x - s.x;
        mouse.current.y = cursor.current.y - s.y;
      }
    };

    const getHyperspaceMode = () =>
      hyperspacePropRef.current || warpActiveRef.current;

    const setupCanvas = () => {
      measureViewport();
      const s = sd.current;
      const c = canvasRef.current;
      if (!c) return;
      s.ctx = c.getContext("2d");
      if (!s.ctx) return;
      c.width = s.w;
      c.height = s.h;
      const fill = getHyperspaceMode()
        ? `rgba(0,0,0,${opacity})`
        : bgColor;
      s.ctx.fillStyle = fill;
      s.ctx.strokeStyle = starColor;
    };

    const bigBang = () => {
      const s = sd.current;
      if (s.star.arr.length !== quantity) {
        s.star.arr = Array.from({ length: quantity }, () => [
          Math.random() * s.w * 2 - s.x * 2,
          Math.random() * s.h * 2 - s.y * 2,
          Math.round(Math.random() * s.z),
          0,
          0,
          0,
          0,
          true,
        ]) as StarRow[];
      }
    };

    const resize = () => {
      const s = sd.current;
      const oldStar = { ...s.star };
      measureViewport();
      s.cw = s.ctx?.canvas.width ?? 0;
      s.ch = s.ctx?.canvas.height ?? 0;

      if (s.cw !== s.w || s.ch !== s.h) {
        s.x = Math.round(s.w / 2);
        s.y = Math.round(s.h / 2);
        s.z = (s.w + s.h) / 2;
        s.star.colorRatio = 1 / s.z;

        const rw = s.w / (s.cw || 1);
        const rh = s.h / (s.ch || 1);

        const c = canvasRef.current;
        if (c && s.ctx) {
          c.width = s.w;
          c.height = s.h;
        }

        if (!oldStar.arr.length) {
          bigBang();
        } else {
          s.star.arr = oldStar.arr.map((star, i) => {
            const newStar = [...star] as unknown as StarRow;
            newStar[0] = oldStar.arr[i]![0] * rw;
            newStar[1] = oldStar.arr[i]![1] * rh;
            newStar[3] = s.x + (newStar[0] / newStar[2]) * ratio;
            newStar[4] = s.y + (newStar[1] / newStar[2]) * ratio;
            return newStar;
          });
        }

        const fill = getHyperspaceMode()
          ? `rgba(0,0,0,${opacity})`
          : bgColor;
        if (s.ctx) {
          s.ctx.fillStyle = fill;
          s.ctx.strokeStyle = starColor;
        }
      }
    };

    const update = () => {
      const s = sd.current;
      const hs = hyperspacePropRef.current || warpActiveRef.current;
      const compSpeed = hs ? speed * warpFactor : speed;

      mouse.current.x = (cursor.current.x - s.x) / easing;
      mouse.current.y = (cursor.current.y - s.y) / easing;

      if (s.star.arr.length > 0) {
        s.star.arr = s.star.arr.map((star) => {
          const newStar = [...star] as unknown as StarRow;
          newStar[7] = true;
          newStar[5] = newStar[3];
          newStar[6] = newStar[4];
          newStar[0] += mouse.current.x >> 6;

          if (newStar[0] > s.x << 1) {
            newStar[0] -= s.w << 1;
            newStar[7] = false;
          }
          if (newStar[0] < -s.x << 1) {
            newStar[0] += s.w << 1;
            newStar[7] = false;
          }

          newStar[1] += mouse.current.y >> 6;
          if (newStar[1] > s.y << 1) {
            newStar[1] -= s.h << 1;
            newStar[7] = false;
          }
          if (newStar[1] < -s.y << 1) {
            newStar[1] += s.h << 1;
            newStar[7] = false;
          }

          newStar[2] -= compSpeed;
          if (newStar[2] > s.z) {
            newStar[2] -= s.z;
            newStar[7] = false;
          }
          if (newStar[2] < 0) {
            newStar[2] += s.z;
            newStar[7] = false;
          }

          newStar[3] = s.x + (newStar[0] / newStar[2]) * ratio;
          newStar[4] = s.y + (newStar[1] / newStar[2]) * ratio;
          return newStar;
        });
      }
    };

    const draw = () => {
      const s = sd.current;
      const ctx = s.ctx;
      if (!ctx) return;

      const fill = getHyperspaceMode()
        ? `rgba(0,0,0,${opacity})`
        : bgColor;
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, s.w, s.h);
      ctx.strokeStyle = starColor;

      s.star.arr.forEach((star) => {
        if (
          star[5] > 0 &&
          star[5] < s.w &&
          star[6] > 0 &&
          star[6] < s.h &&
          star[7]
        ) {
          ctx.lineWidth = (1 - s.star.colorRatio * star[2]) * 2;
          ctx.beginPath();
          ctx.moveTo(star[5], star[6]);
          ctx.lineTo(star[3], star[4]);
          ctx.stroke();
          ctx.closePath();
        }
      });
    };

    const animate = () => {
      sd.current.prevTime = sd.current.prevTime || Date.now();
      resize();
      update();
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const init = () => {
      measureViewport();
      setupCanvas();
      bigBang();
      animate();
    };

    const stop = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const mouseHandler = (event: MouseEvent) => {
      const el = getRoot();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      cursor.current.x = event.clientX - rect.left;
      cursor.current.y = event.clientY - rect.top;
    };

    const tiltHandler = (event: DeviceOrientationEvent) => {
      const s = sd.current;
      if (event.beta != null && event.gamma != null) {
        const x = event.gamma;
        const y = event.beta;
        cursor.current.x = s.w / 2 + (x ?? 0) * 5;
        cursor.current.y = s.h / 2 + (y ?? 0) * 5;
      }
    };

    const onMouseDown = () => {
      warpActiveRef.current = true;
    };
    const onMouseUp = () => {
      warpActiveRef.current = false;
    };

    const root = getRoot();

    if (mouseAdjust) {
      window.addEventListener("mousemove", mouseHandler);
    }
    if (tiltAdjust) {
      window.addEventListener("deviceorientation", tiltHandler);
    }
    if (clickToWarp && root) {
      root.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mouseup", onMouseUp);
    }

    init();

    return () => {
      stop();
      sd.current.star.arr = [];
      if (mouseAdjust) {
        window.removeEventListener("mousemove", mouseHandler);
      }
      if (tiltAdjust) {
        window.removeEventListener("deviceorientation", tiltHandler);
      }
      if (clickToWarp && root) {
        root.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mouseup", onMouseUp);
      }
    };
  }, [
    panelRef,
    mouseAdjust,
    tiltAdjust,
    clickToWarp,
    bgColor,
    starColor,
    easing,
    hyperspace,
    opacity,
    speed,
    warpFactor,
    quantity,
  ]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

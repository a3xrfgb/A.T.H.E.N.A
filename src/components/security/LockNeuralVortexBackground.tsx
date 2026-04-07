import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

type PointerState = { x: number; y: number; tX: number; tY: number };

/**
 * Full-viewport WebGL neural vortex (grayscale) for the lock screen backdrop.
 */
export function LockNeuralVortexBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<PointerState>({ x: 0, y: 0, tX: 0, tY: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const gl = canvasEl.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      console.error("WebGL not available for lock background");
      return;
    }

    const vsSource = `
      precision mediump float;
      attribute vec2 a_position;
      varying vec2 vUv;
      void main() {
        vUv = .5 * (a_position + 1.);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_ratio;
      uniform vec2 u_pointer_position;
      uniform float u_scroll_progress;

      vec2 rotate(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
      }

      float neuro_shape(vec2 uv, float t, float p) {
        vec2 sine_acc = vec2(0.);
        vec2 res = vec2(0.);
        float scale = 8.;
        for (int j = 0; j < 15; j++) {
          uv = rotate(uv, 1.);
          sine_acc = rotate(sine_acc, 1.);
          vec2 layer = uv * scale + float(j) + sine_acc - t;
          sine_acc += sin(layer) + 2.4 * p;
          res += (.5 + .5 * cos(layer)) / scale;
          scale *= (1.2);
        }
        return res.x + res.y;
      }

      void main() {
        vec2 uv = .5 * vUv;
        uv.x *= u_ratio;
        vec2 ptr = vUv - u_pointer_position;
        ptr.x *= u_ratio;
        float p = clamp(length(ptr), 0., 1.);
        p = .5 * pow(1. - p, 2.);
        float t = .001 * u_time;
        float noise = neuro_shape(uv, t, p);
        noise = 1.2 * pow(noise, 3.);
        noise += pow(noise, 10.);
        noise = max(.0, noise - .5);
        noise *= (1. - length(vUv - .5));
        float scrollPulse = 0.5 + 0.5 * sin(2.0 * u_scroll_progress + 1.2);
        float scrollFine = 0.06 * sin(2.0 * u_scroll_progress + 1.5);
        float lum = mix(0.1, 0.78, scrollPulse) + scrollFine;
        float gray = clamp(lum * noise, 0.0, 1.0);
        gl_FragColor = vec4(vec3(gray), noise);
      }
    `;

    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Lock shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Lock program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRatio = gl.getUniformLocation(program, "u_ratio");
    const uPointerPosition = gl.getUniformLocation(program, "u_pointer_position");
    const uScrollProgress = gl.getUniformLocation(program, "u_scroll_progress");

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvasEl.width = Math.max(1, Math.floor(w * dpr));
      canvasEl.height = Math.max(1, Math.floor(h * dpr));
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      gl.uniform1f(uRatio, canvasEl.width / canvasEl.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const render = () => {
      const currentTime = performance.now();
      pointer.current.x += (pointer.current.tX - pointer.current.x) * 0.2;
      pointer.current.y += (pointer.current.tY - pointer.current.y) * 0.2;

      gl.uniform1f(uTime, currentTime);
      gl.uniform2f(
        uPointerPosition,
        pointer.current.x / window.innerWidth,
        1 - pointer.current.y / window.innerHeight,
      );
      gl.uniform1f(uScrollProgress, window.scrollY / (2 * window.innerHeight));

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };

    render();

    const handlePointerMove = (e: PointerEvent) => {
      pointer.current.tX = e.clientX;
      pointer.current.tY = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        pointer.current.tX = touch.clientX;
        pointer.current.tY = touch.clientY;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full object-cover opacity-95",
        className,
      )}
    />
  );
}

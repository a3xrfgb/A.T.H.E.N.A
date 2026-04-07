import { cn } from "./utils";

/** DOM id for the main content column (portal target for canvas-scoped UI). */
export const APP_CANVAS_PORTAL_ID = "athena-app-canvas";

/** Full-window frosted scrim — pair with `Dialog.Overlay`, fixed to viewport. */
export const glassModalOverlayClasses = cn(
  "fixed inset-0 z-[500] animate-first-launch-overlay",
  "bg-[var(--app-bg)]/50 backdrop-blur-md dark:bg-black/40",
);

/**
 * Radix `Dialog.Content` — centered, fixed to viewport (matches Create project / first-launch).
 * Includes `first-launch-onboarding-dialog` for hidden scrollbar styling.
 */
export const glassModalContentPositionClasses = cn(
  "first-launch-onboarding-dialog fixed left-1/2 top-1/2 z-[510] w-[min(92vw,380px)] max-h-[min(88vh,560px)] -translate-x-1/2 -translate-y-1/2",
  "overflow-y-auto overflow-x-hidden outline-none",
);

/** Slightly wider shell (e.g. new note). */
export const glassModalContentPositionWideClasses = cn(
  "first-launch-onboarding-dialog fixed left-1/2 top-1/2 z-[510] w-[min(92vw,400px)] max-h-[min(88vh,560px)] -translate-x-1/2 -translate-y-1/2",
  "overflow-y-auto overflow-x-hidden outline-none",
);

/** Inner frosted panel — blur, border light, pop-in animation. */
export const glassModalPanelClasses = cn(
  "animate-create-project-glass rounded-[22px] border shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)]",
  "border-white/40 bg-white/72 backdrop-blur-2xl backdrop-saturate-150",
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65),0_28px_90px_-32px_rgba(15,23,42,0.28)]",
  "dark:border-white/12 dark:bg-white/[0.07]",
  "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_32px_100px_-28px_rgba(0,0,0,0.75)]",
);

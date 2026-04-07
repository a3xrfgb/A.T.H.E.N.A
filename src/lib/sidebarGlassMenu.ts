import { cn } from "./utils";

/** Radix dropdown / context menu panel — frosted, minimal. */
export const sidebarGlassMenuContent = cn(
  "z-[320] min-w-[10.5rem] overflow-hidden rounded-2xl p-1",
  "border border-black/[0.09] bg-white/72 backdrop-blur-2xl backdrop-saturate-150",
  "shadow-[0_20px_50px_-16px_rgba(15,23,42,0.28),inset_0_1px_0_0_rgba(255,255,255,0.7)]",
  "dark:border-white/12 dark:bg-white/[0.08] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_24px_60px_-20px_rgba(0,0,0,0.55)]",
);

export const sidebarGlassMenuSubContent = cn(
  sidebarGlassMenuContent,
  "min-w-[9.5rem]",
);

/** Row item — compact, theme-aware via sidebar CSS variables. */
export const sidebarGlassMenuItem = cn(
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-tight outline-none",
  "text-[var(--sidebar-text)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  "data-[highlighted]:bg-black/[0.07] dark:data-[highlighted]:bg-white/[0.12]",
);

export const sidebarGlassMenuSeparator = "my-0.5 h-px bg-black/[0.08] dark:bg-white/12";

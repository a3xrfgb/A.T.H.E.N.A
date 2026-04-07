import { cn } from "../../lib/utils";

/**
 * Frosted glass trigger for Settings selects (used with Radix Select).
 */
export const settingsGlassSelectClassName = cn(
  "rounded-xl border text-sm text-[var(--app-text)] outline-none transition duration-300 ease-out",
  "border-white/55 bg-gradient-to-b from-white/55 via-white/38 to-white/28",
  "backdrop-blur-xl backdrop-saturate-150",
  // Layered soft drop shadow: contact + ambient falloff
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.72),0_2px_6px_-1px_rgba(15,23,42,0.06),0_8px_24px_-4px_rgba(15,23,42,0.1),0_20px_48px_-12px_rgba(15,23,42,0.08)]",
  "focus:border-accent/45 focus:ring-2 focus:ring-accent/18",
  "focus:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_3px_10px_-2px_rgba(15,23,42,0.08),0_12px_32px_-6px_rgba(15,23,42,0.12),0_28px_56px_-14px_rgba(15,23,42,0.1)]",
  "dark:border-white/[0.14] dark:from-white/[0.12] dark:via-white/[0.08] dark:to-white/[0.05]",
  "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_3px_10px_-2px_rgba(0,0,0,0.4),0_10px_32px_-6px_rgba(0,0,0,0.35),0_24px_56px_-14px_rgba(0,0,0,0.28)]",
  "dark:focus:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_4px_14px_-2px_rgba(0,0,0,0.45),0_14px_40px_-6px_rgba(0,0,0,0.38),0_32px_64px_-14px_rgba(0,0,0,0.32)]",
  "dark:focus:border-accent/50 dark:focus:ring-accent/22",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** Dropdown panel: frosted glass (Radix Select.Content). */
export const settingsGlassSelectContentClassName = cn(
  "z-[520] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border p-1.5",
  // Translucent stack + strong blur so content behind shows through
  "border-white/60 bg-gradient-to-b from-white/[0.55] via-white/[0.38] to-white/[0.22]",
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]",
  "backdrop-blur-2xl backdrop-saturate-[1.35]",
  "ring-1 ring-white/50 ring-inset",
  "shadow-[0_4px_24px_-2px_rgba(15,23,42,0.12),0_18px_48px_-12px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.35)_inset]",
  "dark:border-white/[0.18]",
  "dark:bg-gradient-to-b dark:from-white/[0.12] dark:via-zinc-950/45 dark:to-zinc-950/65",
  "dark:ring-white/[0.12]",
  "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_8px_32px_-4px_rgba(0,0,0,0.55),0_24px_56px_-14px_rgba(0,0,0,0.45)]",
);

/** Single option row in the glass dropdown. */
export const settingsGlassSelectItemClassName = cn(
  "relative flex cursor-pointer select-none items-center rounded-xl px-2.5 py-2.5 pr-8 text-sm text-[var(--app-text)] outline-none transition-colors duration-150",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  // Keyboard hover: glass chip instead of flat gray
  "data-[highlighted]:bg-white/55 data-[highlighted]:text-[var(--app-text)]",
  "data-[highlighted]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65)]",
  "data-[highlighted]:backdrop-blur-md",
  "dark:data-[highlighted]:bg-white/[0.14] dark:data-[highlighted]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
  "data-[state=checked]:font-semibold",
);

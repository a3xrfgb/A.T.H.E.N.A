/**
 * Settings selection: light mode = solid #ff4900; dark mode = animated #3B63A8 ↔ #000000 sweep.
 * Toggles: full track background. Sidebar nav active item: `before:` layer in SettingsModal.
 */

/** Light (on): solid orange. Dark (on): same animated gradient as nav selection. */
export const settingsToggleOnLightBg = "bg-[#ff4900]";

/** Toggle track (dark only): gradient + size for sweep animation (see tailwind `settings-selection-gradient`). */
export const settingsToggleGradientBg =
  "dark:bg-[length:200%_100%] dark:bg-[linear-gradient(90deg,#3B63A8_0%,#000000_50%,#3B63A8_100%)]";

/**
 * Active settings nav `before:` layer — solid orange in light; animated gradient in dark.
 */
export const settingsNavActiveBeforeGradient =
  "before:bg-[#ff4900] dark:before:bg-[length:200%_100%] dark:before:bg-[linear-gradient(90deg,#3B63A8_0%,#000000_50%,#3B63A8_100%)] dark:before:animate-settings-selection-gradient motion-reduce:dark:before:animate-none";

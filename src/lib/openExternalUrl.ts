import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

/** Opens a URL in the system default browser (Tauri) or a new tab (web dev). */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    await open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

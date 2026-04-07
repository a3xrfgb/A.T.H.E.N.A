import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

/** Tracks whether the Tauri window is maximized (for chrome + rounded shell). */
export function useWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    const w = getCurrentWindow();
    let disposed = false;

    void w.isMaximized().then((m) => {
      if (!disposed) setMaximized(m);
    });

    const p = w.onResized(() => {
      void w.isMaximized().then((m) => {
        if (!disposed) setMaximized(m);
      });
    });

    return () => {
      disposed = true;
      void p.then((unlisten) => unlisten());
    };
  }, []);

  return maximized;
}

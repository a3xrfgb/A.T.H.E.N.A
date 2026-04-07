import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type { DownloadProgress } from "../types/model";
import { useModelStore } from "../store/modelStore";

export function useDownloadProgress() {
  const setDownloadProgress = useModelStore((s) => s.setDownloadProgress);

  useEffect(() => {
    let un: (() => void) | undefined;
    (async () => {
      un = await listen<DownloadProgress>("athena-download-progress", (e) => {
        const p = e.payload;
        if (p?.modelId) {
          setDownloadProgress(p.modelId, p);
          if (p.status === "complete" || p.status === "error") {
            window.setTimeout(() => {
              useModelStore.getState().clearDownloadProgress([p.modelId]);
            }, 900);
          }
        }
      });
    })();
    return () => {
      un?.();
    };
  }, [setDownloadProgress]);
}

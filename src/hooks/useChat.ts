import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useChatStore } from "../store/chatStore";

export function useChatEvents() {
  useEffect(() => {
    let un: (() => void) | undefined;
    (async () => {
      un = await listen<{ threadId: string; token: string; kind?: string }>("athena-token", (e) => {
        const p = e.payload;
        if (p?.threadId && p.token) {
          const kind = p.kind === "reasoning" ? "reasoning" : "content";
          useChatStore.getState().appendToken(p.threadId, p.token, kind);
        }
      });
    })();
    return () => {
      un?.();
    };
  }, []);
}

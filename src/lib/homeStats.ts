import type { Message, Thread } from "../types/chat";
import { parseUserMessageContent } from "./userMessageContent";

const WEEK_MS = 7 * 86_400_000;

/** Stats from message rows already in memory (open / recently viewed threads). */
export function aggregateHomeWeekStats(
  threads: Thread[],
  messagesByThread: Record<string, Message[]>,
): {
  userMsgs: number;
  assistantMsgs: number;
  imageSends: number;
  focusHours: number;
  hasLoadedWeekData: boolean;
} {
  const weekAgo = Date.now() - WEEK_MS;
  let userMsgs = 0;
  let assistantMsgs = 0;
  let imageSends = 0;

  for (const th of threads) {
    const list = messagesByThread[th.id];
    if (!list?.length) continue;
    for (const m of list) {
      if (m.createdAt < weekAgo) continue;
      if (m.role === "user") {
        userMsgs++;
        const p = parseUserMessageContent(m.content);
        if (p.imageDataUrl || p.legacyImageOnly) imageSends++;
      } else if (m.role === "assistant") {
        assistantMsgs++;
      }
    }
  }

  const roughMinutes = userMsgs * 2.5 + assistantMsgs * 1.2;
  const focusHours = Math.min(24, Math.round((roughMinutes / 60) * 10) / 10);

  const hasLoadedWeekData = userMsgs > 0 || assistantMsgs > 0 || imageSends > 0;

  return {
    userMsgs,
    assistantMsgs,
    imageSends,
    focusHours,
    hasLoadedWeekData,
  };
}

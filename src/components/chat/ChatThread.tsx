import { useCallback, useEffect, useRef } from "react";
import type { Message } from "../../types/chat";
import { useChatStore } from "../../store/chatStore";
import { ChatMessageBubble } from "./ChatMessage";

/** If the user is within this many pixels of the bottom, new tokens keep auto-scrolling. */
const STICK_TO_BOTTOM_THRESHOLD_PX = 100;

export function ChatThread({
  messages,
  streamingText,
  isStreaming,
  threadId,
}: {
  messages: Message[];
  streamingText?: string;
  isStreaming: boolean;
  threadId: string | null;
}) {
  const streamingReasoning = useChatStore((s) =>
    threadId ? s.streamingReasoning[threadId] ?? "" : "",
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** When false, streaming updates must not yank scroll (user scrolled up to read). */
  const stickToBottomRef = useRef(true);

  const updateStickFromScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    stickToBottomRef.current = distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateStickFromScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateStickFromScroll);
  }, [updateStickFromScroll]);

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [threadId]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    // `auto` avoids stacking smooth-scroll animations while tokens stream.
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, streamingText, streamingReasoning, isStreaming]);

  const rows: Message[] = [...messages];
  if (isStreaming && streamingText !== undefined && threadId) {
    rows.push({
      id: "streaming",
      threadId,
      role: "assistant",
      content: streamingText,
      createdAt: Date.now(),
    });
  }

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Centered column — ~768px max, comfortable reading width */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-8">
        {rows.map((m) => (
          <ChatMessageBubble
            key={m.id + String(m.createdAt)}
            message={m}
            streaming={m.id === "streaming" && isStreaming}
            streamingReasoningText={
              m.id === "streaming" && isStreaming ? streamingReasoning : undefined
            }
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

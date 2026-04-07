/** Assistant `content` may be JSON v1 from the Rust backend (thinking + final + stats). */

export type AssistantPayloadV1 = {
  v?: number;
  thinking?: string;
  final?: string;
  genMs?: number;
  tokensPerSec?: number;
  completionTokens?: number;
  promptTokens?: number;
  finishReason?: string;
};

export function parseAssistantMessageContent(raw: string): {
  displayFinal: string;
  thinking: string;
  genMs?: number;
  tokensPerSec?: number;
  completionTokens?: number;
  promptTokens?: number;
  finishReason?: string;
  isStructured: boolean;
} {
  const t = raw.trim();
  if (!t.startsWith("{")) {
    return { displayFinal: raw, thinking: "", isStructured: false };
  }
  try {
    const j = JSON.parse(t) as AssistantPayloadV1;
    if (j.v !== 1 && j.final === undefined && j.thinking === undefined) {
      return { displayFinal: raw, thinking: "", isStructured: false };
    }
    const finalText = typeof j.final === "string" ? j.final : "";
    const thinking = typeof j.thinking === "string" ? j.thinking : "";
    return {
      displayFinal: finalText || raw,
      thinking,
      genMs: typeof j.genMs === "number" ? j.genMs : undefined,
      tokensPerSec: typeof j.tokensPerSec === "number" ? j.tokensPerSec : undefined,
      completionTokens: typeof j.completionTokens === "number" ? j.completionTokens : undefined,
      promptTokens: typeof j.promptTokens === "number" ? j.promptTokens : undefined,
      finishReason: typeof j.finishReason === "string" ? j.finishReason : undefined,
      isStructured: true,
    };
  } catch {
    return { displayFinal: raw, thinking: "", isStructured: false };
  }
}

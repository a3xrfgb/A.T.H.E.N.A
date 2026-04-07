/** User message `content` may be JSON v1 `{ v:1, text, image }` for vision, or v2 with file attachments (legacy). */

export type UserAttachment = {
  name: string;
  mime: string;
  /** Raw file bytes as standard base64 (no data: prefix). */
  dataBase64: string;
  /** Text extracted client-side for the model (PDF, txt, md, json). */
  extractedText?: string;
};

export type ParsedUserMessage = {
  text: string;
  imageDataUrl?: string;
  /** Older DB rows used the literal `[Image]` with no data */
  legacyImageOnly?: boolean;
  isStructured: boolean;
  version?: 1 | 2;
  attachments?: UserAttachment[];
};

export function parseUserMessageContent(raw: string): ParsedUserMessage {
  const t = raw.trim();
  if (t === "[Image]") {
    return { text: "", legacyImageOnly: true, isStructured: false };
  }
  if (!t.startsWith("{")) {
    return { text: raw, isStructured: false };
  }
  try {
    const j = JSON.parse(t) as {
      v?: number;
      text?: string;
      image?: string;
      attachments?: UserAttachment[];
    };
    if (j.v === 2) {
      return {
        text: typeof j.text === "string" ? j.text : "",
        imageDataUrl: typeof j.image === "string" && j.image.length > 0 ? j.image : undefined,
        attachments: Array.isArray(j.attachments) ? j.attachments : [],
        isStructured: true,
        version: 2,
      };
    }
    if (j.v === 1 && typeof j.image === "string" && j.image.length > 0) {
      return {
        text: typeof j.text === "string" ? j.text : "",
        imageDataUrl: j.image,
        isStructured: true,
        version: 1,
      };
    }
  } catch {
    /* fall through */
  }
  return { text: raw, isStructured: false };
}

/** Matches Rust `user_content_for_database` for optimistic UI before reload. */
export function serializeUserMessageForStorage(
  text: string,
  imageDataUrl: string | null | undefined,
): string {
  if (!imageDataUrl?.trim()) return text;
  if (!text.trim()) {
    return JSON.stringify({ v: 1, text: "", image: imageDataUrl });
  }
  return JSON.stringify({ v: 1, text: text.trim(), image: imageDataUrl });
}

/** Strip UI-only fields before DB / API (lineCount, badge, etc.). */
export function toStorageAttachment(a: UserAttachment): UserAttachment {
  const { name, mime, dataBase64, extractedText } = a;
  return {
    name,
    mime,
    dataBase64,
    ...(extractedText != null && extractedText.length > 0 ? { extractedText } : {}),
  };
}

/** Builds the string stored in SQLite and sent to `stream_chat` as `content`. */
export function buildSerializedUserMessage(
  caption: string,
  imageDataUrl: string | null | undefined,
  attachments?: UserAttachment[] | null,
): string {
  const att =
    attachments
      ?.filter((a) => a?.name && a.dataBase64 != null)
      .map(toStorageAttachment) ?? [];
  if (att.length === 0) {
    return serializeUserMessageForStorage(caption, imageDataUrl);
  }
  const payload: Record<string, unknown> = {
    v: 2,
    text: typeof caption === "string" ? caption : "",
    attachments: att,
  };
  if (imageDataUrl?.trim()) {
    payload.image = imageDataUrl;
  }
  return JSON.stringify(payload);
}

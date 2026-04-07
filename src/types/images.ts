export type ImageSourceKey = "reve" | "sora" | "nanoBanana" | "midjourney";

export type GalleryImage = {
  src: string;
  href?: string | null;
  source: "reve" | "nanoBanana" | "midjourney";
  /** Stable row id when `src` alone is not unique (e.g. YouMind card id). */
  title?: string | null;
  /** Present when the backend returns captions / prompt text. */
  prompt?: string | null;
};

export type NanoBananaPageResult = {
  items: GalleryImage[];
  total: number;
};


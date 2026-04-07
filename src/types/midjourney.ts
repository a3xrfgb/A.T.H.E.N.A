export type MidjourneyGalleryItem = {
  imageUrl: string;
};

export type MidjourneyPageResult = {
  items: MidjourneyGalleryItem[];
  total: number;
};

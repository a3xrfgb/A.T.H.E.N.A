export type SoraGalleryItem = {
  imageUrl: string;
  promptUrl: string;
};

export type SoraPageResult = {
  items: SoraGalleryItem[];
  total: number;
};

export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  parameters: string;
  quantization: string;
  format: string;
  localPath: string;
  isLoaded: boolean;
  /** From GGUF metadata when available. */
  maxContextTokens?: number | null;
  layerCount?: number | null;
}

export interface DownloadProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  status: "downloading" | "complete" | "error";
}

export interface RegistryModel {
  id: string;
  name: string;
  sizeLabel: string;
  parameters: string;
  kind: string;
  source: string;
  downloadUrl?: string | null;
}

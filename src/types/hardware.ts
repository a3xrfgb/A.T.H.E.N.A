export interface GpuInfo {
  name: string;
  vramTotalBytes: number | null;
  memoryUsedBytes: number | null;
  backend: string;
  deviceIndex: number;
}

export interface HardwareSnapshot {
  cpuName: string;
  cpuArch: string;
  cpuFeatures: string[];
  cpuCompatible: boolean;
  ramTotalBytes: number;
  ramUsedBytes: number;
  vramTotalBytes: number | null;
  cpuUsagePercent: number;
  combinedMemUsedGb: number;
  gpus: GpuInfo[];
  gpuSummary: string;
}

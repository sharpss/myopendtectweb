import { LRUCache } from './lruCache';

export interface ZarrArrayMetadata {
  zarr_format: number;
  shape: number[];
  chunks: number[];
  dtype: string;
  compressor: {
    id: string;
    level?: number;
  } | null;
  fill_value: number;
  order: 'C' | 'F';
  filters: any[] | null;
  dimension_separator: '/' | '.';
}

export interface ZarrLevelInfo {
  level: number;
  shape: number[];
  chunks: number[];
  dtype: string;
  compressor: any;
  scale: number;
  description: string;
}

export interface ZarrDatasetInfo {
  datasetId: string;
  attrs: {
    title?: string;
    geometry?: {
      inlineCount: number;
      crosslineCount: number;
      timeSamples: number;
      sampleInterval: number;
      inlineStart: number;
      crosslineStart: number;
      timeStart: number;
    };
  };
  levels: ZarrLevelInfo[];
  maxLevel: number;
}

export class ZarrClient {
  private baseUrl: string;
  private metadataCache: Map<string, ZarrArrayMetadata> = new Map();
  private chunkCache: LRUCache<string, Float32Array>;

  constructor(baseUrl: string, options?: { cacheSizeMB?: number }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    const cacheSizeMB = options?.cacheSizeMB ?? 256;
    this.chunkCache = new LRUCache<string, Float32Array>({
      maxSize: cacheSizeMB * 1024 * 1024,
      sizeFn: (value) => value.byteLength,
    });
  }

  async listDatasets(): Promise<ZarrDatasetInfo[]> {
    const response = await fetch(`${this.baseUrl}/datasets`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to list datasets');
    return data.data;
  }

  async getDatasetInfo(datasetId: string): Promise<ZarrDatasetInfo> {
    const response = await fetch(`${this.baseUrl}/datasets/${datasetId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get dataset');
    return data.data;
  }

  async getSlice(
    datasetId: string,
    level: number,
    type: 'inline' | 'crossline' | 'timeslice',
    index: number
  ): Promise<{
    data: Float32Array;
    width: number;
    height: number;
    minValue: number;
    maxValue: number;
  }> {
    const response = await fetch(
      `${this.baseUrl}/datasets/${datasetId}/levels/${level}/slice/${type}/${index}`
    );
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get slice');
    return {
      data: new Float32Array(data.data),
      width: data.width,
      height: data.height,
      minValue: data.minValue,
      maxValue: data.maxValue,
    };
  }

  async getChunk(
    datasetId: string,
    level: number,
    ci: number,
    cx: number,
    ct: number
  ): Promise<Float32Array> {
    const cacheKey = `${datasetId}/${level}/${ci}/${cx}/${ct}`;
    const cached = this.chunkCache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(
      `${this.baseUrl}/datasets/${datasetId}/levels/${level}/chunk/${ci}/${cx}/${ct}`
    );
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get chunk');

    const floatArray = new Float32Array(data.data);
    this.chunkCache.set(cacheKey, floatArray);
    return floatArray;
  }

  async prefetchSlices(
    datasetId: string,
    level: number,
    type: 'inline' | 'crossline' | 'timeslice',
    startIndex: number,
    count: number
  ): Promise<void> {
    const requests: Promise<any>[] = [];
    const batchSize = 4;

    for (let i = 0; i < count; i += batchSize) {
      const batch = Math.min(batchSize, count - i);
      for (let j = 0; j < batch; j++) {
        const index = startIndex + i + j;
        if (index >= 0) {
          requests.push(
            this.getSlice(datasetId, level, type, index).catch(() => null)
          );
        }
      }
      await Promise.all(requests);
      requests.length = 0;
    }
  }

  getCacheStats() {
    return this.chunkCache.stats;
  }

  clearCache(): void {
    this.chunkCache.clear();
    this.metadataCache.clear();
  }
}

let defaultClient: ZarrClient | null = null;

export function getZarrClient(): ZarrClient {
  if (!defaultClient) {
    const apiBase =
      import.meta.env?.VITE_API_URL ||
      (typeof window !== 'undefined' && `${window.location.origin}/api`) ||
      'http://localhost:3001/api';
    defaultClient = new ZarrClient(`${apiBase}/zarr`, { cacheSizeMB: 512 });
  }
  return defaultClient;
}

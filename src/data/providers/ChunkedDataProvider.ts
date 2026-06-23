import { BaseDataProvider } from './BaseDataProvider';
import { LRUCache } from '../../utils/lruCache';
import {
  SeismicDataset,
  SeismicSliceData,
  SliceType,
  DataLoadOptions,
  ChunkIndex,
  ChunkInfo,
} from '../../../shared/types';
import { estimateDatasetSizeMB, getResolutionScale, getScaledDimensions } from '../../utils/dataStrategy';
import { getMockSeismicData } from '../mockSeismic';

const DEFAULT_CHUNK_SIZE: ChunkIndex = { inline: 32, crossline: 32, time: 64 };

interface ChunkData {
  info: ChunkInfo;
  data: Float32Array;
}

export class ChunkedDataProvider extends BaseDataProvider {
  private chunkSize: ChunkIndex;
  private totalChunks: ChunkIndex;
  private chunkCache: LRUCache<string, ChunkData>;
  private sourceData: Float32Array | null = null;
  private maxMemoryMB: number;

  constructor(dataset: SeismicDataset) {
    super(dataset);
    this._stats.strategy = 'chunked';
    this.chunkSize = { ...DEFAULT_CHUNK_SIZE };
    this.totalChunks = { inline: 0, crossline: 0, time: 0 };
    this.maxMemoryMB = 512;
    this.chunkCache = new LRUCache<string, ChunkData>({
      maxSize: this.maxMemoryMB * 1024 * 1024,
      sizeFn: (chunk) => chunk.data.byteLength,
    });
  }

  async load(options: DataLoadOptions = {}): Promise<void> {
    if (this._isLoading) return;
    this._isLoading = true;
    this.loadStartTime = performance.now();

    try {
      this.emitProgress({
        total: 100,
        loaded: 0,
        currentStage: '初始化分块加载...',
      });

      const targetResolution = options.targetResolution || 'full';
      const scale = getResolutionScale(targetResolution);
      const scaledDims = getScaledDimensions(
        this._dataset.inlineCount,
        this._dataset.crosslineCount,
        this._dataset.timeSamples,
        targetResolution
      );

      this._stats.resolutionLevel = targetResolution;
      this._stats.totalSizeMB = estimateDatasetSizeMB(this._dataset) / (scale * scale * scale);

      if (options.chunkSize) {
        this.chunkSize = {
          inline: options.chunkSize.inline || DEFAULT_CHUNK_SIZE.inline,
          crossline: options.chunkSize.crossline || DEFAULT_CHUNK_SIZE.crossline,
          time: options.chunkSize.time || DEFAULT_CHUNK_SIZE.time,
        };
      }

      this.maxMemoryMB = options.maxMemoryMB || 512;
      this.chunkCache = new LRUCache<string, ChunkData>({
        maxSize: this.maxMemoryMB * 1024 * 1024,
        sizeFn: (chunk) => chunk.data.byteLength,
      });

      this.totalChunks = {
        inline: Math.ceil(scaledDims.inlineCount / this.chunkSize.inline),
        crossline: Math.ceil(scaledDims.crosslineCount / this.chunkSize.crossline),
        time: Math.ceil(scaledDims.timeSamples / this.chunkSize.time),
      };

      this.emitProgress({
        total: 100,
        loaded: 20,
        currentStage: `分块配置: ${this.totalChunks.inline}×${this.totalChunks.crossline}×${this.totalChunks.time} 个块`,
      });

      this.sourceData = getMockSeismicData();

      if (scale > 1) {
        this.emitProgress({
          total: 100,
          loaded: 50,
          currentStage: '预生成降采样数据...',
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      this.emitProgress({
        total: 100,
        loaded: 80,
        currentStage: '预热中心区域缓存...',
      });

      const centerChunk: ChunkIndex = {
        inline: Math.floor(this.totalChunks.inline / 2),
        crossline: Math.floor(this.totalChunks.crossline / 2),
        time: Math.floor(this.totalChunks.time / 2),
      };
      await this.ensureChunkLoaded(centerChunk);

      this._isLoaded = true;
      this._updateStats();

      this.emitProgress({
        total: 100,
        loaded: 100,
        currentStage: '分块加载就绪',
      });
    } finally {
      this._isLoading = false;
    }
  }

  unload(): void {
    this.chunkCache.clear();
    this.sourceData = null;
    this._isLoaded = false;
    this._stats.loadedSizeMB = 0;
    this._stats.activeChunks = 0;
  }

  getSlice(type: SliceType, index: number): SeismicSliceData {
    if (!this._isLoaded) {
      throw new Error('Data not loaded');
    }

    const resolution = this._stats.resolutionLevel;
    const scale = getResolutionScale(resolution);
    const scaled = getScaledDimensions(
      this._dataset.inlineCount,
      this._dataset.crosslineCount,
      this._dataset.timeSamples,
      resolution
    );

    const scaledIndex = Math.floor(index / scale);

    let width: number;
    let height: number;

    switch (type) {
      case 'inline':
        width = scaled.crosslineCount;
        height = scaled.timeSamples;
        break;
      case 'crossline':
        width = scaled.inlineCount;
        height = scaled.timeSamples;
        break;
      case 'timeslice':
        width = scaled.inlineCount;
        height = scaled.crosslineCount;
        break;
    }

    const sliceData = new Float32Array(width * height);
    let minVal = Infinity;
    let maxVal = -Infinity;

    const chunksNeeded = this.getChunksForSlice(type, scaledIndex);
    chunksNeeded.forEach((chunkIdx) => this.ensureChunkLoaded(chunkIdx));

    switch (type) {
      case 'inline': {
        const il = Math.max(0, Math.min(scaled.inlineCount - 1, scaledIndex));
        for (let xl = 0; xl < scaled.crosslineCount; xl++) {
          for (let t = 0; t < scaled.timeSamples; t++) {
            const val = this.getScaledValue(il, xl, t, scaled);
            const sliceIdx = xl * height + t;
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'crossline': {
        const xl = Math.max(0, Math.min(scaled.crosslineCount - 1, scaledIndex));
        for (let il = 0; il < scaled.inlineCount; il++) {
          for (let t = 0; t < scaled.timeSamples; t++) {
            const val = this.getScaledValue(il, xl, t, scaled);
            const sliceIdx = il * height + t;
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'timeslice': {
        const tIdx = Math.max(0, Math.min(scaled.timeSamples - 1, scaledIndex));
        for (let il = 0; il < scaled.inlineCount; il++) {
          for (let xl = 0; xl < scaled.crosslineCount; xl++) {
            const val = this.getScaledValue(il, xl, tIdx, scaled);
            const sliceIdx = il * height + xl;
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
    }

    this._updateStats();

    return {
      data: sliceData,
      width,
      height,
      minValue: minVal,
      maxValue: maxVal,
    };
  }

  getValue(inline: number, crossline: number, time: number): number {
    const resolution = this._stats.resolutionLevel;
    const scale = getResolutionScale(resolution);
    const scaled = getScaledDimensions(
      this._dataset.inlineCount,
      this._dataset.crosslineCount,
      this._dataset.timeSamples,
      resolution
    );
    return this.getScaledValue(
      Math.floor(inline / scale),
      Math.floor(crossline / scale),
      Math.floor(time / scale),
      scaled
    );
  }

  private getScaledValue(
    il: number,
    xl: number,
    t: number,
    dims: { inlineCount: number; crosslineCount: number; timeSamples: number }
  ): number {
    il = Math.max(0, Math.min(dims.inlineCount - 1, il));
    xl = Math.max(0, Math.min(dims.crosslineCount - 1, xl));
    t = Math.max(0, Math.min(dims.timeSamples - 1, t));

    const chunkIdx: ChunkIndex = {
      inline: Math.floor(il / this.chunkSize.inline),
      crossline: Math.floor(xl / this.chunkSize.crossline),
      time: Math.floor(t / this.chunkSize.time),
    };

    const chunk = this.getChunk(chunkIdx);
    if (!chunk) return 0;

    const localIl = il - chunk.info.offset.inline;
    const localXl = xl - chunk.info.offset.crossline;
    const localT = t - chunk.info.offset.time;

    const idx = (localIl * chunk.info.size.crossline + localXl) * chunk.info.size.time + localT;
    return chunk.data[idx];
  }

  private getChunksForSlice(type: SliceType, index: number): ChunkIndex[] {
    const chunks: ChunkIndex[] = [];

    switch (type) {
      case 'inline': {
        const chunkIl = Math.floor(index / this.chunkSize.inline);
        for (let xl = 0; xl < this.totalChunks.crossline; xl++) {
          for (let t = 0; t < this.totalChunks.time; t++) {
            chunks.push({ inline: chunkIl, crossline: xl, time: t });
          }
        }
        break;
      }
      case 'crossline': {
        const chunkXl = Math.floor(index / this.chunkSize.crossline);
        for (let il = 0; il < this.totalChunks.inline; il++) {
          for (let t = 0; t < this.totalChunks.time; t++) {
            chunks.push({ inline: il, crossline: chunkXl, time: t });
          }
        }
        break;
      }
      case 'timeslice': {
        const chunkT = Math.floor(index / this.chunkSize.time);
        for (let il = 0; il < this.totalChunks.inline; il++) {
          for (let xl = 0; xl < this.totalChunks.crossline; xl++) {
            chunks.push({ inline: il, crossline: xl, time: chunkT });
          }
        }
        break;
      }
    }

    return chunks;
  }

  private getChunkId(index: ChunkIndex): string {
    return `${index.inline}_${index.crossline}_${index.time}`;
  }

  private getChunk(index: ChunkIndex): ChunkData | undefined {
    const id = this.getChunkId(index);
    return this.chunkCache.get(id);
  }

  private async ensureChunkLoaded(index: ChunkIndex): Promise<ChunkData | null> {
    const id = this.getChunkId(index);
    const cached = this.chunkCache.get(id);
    if (cached) return cached;

    const chunk = this.generateChunk(index);
    this.chunkCache.set(id, chunk);
    return chunk;
  }

  private generateChunk(index: ChunkIndex): ChunkData {
    const id = this.getChunkId(index);
    const resolution = this._stats.resolutionLevel;
    const scale = getResolutionScale(resolution);
    const scaled = getScaledDimensions(
      this._dataset.inlineCount,
      this._dataset.crosslineCount,
      this._dataset.timeSamples,
      resolution
    );

    const startIl = index.inline * this.chunkSize.inline;
    const startXl = index.crossline * this.chunkSize.crossline;
    const startT = index.time * this.chunkSize.time;

    const sizeIl = Math.min(this.chunkSize.inline, scaled.inlineCount - startIl);
    const sizeXl = Math.min(this.chunkSize.crossline, scaled.crosslineCount - startXl);
    const sizeT = Math.min(this.chunkSize.time, scaled.timeSamples - startT);

    const data = new Float32Array(sizeIl * sizeXl * sizeT);

    if (this.sourceData) {
      const srcScale = scale;
      for (let il = 0; il < sizeIl; il++) {
        for (let xl = 0; xl < sizeXl; xl++) {
          for (let t = 0; t < sizeT; t++) {
            const srcIl = (startIl + il) * srcScale;
            const srcXl = (startXl + xl) * srcScale;
            const srcT = (startT + t) * srcScale;

            const clampedIl = Math.min(this._dataset.inlineCount - 1, srcIl);
            const clampedXl = Math.min(this._dataset.crosslineCount - 1, srcXl);
            const clampedT = Math.min(this._dataset.timeSamples - 1, srcT);

            const srcIdx = (clampedIl * this._dataset.crosslineCount + clampedXl) * this._dataset.timeSamples + clampedT;
            const dstIdx = (il * sizeXl + xl) * sizeT + t;
            data[dstIdx] = this.sourceData[srcIdx];
          }
        }
      }
    }

    const info: ChunkInfo = {
      id,
      index,
      size: { inline: sizeIl, crossline: sizeXl, time: sizeT },
      offset: { inline: startIl, crossline: startXl, time: startT },
      lastAccess: Date.now(),
      isLoaded: true,
      refCount: 0,
    };

    return { info, data };
  }

  private _updateStats(): void {
    const stats = this.chunkCache.stats;
    this._stats.loadedSizeMB = stats.size / (1024 * 1024);
    this._stats.activeChunks = stats.count;
    this._stats.cacheHitRate = stats.hitRate;
  }
}

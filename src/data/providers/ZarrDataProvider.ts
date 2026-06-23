import { BaseDataProvider } from './BaseDataProvider';
import { ZarrClient, getZarrClient, ZarrDatasetInfo, ZarrLevelInfo } from '../../utils/zarrClient';
import {
  SeismicDataset,
  SeismicSliceData,
  SliceType,
  DataLoadOptions,
  DataResolutionLevel,
} from '../../../shared/types';

export class ZarrDataProvider extends BaseDataProvider {
  private client: ZarrClient;
  private datasetInfo: ZarrDatasetInfo | null = null;
  private currentLevel: number = 0;
  private availableLevels: ZarrLevelInfo[] = [];
  private sliceCache: Map<string, SeismicSliceData> = new Map();
  private prefetching: boolean = false;
  private maxCacheSlices: number = 100;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(dataset: SeismicDataset) {
    super(dataset);
    this.client = getZarrClient();
    this._stats.strategy = 'zarr';
  }

  async load(options?: DataLoadOptions): Promise<void> {
    this._isLoading = true;
    this.loadStartTime = performance.now();
    this.emitProgress({ currentStage: '加载 Zarr 数据集信息', loaded: 0, total: 100 });

    try {
      const datasetId = this._dataset.id;
      this.datasetInfo = await this.client.getDatasetInfo(datasetId);
      this.availableLevels = this.datasetInfo.levels;

      const targetLevel = options?.targetResolution
        ? this.getLevelForResolution(options.targetResolution)
        : this.getOptimalLevel();

      this.currentLevel = targetLevel;

      this.emitProgress({ currentStage: '初始化数据', loaded: 50, total: 100 });

      const levelInfo = this.availableLevels[this.currentLevel];
      const geometry = this.datasetInfo.attrs.geometry;

      if (geometry) {
        const scale = levelInfo.scale;
        this._dataset = {
          ...this._dataset,
          inlineCount: Math.floor(geometry.inlineCount / scale),
          crosslineCount: Math.floor(geometry.crosslineCount / scale),
          timeSamples: Math.floor(geometry.timeSamples / scale),
          sampleInterval: geometry.sampleInterval * scale,
          inlineStart: geometry.inlineStart,
          crosslineStart: geometry.crosslineStart,
          timeStart: geometry.timeStart,
        };
      }

      this._stats.resolutionLevel = this.getResolutionForLevel(this.currentLevel);
      this._stats.totalSizeMB = this.estimateSizeMB();
      this._stats.loadedSizeMB = 0;

      this._isLoaded = true;
      this._isLoading = false;

      this.emitProgress({
        currentStage: `加载完成 (Level ${this.currentLevel}, 1/${levelInfo.scale} 分辨率)`,
        loaded: 100,
        total: 100,
      });
    } catch (error) {
      this._isLoading = false;
      throw error;
    }
  }

  unload(): void {
    this.sliceCache.clear();
    this._isLoaded = false;
    this.datasetInfo = null;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  getSlice(type: SliceType, index: number): SeismicSliceData {
    if (!this._isLoaded || !this.datasetInfo) {
      throw new Error('Data not loaded');
    }

    const cacheKey = `${type}-${index}-${this.currentLevel}`;
    const cached = this.sliceCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;
    const dummyData = this.generateDummySlice(type, index);

    this.fetchSliceAsync(type, index, cacheKey);

    return dummyData;
  }

  private async fetchSliceAsync(
    type: SliceType,
    index: number,
    cacheKey: string
  ): Promise<void> {
    if (!this.datasetInfo) return;

    try {
      const zarrType = type === 'timeslice' ? 'timeslice' : type;
      const result = await this.client.getSlice(
        this._dataset.id,
        this.currentLevel,
        zarrType as 'inline' | 'crossline' | 'timeslice',
        index
      );

      const sliceData: SeismicSliceData = {
        data: result.data,
        width: result.width,
        height: result.height,
        minValue: result.minValue,
        maxValue: result.maxValue,
      };

      this.sliceCache.set(cacheKey, sliceData);
      this._stats.loadedSizeMB += (result.data.byteLength / (1024 * 1024));
      this._stats.activeChunks = this.sliceCache.size;

      if (this.sliceCache.size > this.maxCacheSlices) {
        const firstKey = this.sliceCache.keys().next().value;
        if (firstKey) {
          const removed = this.sliceCache.get(firstKey);
          if (removed) {
            this._stats.loadedSizeMB -= (removed.data.byteLength / (1024 * 1024));
          }
          this.sliceCache.delete(firstKey);
        }
      }
    } catch (error) {
      console.error('Failed to fetch slice:', error);
    }
  }

  async getSliceAsync(type: SliceType, index: number): Promise<SeismicSliceData> {
    if (!this._isLoaded || !this.datasetInfo) {
      throw new Error('Data not loaded');
    }

    const cacheKey = `${type}-${index}-${this.currentLevel}`;
    const cached = this.sliceCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;
    const zarrType = type === 'timeslice' ? 'timeslice' : type;
    const result = await this.client.getSlice(
      this._dataset.id,
      this.currentLevel,
      zarrType as 'inline' | 'crossline' | 'timeslice',
      index
    );

    const sliceData: SeismicSliceData = {
      data: result.data,
      width: result.width,
      height: result.height,
      minValue: result.minValue,
      maxValue: result.maxValue,
    };

    this.sliceCache.set(cacheKey, sliceData);
    this._stats.loadedSizeMB += (result.data.byteLength / (1024 * 1024));
    this._stats.activeChunks = this.sliceCache.size;

    return sliceData;
  }

  getValue(inline: number, crossline: number, time: number): number {
    if (!this._isLoaded) return 0;
    const slice = this.getSlice('inline', inline);
    const idx = crossline * slice.height + time;
    return slice.data[idx] ?? 0;
  }

  async refineToLevel(targetLevel: number): Promise<void> {
    if (!this.datasetInfo) throw new Error('Dataset not loaded');
    if (targetLevel < 0 || targetLevel >= this.availableLevels.length) {
      throw new Error(`Invalid level: ${targetLevel}`);
    }

    this.currentLevel = targetLevel;
    this.sliceCache.clear();
    this._stats.loadedSizeMB = 0;
    this._stats.activeChunks = 0;

    const levelInfo = this.availableLevels[targetLevel];
    const geometry = this.datasetInfo.attrs.geometry;

    if (geometry) {
      const scale = levelInfo.scale;
      this._dataset = {
        ...this._dataset,
        inlineCount: Math.floor(geometry.inlineCount / scale),
        crosslineCount: Math.floor(geometry.crosslineCount / scale),
        timeSamples: Math.floor(geometry.timeSamples / scale),
        sampleInterval: geometry.sampleInterval * scale,
      };
    }

    this._stats.resolutionLevel = this.getResolutionForLevel(targetLevel);
    this._stats.totalSizeMB = this.estimateSizeMB();
  }

  getAvailableLevels(): number[] {
    return this.availableLevels.map((l) => l.level);
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getLevelScale(level: number): number {
    return this.availableLevels[level]?.scale ?? 1;
  }

  async prefetchAround(
    type: SliceType,
    currentIndex: number,
    range: number = 3
  ): Promise<void> {
    if (this.prefetching || !this.datasetInfo) return;
    this.prefetching = true;

    try {
      const indices: number[] = [];
      const maxIndex =
        type === 'inline'
          ? this._dataset.inlineCount
          : type === 'crossline'
          ? this._dataset.crosslineCount
          : this._dataset.timeSamples;

      for (let i = -range; i <= range; i++) {
        const idx = currentIndex + i;
        if (idx >= 0 && idx < maxIndex && i !== 0) {
          const cacheKey = `${type}-${idx}-${this.currentLevel}`;
          if (!this.sliceCache.has(cacheKey)) {
            indices.push(idx);
          }
        }
      }

      for (const idx of indices) {
        const cacheKey = `${type}-${idx}-${this.currentLevel}`;
        if (!this.sliceCache.has(cacheKey)) {
          await this.fetchSliceAsync(type, idx, cacheKey);
        }
      }
    } finally {
      this.prefetching = false;
    }
  }

  private generateDummySlice(type: SliceType, index: number): SeismicSliceData {
    let width: number, height: number;
    switch (type) {
      case 'inline':
        width = this._dataset.crosslineCount;
        height = this._dataset.timeSamples;
        break;
      case 'crossline':
        width = this._dataset.inlineCount;
        height = this._dataset.timeSamples;
        break;
      case 'timeslice':
        width = this._dataset.inlineCount;
        height = this._dataset.crosslineCount;
        break;
    }
    return {
      data: new Float32Array(width * height),
      width,
      height,
      minValue: -1,
      maxValue: 1,
    };
  }

  private getLevelForResolution(level: DataResolutionLevel): number {
    switch (level) {
      case 'full':
        return 0;
      case 'half':
        return Math.min(1, this.availableLevels.length - 1);
      case 'quarter':
        return Math.min(2, this.availableLevels.length - 1);
      case 'eighth':
        return Math.min(3, this.availableLevels.length - 1);
      default:
        return this.getOptimalLevel();
    }
  }

  private getResolutionForLevel(level: number): DataResolutionLevel {
    switch (level) {
      case 0:
        return 'full';
      case 1:
        return 'half';
      case 2:
        return 'quarter';
      case 3:
        return 'eighth';
      default:
        return 'quarter';
    }
  }

  private getOptimalLevel(): number {
    return this.availableLevels.length > 2
      ? 2
      : Math.floor(this.availableLevels.length / 2);
  }

  private estimateSizeMB(): number {
    const bytesPerSample = 4;
    const samples =
      this._dataset.inlineCount *
      this._dataset.crosslineCount *
      this._dataset.timeSamples;
    return (samples * bytesPerSample) / (1024 * 1024);
  }

  getStats() {
    const stats = { ...this._stats };
    const total = this.cacheHits + this.cacheMisses;
    stats.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
    stats.activeChunks = this.sliceCache.size;
    return stats;
  }
}

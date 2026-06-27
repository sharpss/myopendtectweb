import { BaseDataProvider } from './BaseDataProvider';
import { LRUCache } from '../../utils/lruCache';
import {
  SeismicDataset,
  SeismicSliceData,
  SliceType,
  DataLoadOptions,
  PyramidLevel,
  DataResolutionLevel,
} from '../../../shared/types';
import { estimateDatasetSizeMB, getResolutionScale, getScaledDimensions } from '../../utils/dataStrategy';
import { downsampleVolume } from '../../utils/resample';
import { getMockSeismicData } from '../mockSeismic';

interface LevelData {
  level: PyramidLevel;
  data: Float32Array | null;
  isLoaded: boolean;
}

export class PyramidDataProvider extends BaseDataProvider {
  private levels: Map<number, LevelData> = new Map();
  private activeLevel: number = 2;
  private sliceCache: LRUCache<string, SeismicSliceData>;
  private baseData: Float32Array | null = null;

  constructor(dataset: SeismicDataset) {
    super(dataset);
    this._stats.strategy = 'pyramid';
    this.sliceCache = new LRUCache<string, SeismicSliceData>({
      maxSize: 64 * 1024 * 1024,
      sizeFn: (slice) => slice.data.byteLength,
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
        currentStage: '构建多分辨率金字塔...',
      });

      const targetResolution = options.targetResolution || 'quarter';
      this._stats.resolutionLevel = targetResolution;
      this._stats.totalSizeMB = estimateDatasetSizeMB(this._dataset);

      this.buildPyramid();

      this.emitProgress({
        total: 100,
        loaded: 10,
        currentStage: '加载基础数据...',
      });

      let rawData: Float32Array;
      let rawMin = -1;
      let rawMax = 1;

      if (this._dataset.source === 'segy' || this._dataset.source === 'api') {
        const remoteId = this._dataset.remoteId || this._dataset.id;
        const response = await fetch(`/api/segy/datasets/${remoteId}/volume`);
        if (!response.ok) {
          throw new Error('Failed to load volume data from server');
        }
        const result = await response.json();
        rawData = new Float32Array(result.data.data);
        rawMin = result.data.minValue;
        rawMax = result.data.maxValue;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
        rawData = getMockSeismicData();
        let minVal = Infinity;
        let maxVal = -Infinity;
        const step = Math.max(1, Math.floor(rawData.length / 10000));
        for (let i = 0; i < rawData.length; i += step) {
          const val = rawData[i];
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
        rawMin = isFinite(minVal) ? minVal : -1;
        rawMax = isFinite(maxVal) ? maxVal : 1;
      }

      this.baseData = rawData;

      this.emitProgress({
        total: 100,
        loaded: 40,
        currentStage: '生成多分辨率层级...',
      });

      const level0 = this.levels.get(0);
      if (level0) {
        level0.data = rawData;
        level0.isLoaded = true;
      }

      for (let lvl = 1; lvl <= 3; lvl++) {
        const levelData = this.levels.get(lvl);
        if (levelData) {
          const prevLevel = this.levels.get(lvl - 1);
          const prevScale = lvl - 1 === 0 ? 1 : Math.pow(2, lvl - 1);
          if (prevLevel && prevLevel.data) {
            levelData.data = downsampleVolume(
              prevLevel.data,
              Math.max(1, Math.floor(this._dataset.inlineCount / prevScale)),
              Math.max(1, Math.floor(this._dataset.crosslineCount / prevScale)),
              Math.max(1, Math.floor(this._dataset.timeSamples / prevScale)),
              2
            );
            levelData.isLoaded = true;
          }
        }
        this.emitProgress({
          total: 100,
          loaded: 40 + lvl * 15,
          currentStage: `生成分辨率层级 ${lvl}/3...`,
        });
      }

      this.activeLevel = this.resolutionToLevel(targetResolution);

      this._isLoaded = true;
      this._updateStats();

      this.emitProgress({
        total: 100,
        loaded: 100,
        currentStage: '金字塔加载完成',
      });
    } finally {
      this._isLoading = false;
    }
  }

  unload(): void {
    this.levels.forEach((level) => {
      level.data = null;
      level.isLoaded = false;
    });
    this.baseData = null;
    this.sliceCache.clear();
    this._isLoaded = false;
    this._stats.loadedSizeMB = 0;
    this._stats.activeChunks = 0;
  }

  getSlice(type: SliceType, index: number): SeismicSliceData {
    if (!this._isLoaded) {
      throw new Error('Data not loaded');
    }

    const cacheKey = `${this.activeLevel}_${type}_${index}`;
    const cached = this.sliceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const level = this.levels.get(this.activeLevel);
    if (!level || !level.data) {
      return this.getFallbackSlice(type, index);
    }

    const slice = this.extractSlice(level, type, index);
    this.sliceCache.set(cacheKey, slice);
    this._updateStats();

    return slice;
  }

  getValue(inline: number, crossline: number, time: number): number {
    const level = this.levels.get(this.activeLevel);
    if (!level || !level.data) return 0;

    const scale = level.level.scale;
    const il = Math.floor(inline / scale);
    const xl = Math.floor(crossline / scale);
    const t = Math.floor(time / scale);

    const clampedIl = Math.max(0, Math.min(level.level.inlineCount - 1, il));
    const clampedXl = Math.max(0, Math.min(level.level.crosslineCount - 1, xl));
    const clampedT = Math.max(0, Math.min(level.level.timeSamples - 1, t));

    const idx = (clampedIl * level.level.crosslineCount + clampedXl) * level.level.timeSamples + clampedT;
    return level.data[idx];
  }

  setResolutionLevel(level: DataResolutionLevel): void {
    const levelNum = this.resolutionToLevel(level);
    if (this.levels.has(levelNum)) {
      this.activeLevel = levelNum;
      this._stats.resolutionLevel = level;
      this.sliceCache.clear();
    }
  }

  getAvailableLevels(): PyramidLevel[] {
    return Array.from(this.levels.values()).map((l) => l.level);
  }

  getCurrentLevel(): PyramidLevel | null {
    const level = this.levels.get(this.activeLevel);
    return level ? level.level : null;
  }

  async refineToLevel(level: DataResolutionLevel): Promise<boolean> {
    const targetLevel = this.resolutionToLevel(level);
    if (targetLevel < 0 || targetLevel > 3) return false;

    const levelData = this.levels.get(targetLevel);
    if (!levelData) return false;

    if (levelData.isLoaded && levelData.data) {
      this.activeLevel = targetLevel;
      this._stats.resolutionLevel = level;
      this.sliceCache.clear();
      return true;
    }

    this.loadStartTime = performance.now();
    this.emitProgress({
      total: 100,
      loaded: 0,
      currentStage: `细化到 ${level} 分辨率...`,
    });

    await this.loadLevel(targetLevel);

    this.activeLevel = targetLevel;
    this._stats.resolutionLevel = level;
    this.sliceCache.clear();
    this._updateStats();

    this.emitProgress({
      total: 100,
      loaded: 100,
      currentStage: '分辨率提升完成',
    });

    return true;
  }

  private buildPyramid(): void {
    const safeCount = (n: number) => {
      if (!isFinite(n) || isNaN(n) || n <= 0) return 1;
      return Math.max(1, Math.floor(n));
    };

    const inlineCount = safeCount(this._dataset.inlineCount);
    const crosslineCount = safeCount(this._dataset.crosslineCount);
    const timeSamples = safeCount(this._dataset.timeSamples);

    const scales = [1, 2, 4, 8];
    const levels: PyramidLevel[] = scales.map((scale, idx) => {
      const il = Math.max(1, Math.floor(inlineCount / scale));
      const xl = Math.max(1, Math.floor(crosslineCount / scale));
      const ts = Math.max(1, Math.floor(timeSamples / scale));
      const chunkIl = scale === 1 ? 32 : scale === 2 ? 32 : scale === 4 ? 16 : 8;
      const chunkXl = scale === 1 ? 32 : scale === 2 ? 32 : scale === 4 ? 16 : 8;
      const chunkT = scale === 1 ? 64 : scale === 2 ? 64 : scale === 4 ? 32 : 16;
      
      return {
        level: idx,
        scale,
        inlineCount: il,
        crosslineCount: xl,
        timeSamples: ts,
        chunkSize: { inline: chunkIl, crossline: chunkXl, time: chunkT },
        totalChunks: {
          inline: Math.ceil(il / chunkIl),
          crossline: Math.ceil(xl / chunkXl),
          time: Math.ceil(ts / chunkT),
        },
      };
    });

    levels.forEach((level) => {
      this.levels.set(level.level, {
        level,
        data: null,
        isLoaded: false,
      });
    });
  }

  private async loadLevel(levelNum: number): Promise<void> {
    const levelData = this.levels.get(levelNum);
    if (!levelData || levelData.isLoaded) return;

    const level = levelData.level;
    const scaled = getScaledDimensions(
      this._dataset.inlineCount,
      this._dataset.crosslineCount,
      this._dataset.timeSamples,
      this.levelToResolution(levelNum)
    );

    if (this.baseData && level.scale > 1) {
      levelData.data = downsampleVolume(
        this.baseData,
        this._dataset.inlineCount,
        this._dataset.crosslineCount,
        this._dataset.timeSamples,
        level.scale
      );
    } else if (this.baseData) {
      levelData.data = this.baseData;
    } else {
      levelData.data = new Float32Array(scaled.inlineCount * scaled.crosslineCount * scaled.timeSamples);
    }

    levelData.isLoaded = true;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  private extractSlice(
    levelData: LevelData,
    type: SliceType,
    index: number
  ): SeismicSliceData {
    const { level, data } = levelData;
    if (!data) {
      return { data: new Float32Array(0), width: 0, height: 0, minValue: 0, maxValue: 0 };
    }

    let width: number;
    let height: number;
    let sliceData: Float32Array;
    let minVal = Infinity;
    let maxVal = -Infinity;

    switch (type) {
      case 'inline': {
        const il = Math.max(0, Math.min(level.inlineCount - 1, index));
        width = level.crosslineCount;
        height = level.timeSamples;
        sliceData = new Float32Array(width * height);

        for (let xl = 0; xl < level.crosslineCount; xl++) {
          for (let t = 0; t < level.timeSamples; t++) {
            const volIdx = (il * level.crosslineCount + xl) * level.timeSamples + t;
            const sliceIdx = xl * height + t;
            const val = data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'crossline': {
        const xl = Math.max(0, Math.min(level.crosslineCount - 1, index));
        width = level.inlineCount;
        height = level.timeSamples;
        sliceData = new Float32Array(width * height);

        for (let il = 0; il < level.inlineCount; il++) {
          for (let t = 0; t < level.timeSamples; t++) {
            const volIdx = (il * level.crosslineCount + xl) * level.timeSamples + t;
            const sliceIdx = il * height + t;
            const val = data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'timeslice': {
        const tIdx = Math.max(0, Math.min(level.timeSamples - 1, index));
        width = level.inlineCount;
        height = level.crosslineCount;
        sliceData = new Float32Array(width * height);

        for (let il = 0; il < level.inlineCount; il++) {
          for (let xl = 0; xl < level.crosslineCount; xl++) {
            const volIdx = (il * level.crosslineCount + xl) * level.timeSamples + tIdx;
            const sliceIdx = il * height + xl;
            const val = data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
    }

    return { data: sliceData, width, height, minValue: minVal, maxValue: maxVal };
  }

  private getFallbackSlice(type: SliceType, index: number): SeismicSliceData {
    for (let l = this.levels.size - 1; l >= 0; l--) {
      const level = this.levels.get(l);
      if (level && level.data) {
        const scale = Math.pow(2, this.activeLevel - l);
        const scaledIndex = Math.floor(index / scale);
        return this.extractSlice(level, type, scaledIndex);
      }
    }
    return { data: new Float32Array(0), width: 0, height: 0, minValue: 0, maxValue: 0 };
  }

  private resolutionToLevel(resolution: DataResolutionLevel): number {
    switch (resolution) {
      case 'full': return 0;
      case 'half': return 1;
      case 'quarter': return 2;
      case 'eighth': return 3;
      default: return 2;
    }
  }

  private levelToResolution(level: number): DataResolutionLevel {
    switch (level) {
      case 0: return 'full';
      case 1: return 'half';
      case 2: return 'quarter';
      case 3: return 'eighth';
      default: return 'quarter';
    }
  }

  private _updateStats(): void {
    let loadedSize = 0;
    this.levels.forEach((level) => {
      if (level.data) {
        loadedSize += level.data.byteLength;
      }
    });
    this._stats.loadedSizeMB = loadedSize / (1024 * 1024);
    this._stats.activeChunks = this.levels.size;
    this._stats.cacheHitRate = this.sliceCache.stats.hitRate;
  }
}

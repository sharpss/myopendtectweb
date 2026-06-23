import {
  SeismicDataset,
  SeismicSliceData,
  SliceType,
  DataLoadProgress,
  DataStats,
  DataLoadOptions,
} from '../../../shared/types';

export interface DataProvider {
  readonly dataset: SeismicDataset;
  readonly isLoaded: boolean;
  readonly isLoading: boolean;

  load(options?: DataLoadOptions): Promise<void>;
  unload(): void;

  getSlice(type: SliceType, index: number): SeismicSliceData;
  getValue(inline: number, crossline: number, time: number): number;

  getStats(): DataStats;
  onProgress(callback: (progress: DataLoadProgress) => void): () => void;
}

export abstract class BaseDataProvider implements DataProvider {
  protected _dataset: SeismicDataset;
  protected _isLoaded: boolean = false;
  protected _isLoading: boolean = false;
  protected _stats: DataStats;
  protected progressCallbacks: Set<(progress: DataLoadProgress) => void> = new Set();
  protected loadStartTime: number = 0;

  constructor(dataset: SeismicDataset) {
    this._dataset = dataset;
    this._stats = {
      totalSizeMB: 0,
      loadedSizeMB: 0,
      cacheHitRate: 0,
      activeChunks: 0,
      resolutionLevel: 'full',
      strategy: 'full',
    };
  }

  get dataset(): SeismicDataset {
    return this._dataset;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  abstract load(options?: DataLoadOptions): Promise<void>;

  abstract unload(): void;

  abstract getSlice(type: SliceType, index: number): SeismicSliceData;

  abstract getValue(inline: number, crossline: number, time: number): number;

  getStats(): DataStats {
    return { ...this._stats };
  }

  onProgress(callback: (progress: DataLoadProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  protected emitProgress(progress: Partial<DataLoadProgress> & { currentStage: string }): void {
    const elapsed = (performance.now() - this.loadStartTime) / 1000;
    const loaded = progress.loaded ?? 0;
    const total = progress.total ?? 1;
    const speed = elapsed > 0 ? loaded / elapsed : 0;
    const remaining = speed > 0 ? (total - loaded) / speed : 0;

    const fullProgress: DataLoadProgress = {
      total,
      loaded,
      percentage: total > 0 ? (loaded / total) * 100 : 0,
      currentStage: progress.currentStage,
      speed,
      eta: remaining,
    };

    this.progressCallbacks.forEach((cb) => {
      try {
        cb(fullProgress);
      } catch (e) {
        console.error('Progress callback error:', e);
      }
    });
  }
}

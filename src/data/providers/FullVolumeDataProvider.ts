import { BaseDataProvider } from './BaseDataProvider';
import {
  SeismicDataset,
  SeismicSliceData,
  SliceType,
  DataLoadOptions,
} from '../../../shared/types';
import { estimateDatasetSizeMB, getResolutionScale, getScaledDimensions } from '../../utils/dataStrategy';
import { downsampleVolume } from '../../utils/resample';
import { getMockSeismicData } from '../mockSeismic';

export class FullVolumeDataProvider extends BaseDataProvider {
  private data: Float32Array | null = null;
  private minValue: number = 0;
  private maxValue: number = 0;

  constructor(dataset: SeismicDataset) {
    super(dataset);
    this._stats.strategy = 'full';
  }

  async load(options: DataLoadOptions = {}): Promise<void> {
    if (this._isLoading) return;
    this._isLoading = true;
    this.loadStartTime = performance.now();

    try {
      this.emitProgress({
        total: 100,
        loaded: 0,
        currentStage: '准备数据加载...',
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

      this.emitProgress({
        total: 100,
        loaded: 10,
        currentStage: `加载数据体 (${scaledDims.inlineCount} × ${scaledDims.crosslineCount} × ${scaledDims.timeSamples})...`,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const rawData = getMockSeismicData();

      this.emitProgress({
        total: 100,
        loaded: 50,
        currentStage: '处理数据...',
      });

      if (scale > 1) {
        this.data = downsampleVolume(
          rawData,
          this._dataset.inlineCount,
          this._dataset.crosslineCount,
          this._dataset.timeSamples,
          scale
        );
      } else {
        this.data = rawData;
      }

      let minVal = Infinity;
      let maxVal = -Infinity;
      const step = Math.max(1, Math.floor(this.data.length / 10000));
      for (let i = 0; i < this.data.length; i += step) {
        const val = this.data[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
      this.minValue = minVal;
      this.maxValue = maxVal;

      this._stats.loadedSizeMB = this._stats.totalSizeMB;
      this._isLoaded = true;

      this.emitProgress({
        total: 100,
        loaded: 100,
        currentStage: '加载完成',
      });
    } finally {
      this._isLoading = false;
    }
  }

  unload(): void {
    this.data = null;
    this._isLoaded = false;
    this._stats.loadedSizeMB = 0;
  }

  getSlice(type: SliceType, index: number): SeismicSliceData {
    if (!this.data) {
      throw new Error('Data not loaded');
    }

    const { inlineCount, crosslineCount, timeSamples, timeStart, sampleInterval } = this._dataset;
    const resolution = this._stats.resolutionLevel;
    const scale = getResolutionScale(resolution);
    const scaled = getScaledDimensions(inlineCount, crosslineCount, timeSamples, resolution);

    let width: number;
    let height: number;
    let sliceData: Float32Array;
    let minVal = Infinity;
    let maxVal = -Infinity;

    const scaledIndex = Math.floor(index / scale);

    switch (type) {
      case 'inline': {
        const il = Math.max(0, Math.min(scaled.inlineCount - 1, scaledIndex));
        width = scaled.crosslineCount;
        height = scaled.timeSamples;
        sliceData = new Float32Array(width * height);

        for (let xl = 0; xl < scaled.crosslineCount; xl++) {
          for (let t = 0; t < scaled.timeSamples; t++) {
            const volIdx = (il * scaled.crosslineCount + xl) * scaled.timeSamples + t;
            const sliceIdx = xl * height + t;
            const val = this.data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'crossline': {
        const xl = Math.max(0, Math.min(scaled.crosslineCount - 1, scaledIndex));
        width = scaled.inlineCount;
        height = scaled.timeSamples;
        sliceData = new Float32Array(width * height);

        for (let il = 0; il < scaled.inlineCount; il++) {
          for (let t = 0; t < scaled.timeSamples; t++) {
            const volIdx = (il * scaled.crosslineCount + xl) * scaled.timeSamples + t;
            const sliceIdx = il * height + t;
            const val = this.data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
      case 'timeslice': {
        const tIdx = Math.max(0, Math.min(scaled.timeSamples - 1, scaledIndex));
        width = scaled.inlineCount;
        height = scaled.crosslineCount;
        sliceData = new Float32Array(width * height);

        for (let il = 0; il < scaled.inlineCount; il++) {
          for (let xl = 0; xl < scaled.crosslineCount; xl++) {
            const volIdx = (il * scaled.crosslineCount + xl) * scaled.timeSamples + tIdx;
            const sliceIdx = il * height + xl;
            const val = this.data[volIdx];
            sliceData[sliceIdx] = val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }
        }
        break;
      }
    }

    return {
      data: sliceData,
      width,
      height,
      minValue: minVal,
      maxValue: maxVal,
    };
  }

  getValue(inline: number, crossline: number, time: number): number {
    if (!this.data) return 0;

    const resolution = this._stats.resolutionLevel;
    const scale = getResolutionScale(resolution);
    const scaled = getScaledDimensions(
      this._dataset.inlineCount,
      this._dataset.crosslineCount,
      this._dataset.timeSamples,
      resolution
    );

    const il = Math.max(0, Math.min(scaled.inlineCount - 1, Math.floor(inline / scale)));
    const xl = Math.max(0, Math.min(scaled.crosslineCount - 1, Math.floor(crossline / scale)));
    const t = Math.max(0, Math.min(scaled.timeSamples - 1, Math.floor(time / scale)));

    const idx = (il * scaled.crosslineCount + xl) * scaled.timeSamples + t;
    return this.data[idx];
  }
}

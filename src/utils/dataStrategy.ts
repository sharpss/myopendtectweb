import { SeismicDataset, DataLoadStrategy, DataResolutionLevel, DataLoadOptions } from '../../shared/types';

function safeDim(n: number): number {
  if (!isFinite(n) || isNaN(n) || n <= 0) return 1;
  return Math.max(1, Math.floor(n));
}

export function estimateVolumeSizeMB(
  inlineCount: number,
  crosslineCount: number,
  timeSamples: number,
  bytesPerSample: number = 4
): number {
  const il = safeDim(inlineCount);
  const xl = safeDim(crosslineCount);
  const ts = safeDim(timeSamples);
  const bps = Math.max(1, Math.min(8, Math.floor(bytesPerSample) || 4));
  
  const totalSamples = il * xl * ts;
  if (!isFinite(totalSamples) || totalSamples <= 0) {
    return 0;
  }
  
  const totalBytes = totalSamples * bps;
  return totalBytes / (1024 * 1024);
}

export function estimateDatasetSizeMB(dataset: SeismicDataset): number {
  return estimateVolumeSizeMB(
    dataset.inlineCount,
    dataset.crosslineCount,
    dataset.timeSamples
  );
}

export function getAvailableMemoryMB(): number {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const mem = (performance as any).memory;
    if (mem && mem.jsHeapSizeLimit) {
      return (mem.jsHeapSizeLimit / (1024 * 1024)) * 0.5;
    }
  }
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );
  return isMobile ? 256 : 1024;
}

export function recommendLoadStrategy(
  dataset: SeismicDataset,
  options: DataLoadOptions = {}
): {
  strategy: DataLoadStrategy;
  resolution: DataResolutionLevel;
  estimatedMemoryMB: number;
  reason: string;
} {
  const fullSizeMB = estimateDatasetSizeMB(dataset);
  const maxMemoryMB = options.maxMemoryMB || getAvailableMemoryMB();
  const preferClientSide = options.preferClientSide !== false;

  const resolutionSizes: Record<DataResolutionLevel, number> = {
    full: fullSizeMB,
    half: fullSizeMB / 8,
    quarter: fullSizeMB / 64,
    eighth: fullSizeMB / 512,
  };

  if (options.strategy) {
    const targetResolution = options.targetResolution || 'full';
    return {
      strategy: options.strategy,
      resolution: targetResolution,
      estimatedMemoryMB: resolutionSizes[targetResolution],
      reason: `用户指定策略: ${options.strategy}`,
    };
  }

  if (!preferClientSide) {
    return {
      strategy: 'pyramid',
      resolution: 'quarter',
      estimatedMemoryMB: resolutionSizes.quarter,
      reason: '服务端渲染模式，使用多分辨率金字塔',
    };
  }

  if (fullSizeMB <= maxMemoryMB * 0.6) {
    return {
      strategy: 'full',
      resolution: 'full',
      estimatedMemoryMB: fullSizeMB,
      reason: `完整数据体 (${fullSizeMB.toFixed(1)}MB) 可完全加载到内存`,
    };
  }

  if (fullSizeMB <= maxMemoryMB * 2) {
    return {
      strategy: 'chunked',
      resolution: 'full',
      estimatedMemoryMB: Math.min(fullSizeMB, maxMemoryMB * 0.7),
      reason: `数据体较大 (${fullSizeMB.toFixed(1)}MB)，使用分块加载 + LRU 缓存`,
    };
  }

  if (fullSizeMB <= maxMemoryMB * 10) {
    let targetResolution: DataResolutionLevel = 'half';
    if (resolutionSizes.half > maxMemoryMB * 0.6) {
      targetResolution = 'quarter';
    }
    if (resolutionSizes.quarter > maxMemoryMB * 0.6) {
      targetResolution = 'eighth';
    }
    return {
      strategy: 'chunked',
      resolution: targetResolution,
      estimatedMemoryMB: Math.min(resolutionSizes[targetResolution], maxMemoryMB * 0.7),
      reason: `数据体很大 (${fullSizeMB.toFixed(1)}MB)，分块加载 + 降采样 (${targetResolution})`,
    };
  }

  return {
    strategy: 'pyramid',
    resolution: 'quarter',
    estimatedMemoryMB: resolutionSizes.quarter,
    reason: `数据体超大 (${fullSizeMB.toFixed(1)}MB)，多分辨率金字塔 + 按需加载 + 服务端支持`,
  };
}

export function getResolutionScale(resolution: DataResolutionLevel): number {
  switch (resolution) {
    case 'full': return 1;
    case 'half': return 2;
    case 'quarter': return 4;
    case 'eighth': return 8;
    default: return 1;
  }
}

export function getScaledDimensions(
  inlineCount: number,
  crosslineCount: number,
  timeSamples: number,
  resolution: DataResolutionLevel
): { inlineCount: number; crosslineCount: number; timeSamples: number } {
  const scale = getResolutionScale(resolution);
  return {
    inlineCount: Math.max(1, Math.floor(safeDim(inlineCount) / scale)),
    crosslineCount: Math.max(1, Math.floor(safeDim(crosslineCount) / scale)),
    timeSamples: Math.max(1, Math.floor(safeDim(timeSamples) / scale)),
  };
}

export function formatSizeMB(mb: number): string {
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

import { SeismicDataset, DataLoadOptions, DataLoadStrategy } from '../../../shared/types';
import { DataProvider } from './BaseDataProvider';
import { FullVolumeDataProvider } from './FullVolumeDataProvider';
import { ChunkedDataProvider } from './ChunkedDataProvider';
import { PyramidDataProvider } from './PyramidDataProvider';
import { recommendLoadStrategy, estimateDatasetSizeMB, formatSizeMB } from '../../utils/dataStrategy';

export function createDataProvider(
  dataset: SeismicDataset,
  options: DataLoadOptions = {}
): DataProvider {
  const recommendation = options.strategy
    ? { strategy: options.strategy as DataLoadStrategy }
    : recommendLoadStrategy(dataset, options);

  switch (recommendation.strategy) {
    case 'full':
      return new FullVolumeDataProvider(dataset);
    case 'chunked':
      return new ChunkedDataProvider(dataset);
    case 'pyramid':
      return new PyramidDataProvider(dataset);
    default:
      return new FullVolumeDataProvider(dataset);
  }
}

export function getDataStrategyInfo(dataset: SeismicDataset, options: DataLoadOptions = {}) {
  const recommendation = recommendLoadStrategy(dataset, options);
  const fullSizeMB = estimateDatasetSizeMB(dataset);

  return {
    fullSizeMB,
    fullSizeFormatted: formatSizeMB(fullSizeMB),
    recommendedStrategy: recommendation.strategy,
    recommendedResolution: recommendation.resolution,
    estimatedMemoryMB: recommendation.estimatedMemoryMB,
    estimatedMemoryFormatted: formatSizeMB(recommendation.estimatedMemoryMB),
    reason: recommendation.reason,
    strategies: [
      {
        id: 'full',
        name: '完整加载',
        description: '整个数据体加载到内存，访问最快',
        memoryUsage: formatSizeMB(fullSizeMB),
        suitable: fullSizeMB < 1024,
        pros: ['访问速度最快', '实现最简单', '无缓存失效'],
        cons: ['内存占用大', '大体积数据无法使用'],
      },
      {
        id: 'chunked',
        name: '分块加载',
        description: '按需加载数据块，LRU 缓存管理',
        memoryUsage: '可配置 (默认 512MB)',
        suitable: fullSizeMB >= 1024 && fullSizeMB < 10240,
        pros: ['内存可控', '访问局部性好时效率高', '支持大数据集'],
        cons: ['跨块访问有延迟', '需要缓存管理'],
      },
      {
        id: 'pyramid',
        name: '多分辨率金字塔',
        description: '四级分辨率，从粗到精逐步加载',
        memoryUsage: '低分辨率约为完整的 1/64',
        suitable: fullSizeMB >= 10240,
        pros: ['初始加载极快', '可动态调整分辨率', '支持超大数据集'],
        cons: ['全分辨率需额外加载', '存储开销略大'],
      },
    ],
  };
}

import { create } from 'zustand';
import {
  SeismicDataset,
  SeismicSliceData,
  DataLoadProgress,
  DataStats,
  DataLoadOptions,
  DataLoadStrategy,
  DataResolutionLevel,
  SegyImportOptions,
} from '../../shared/types';
import { MOCK_DATASET, getMockSeismicData } from '../data/mockSeismic';
import { createDataProvider, getDataStrategyInfo } from '../data/providers/dataProviderFactory';
import { DataProvider } from '../data/providers/BaseDataProvider';
import { recommendLoadStrategy } from '../utils/dataStrategy';

interface SeismicState {
  datasets: SeismicDataset[];
  activeDatasetId: string | null;
  dataProvider: DataProvider | null;
  isLoading: boolean;
  loadProgress: DataLoadProgress | null;
  error: string | null;
  stats: DataStats | null;
  strategyInfo: ReturnType<typeof getDataStrategyInfo> | null;

  getActiveDataset: () => SeismicDataset | null;
  addDataset: (dataset: SeismicDataset) => void;
  removeDataset: (id: string) => void;
  setActiveDataset: (id: string) => void;
  loadDataset: (id: string, options?: DataLoadOptions) => Promise<void>;
  importSegy: (file: File, options: SegyImportOptions) => Promise<void>;
  getSlice: (type: 'inline' | 'crossline' | 'timeslice', index: number) => SeismicSliceData;
  getValue: (inline: number, crossline: number, time: number) => number;
  unloadDataset: () => void;
  setLoadStrategy: (strategy: DataLoadStrategy) => void;
  setResolution: (resolution: DataResolutionLevel) => Promise<void>;
  refreshStats: () => void;
}

export const useSeismicStore = create<SeismicState>((set, get) => ({
  datasets: [MOCK_DATASET],
  activeDatasetId: MOCK_DATASET.id,
  dataProvider: null,
  isLoading: false,
  loadProgress: null,
  error: null,
  stats: null,
  strategyInfo: null,

  getActiveDataset: () => {
    const { datasets, activeDatasetId } = get();
    return datasets.find((d) => d.id === activeDatasetId) || null;
  },

  addDataset: (dataset) => {
    const { datasets } = get();
    const exists = datasets.some((d) => d.id === dataset.id);
    if (!exists) {
      set({ datasets: [...datasets, dataset] });
    }
  },

  removeDataset: (id) => {
    const { datasets, activeDatasetId, dataProvider, unloadDataset } = get();
    if (dataProvider && dataProvider.dataset.id === id) {
      unloadDataset();
    }
    const newDatasets = datasets.filter((d) => d.id !== id);
    const newActiveId = activeDatasetId === id
      ? newDatasets[0]?.id || null
      : activeDatasetId;
    set({
      datasets: newDatasets,
      activeDatasetId: newActiveId,
    });
  },

  setActiveDataset: (id) => {
    const { datasets, loadDataset } = get();
    const dataset = datasets.find((d) => d.id === id);
    if (!dataset) return;

    set({ activeDatasetId: id });
    loadDataset(id);
  },

  loadDataset: async (id: string, options: DataLoadOptions = {}) => {
    const dataset = get().datasets.find((d) => d.id === id);
    if (!dataset) {
      set({ error: 'Dataset not found' });
      return;
    }

    const strategyInfo = getDataStrategyInfo(dataset, options);
    set({ strategyInfo });

    const existingProvider = get().dataProvider;
    if (existingProvider && existingProvider.dataset.id === id && existingProvider.isLoaded) {
      return;
    }

    set({ isLoading: true, error: null, loadProgress: null });

    try {
      if (existingProvider) {
        existingProvider.unload();
      }

      const provider = createDataProvider(dataset, options);

      const unsubscribe = provider.onProgress((progress) => {
        set({ loadProgress: progress });
      });

      await provider.load(options);

      set({
        activeDatasetId: id,
        dataProvider: provider,
        isLoading: false,
        stats: provider.getStats(),
        loadProgress: {
          total: 100,
          loaded: 100,
          percentage: 100,
          currentStage: '加载完成',
          speed: 0,
          eta: 0,
        },
      });

      unsubscribe();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load dataset',
        isLoading: false,
      });
    }
  },

  importSegy: async (file: File, options: SegyImportOptions) => {
    set({ isLoading: true, error: null, loadProgress: null });

    try {
      const datasetId = `segy-${Date.now()}`;

      set({
        loadProgress: {
          total: 100,
          loaded: 10,
          percentage: 10,
          currentStage: '读取 SEGY 文件头...',
          speed: 0,
          eta: 0,
        },
      });

      await new Promise((r) => setTimeout(r, 300));

      const mockInlineCount = Math.floor(Math.random() * 50) + 80;
      const mockCrosslineCount = Math.floor(Math.random() * 60) + 100;
      const mockTimeSamples = Math.floor(Math.random() * 100) + 150;

      const newDataset: SeismicDataset = {
        id: datasetId,
        name: options.datasetName || file.name.replace(/\.(segy|sgy)$/i, ''),
        inlineCount: mockInlineCount,
        crosslineCount: mockCrosslineCount,
        timeSamples: mockTimeSamples,
        sampleInterval: 4,
        inlineStart: 1000,
        crosslineStart: 2000,
        timeStart: 0,
        inlineStep: 25,
        crosslineStep: 25,
        source: 'segy',
        createdAt: new Date(),
      };

      set({
        loadProgress: {
          total: 100,
          loaded: 40,
          percentage: 40,
          currentStage: '解析道头数据...',
          speed: 0,
          eta: 0,
        },
      });

      await new Promise((r) => setTimeout(r, 400));

      const { datasets } = get();
      set({ datasets: [...datasets, newDataset] });

      set({
        loadProgress: {
          total: 100,
          loaded: 70,
          percentage: 70,
          currentStage: '构建数据体...',
          speed: 0,
          eta: 0,
        },
      });

      await new Promise((r) => setTimeout(r, 300));

      const strategyInfo = getDataStrategyInfo(newDataset);
      const provider = createDataProvider(newDataset);

      const unsubscribe = provider.onProgress((progress) => {
        set({ loadProgress: progress });
      });

      await provider.load();

      set({
        activeDatasetId: datasetId,
        dataProvider: provider,
        isLoading: false,
        stats: provider.getStats(),
        strategyInfo,
        loadProgress: {
          total: 100,
          loaded: 100,
          percentage: 100,
          currentStage: '导入完成',
          speed: 0,
          eta: 0,
        },
      });

      unsubscribe();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '导入失败',
        isLoading: false,
      });
      throw err;
    }
  },

  getSlice: (type: 'inline' | 'crossline' | 'timeslice', index: number): SeismicSliceData => {
    const provider = get().dataProvider;
    if (!provider || !provider.isLoaded) {
      return {
        data: new Float32Array(0),
        width: 0,
        height: 0,
        minValue: 0,
        maxValue: 0,
      };
    }
    return provider.getSlice(type, index);
  },

  getValue: (inline: number, crossline: number, time: number): number => {
    const provider = get().dataProvider;
    if (!provider || !provider.isLoaded) return 0;
    return provider.getValue(inline, crossline, time);
  },

  unloadDataset: () => {
    const provider = get().dataProvider;
    if (provider) {
      provider.unload();
    }
    set({ dataProvider: null, stats: null, loadProgress: null });
  },

  setLoadStrategy: (_strategy: DataLoadStrategy) => {},

  setResolution: async (_resolution: DataResolutionLevel) => {},

  refreshStats: () => {
    const provider = get().dataProvider;
    if (provider && provider.isLoaded) {
      set({ stats: provider.getStats() });
    }
  },
}));

export { recommendLoadStrategy, getDataStrategyInfo, getMockSeismicData };

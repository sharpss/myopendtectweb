import { create } from 'zustand';
import {
  SeismicDataset,
  SeismicSliceData,
  DataLoadProgress,
  DataStats,
  DataLoadOptions,
  DataLoadStrategy,
  DataResolutionLevel,
} from '../../shared/types';
import { MOCK_DATASET } from '../data/mockSeismic';
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

  loadDataset: (id: string, options?: DataLoadOptions) => Promise<void>;
  uploadSegy: (file: File) => Promise<void>;
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

  uploadSegy: async (_file: File) => {
    set({ isLoading: true, error: null });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    set({ isLoading: false });
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

export { recommendLoadStrategy, getDataStrategyInfo };

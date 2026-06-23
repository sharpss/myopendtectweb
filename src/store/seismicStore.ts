import { create } from 'zustand';
import { SeismicDataset, SeismicSliceData } from '../../shared/types';
import { MOCK_DATASET, getMockSeismicData, getInlineSlice, getCrosslineSlice, getTimeSlice } from '../data/mockSeismic';

interface SeismicState {
  datasets: SeismicDataset[];
  activeDatasetId: string | null;
  dataVolume: Float32Array | null;
  isLoading: boolean;
  error: string | null;
  loadDataset: (id: string) => Promise<void>;
  uploadSegy: (file: File) => Promise<void>;
  getSlice: (type: 'inline' | 'crossline' | 'timeslice', index: number) => SeismicSliceData;
}

export const useSeismicStore = create<SeismicState>((set, get) => ({
  datasets: [MOCK_DATASET],
  activeDatasetId: MOCK_DATASET.id,
  dataVolume: null,
  isLoading: false,
  error: null,

  loadDataset: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const dataset = get().datasets.find(d => d.id === id);
      if (!dataset) throw new Error('Dataset not found');
      
      const data = getMockSeismicData();
      set({ activeDatasetId: id, dataVolume: data, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load dataset', isLoading: false });
    }
  },

  uploadSegy: async (_file: File) => {
    set({ isLoading: true, error: null });
    await new Promise(resolve => setTimeout(resolve, 1000));
    set({ isLoading: false });
  },

  getSlice: (type: 'inline' | 'crossline' | 'timeslice', index: number) => {
    switch (type) {
      case 'inline':
        return getInlineSlice(index);
      case 'crossline':
        return getCrosslineSlice(index);
      case 'timeslice':
        return getTimeSlice(index);
    }
  },
}));

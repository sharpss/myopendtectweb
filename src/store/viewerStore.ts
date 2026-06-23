import { create } from 'zustand';
import { ViewerMode, ColormapType } from '../../shared/types';

interface ViewerStoreState {
  viewMode: ViewerMode;
  inlineIndex: number;
  crosslineIndex: number;
  timeIndex: number;
  colormap: ColormapType;
  opacity: number;
  brightness: number;
  contrast: number;
  showAxes: boolean;
  showColorbar: boolean;
  setViewMode: (mode: ViewerMode) => void;
  setInlineIndex: (index: number) => void;
  setCrosslineIndex: (index: number) => void;
  setTimeIndex: (index: number) => void;
  setColormap: (colormap: ColormapType) => void;
  setOpacity: (opacity: number) => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  toggleAxes: () => void;
  toggleColorbar: () => void;
}

export const useViewerStore = create<ViewerStoreState>((set) => ({
  viewMode: 'quad',
  inlineIndex: 50,
  crosslineIndex: 60,
  timeIndex: 100,
  colormap: 'seismic',
  opacity: 0.9,
  brightness: 0,
  contrast: 0,
  showAxes: true,
  showColorbar: true,

  setViewMode: (mode) => set({ viewMode: mode }),
  setInlineIndex: (index) => set({ inlineIndex: index }),
  setCrosslineIndex: (index) => set({ crosslineIndex: index }),
  setTimeIndex: (index) => set({ timeIndex: index }),
  setColormap: (colormap) => set({ colormap }),
  setOpacity: (opacity) => set({ opacity }),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),
  toggleColorbar: () => set((state) => ({ showColorbar: !state.showColorbar })),
}));

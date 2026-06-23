import { create } from 'zustand';
import { ViewerMode, ColormapType } from '../../shared/types';

export type CameraPreset = 'perspective' | 'front' | 'top' | 'side' | 'iso';
export type SliceVisibility = {
  inline: boolean;
  crossline: boolean;
  timeslice: boolean;
  volumeBox: boolean;
  grid: boolean;
};

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
  cameraPreset: CameraPreset;
  sliceVisibility: SliceVisibility;
  isAnimating: boolean;
  animationSpeed: number;
  animationDirection: 'forward' | 'backward';
  animationSlice: 'inline' | 'crossline' | 'timeslice';
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
  setCameraPreset: (preset: CameraPreset) => void;
  setSliceVisibility: (visibility: Partial<SliceVisibility>) => void;
  toggleSlice: (slice: keyof SliceVisibility) => void;
  startAnimation: (slice: 'inline' | 'crossline' | 'timeslice') => void;
  stopAnimation: () => void;
  setAnimationSpeed: (speed: number) => void;
  setAnimationDirection: (direction: 'forward' | 'backward') => void;
}

export const useViewerStore = create<ViewerStoreState>((set, get) => ({
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
  cameraPreset: 'perspective',
  sliceVisibility: {
    inline: true,
    crossline: true,
    timeslice: true,
    volumeBox: true,
    grid: true,
  },
  isAnimating: false,
  animationSpeed: 1,
  animationDirection: 'forward',
  animationSlice: 'timeslice',

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
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setSliceVisibility: (visibility) =>
    set((state) => ({ sliceVisibility: { ...state.sliceVisibility, ...visibility } })),
  toggleSlice: (slice) =>
    set((state) => ({
      sliceVisibility: { ...state.sliceVisibility, [slice]: !state.sliceVisibility[slice] },
    })),
  startAnimation: (slice) => set({ isAnimating: true, animationSlice: slice }),
  stopAnimation: () => set({ isAnimating: false }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  setAnimationDirection: (direction) => set({ animationDirection: direction }),
}));

import { create } from 'zustand';
import { ViewerMode, ColormapType, DisplayMode, PickMode, WigglePolarity, Point3D } from '../../shared/types';

export type CameraPreset = 'perspective' | 'front' | 'top' | 'side' | 'iso';
export type SliceVisibility = {
  inline: boolean;
  crossline: boolean;
  timeslice: boolean;
  volumeBox: boolean;
  grid: boolean;
};

export interface CursorPosition {
  inline: number;
  crossline: number;
  time: number;
  value: number | null;
}

interface ViewerStoreState {
  viewMode: ViewerMode;
  inlineIndex: number;
  crosslineIndex: number;
  timeIndex: number;
  colormap: ColormapType;
  opacity: number;
  brightness: number;
  contrast: number;
  displayMode: DisplayMode;
  gain: number;
  agcWindow: number;
  wiggleOverlap: number;
  wigglePolarity: WigglePolarity;
  pickMode: PickMode;
  showCrosshair: boolean;
  showTraceSpacing: boolean;
  crosshairPosition: Point3D | null;
  showAxes: boolean;
  showColorbar: boolean;
  cameraPreset: CameraPreset;
  sliceVisibility: SliceVisibility;
  isAnimating: boolean;
  animationSpeed: number;
  animationDirection: 'forward' | 'backward';
  animationSlice: 'inline' | 'crossline' | 'timeslice';
  cursorPosition: CursorPosition | null;
  setViewMode: (mode: ViewerMode) => void;
  setInlineIndex: (index: number) => void;
  setCrosslineIndex: (index: number) => void;
  setTimeIndex: (index: number) => void;
  setColormap: (colormap: ColormapType) => void;
  setOpacity: (opacity: number) => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setGain: (gain: number) => void;
  setAgcWindow: (window: number) => void;
  setWiggleOverlap: (overlap: number) => void;
  setWigglePolarity: (polarity: WigglePolarity) => void;
  setPickMode: (mode: PickMode) => void;
  setShowCrosshair: (show: boolean) => void;
  setShowTraceSpacing: (show: boolean) => void;
  setCrosshairPosition: (pos: Point3D | null) => void;
  setSliceIndices: (indices: { inline?: number; crossline?: number; time?: number }) => void;
  jumpToPosition: (inline: number, crossline: number, time: number) => void;
  toggleAxes: () => void;
  toggleColorbar: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSliceVisibility: (visibility: Partial<SliceVisibility>) => void;
  toggleSlice: (slice: keyof SliceVisibility) => void;
  startAnimation: (slice: 'inline' | 'crossline' | 'timeslice') => void;
  stopAnimation: () => void;
  setAnimationSpeed: (speed: number) => void;
  setAnimationDirection: (direction: 'forward' | 'backward') => void;
  setCursorPosition: (pos: CursorPosition | null) => void;
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
  displayMode: 'vd',
  gain: 1,
  agcWindow: 50,
  wiggleOverlap: 0.5,
  wigglePolarity: 'positive',
  pickMode: 'peak',
  showCrosshair: true,
  showTraceSpacing: false,
  crosshairPosition: null,
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
  cursorPosition: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  setInlineIndex: (index) => set({ inlineIndex: index }),
  setCrosslineIndex: (index) => set({ crosslineIndex: index }),
  setTimeIndex: (index) => set({ timeIndex: index }),
  setColormap: (colormap) => set({ colormap }),
  setOpacity: (opacity) => set({ opacity }),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setGain: (gain) => set({ gain }),
  setAgcWindow: (window) => set({ agcWindow: window }),
  setWiggleOverlap: (overlap) => set({ wiggleOverlap: overlap }),
  setWigglePolarity: (polarity) => set({ wigglePolarity: polarity }),
  setPickMode: (mode) => set({ pickMode: mode }),
  setShowCrosshair: (show) => set({ showCrosshair: show }),
  setShowTraceSpacing: (show) => set({ showTraceSpacing: show }),
  setCrosshairPosition: (pos) => set({ crosshairPosition: pos }),
  
  setSliceIndices: (indices) => set((state) => ({
    inlineIndex: indices.inline ?? state.inlineIndex,
    crosslineIndex: indices.crossline ?? state.crosslineIndex,
    timeIndex: indices.time ?? state.timeIndex,
  })),
  
  jumpToPosition: (inline, crossline, time) => {
    const state = get();
    set({
      inlineIndex: Math.max(0, Math.floor(inline)),
      crosslineIndex: Math.max(0, Math.floor(crossline)),
      timeIndex: Math.max(0, Math.floor(time)),
      crosshairPosition: { x: inline, y: crossline, z: time },
    });
  },
  
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
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
}));

import { useEffect } from 'react';
import { useViewerStore } from '../store/viewerStore';

const SETTINGS_KEY = 'seismic-viewer-viewer-settings';

interface PersistedSettings {
  viewer: {
    colormap: string;
    opacity: number;
    brightness: number;
    contrast: number;
    displayMode: string;
    gain: number;
    agcWindow: number;
    wiggleOverlap: number;
    wigglePolarity: string;
    pickMode: string;
    showCrosshair: boolean;
    showTraceSpacing: boolean;
    showAxes: boolean;
    projection: string;
    sliceVisibility: {
      inline: boolean;
      crossline: boolean;
      timeslice: boolean;
      volumeBox: boolean;
      grid: boolean;
    };
  };
  version: number;
}

const CURRENT_VERSION = 1;

export function useSettingsPersistence() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved) as PersistedSettings;
        if (settings.version === CURRENT_VERSION && settings.viewer) {
          const v = settings.viewer;
          const viewerState = useViewerStore.getState();
          
          if (v.colormap) viewerState.setColormap(v.colormap as any);
          if (typeof v.opacity === 'number') viewerState.setOpacity(v.opacity);
          if (typeof v.brightness === 'number') viewerState.setBrightness(v.brightness);
          if (typeof v.contrast === 'number') viewerState.setContrast(v.contrast);
          if (v.displayMode) viewerState.setDisplayMode(v.displayMode as any);
          if (typeof v.gain === 'number') viewerState.setGain(v.gain);
          if (typeof v.agcWindow === 'number') viewerState.setAgcWindow(v.agcWindow);
          if (typeof v.wiggleOverlap === 'number') viewerState.setWiggleOverlap(v.wiggleOverlap);
          if (v.wigglePolarity) viewerState.setWigglePolarity(v.wigglePolarity as any);
          if (v.pickMode) viewerState.setPickMode(v.pickMode as any);
          if (typeof v.showCrosshair === 'boolean') viewerState.setShowCrosshair(v.showCrosshair);
          if (typeof v.showTraceSpacing === 'boolean') viewerState.setShowTraceSpacing(v.showTraceSpacing);
          if (typeof v.showAxes === 'boolean') {
            const { showAxes, toggleAxes } = viewerState;
            if (showAxes !== v.showAxes) toggleAxes();
          }
          if (v.projection) viewerState.setProjection(v.projection as any);
          if (v.sliceVisibility) viewerState.setSliceVisibility(v.sliceVisibility);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved viewer settings:', e);
    }
  }, []);

  useEffect(() => {
    const saveSettings = () => {
      try {
        const viewer = useViewerStore.getState();
        
        const settings: PersistedSettings = {
          viewer: {
            colormap: viewer.colormap,
            opacity: viewer.opacity,
            brightness: viewer.brightness,
            contrast: viewer.contrast,
            displayMode: viewer.displayMode,
            gain: viewer.gain,
            agcWindow: viewer.agcWindow,
            wiggleOverlap: viewer.wiggleOverlap,
            wigglePolarity: viewer.wigglePolarity,
            pickMode: viewer.pickMode,
            showCrosshair: viewer.showCrosshair,
            showTraceSpacing: viewer.showTraceSpacing,
            showAxes: viewer.showAxes,
            projection: viewer.projection,
            sliceVisibility: { ...viewer.sliceVisibility },
          },
          version: CURRENT_VERSION,
        };
        
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn('Failed to save viewer settings:', e);
      }
    };

    let timeoutId: number | null = null;
    const debouncedSave = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(saveSettings, 500);
    };

    const unsub = useViewerStore.subscribe(debouncedSave);

    return () => {
      unsub();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
}

import { create } from 'zustand';
import { ToolType, Horizon, Fault, Point3D, SliceType } from '../../shared/types';
import { generateMockHorizons, generateMockFaults } from '../data/mockSeismic';
import { MOCK_DATASET } from '../data/mockSeismic';

interface InterpretationState {
  activeTool: ToolType;
  horizons: Horizon[];
  faults: Fault[];
  activeHorizonId: string | null;
  activeFaultId: string | null;
  isPicking: boolean;
  currentPickPoints: Point3D[];
  undoStack: { horizons: Horizon[]; faults: Fault[] }[];
  redoStack: { horizons: Horizon[]; faults: Fault[] }[];
  setActiveTool: (tool: ToolType) => void;
  addHorizon: (name: string, color?: string) => void;
  addFault: (name: string, color?: string) => void;
  deleteHorizon: (id: string) => void;
  deleteFault: (id: string) => void;
  toggleHorizonVisible: (id: string) => void;
  toggleFaultVisible: (id: string) => void;
  setActiveHorizon: (id: string | null) => void;
  setActiveFault: (id: string | null) => void;
  updateHorizonColor: (id: string, color: string) => void;
  updateFaultColor: (id: string, color: string) => void;
  renameHorizon: (id: string, name: string) => void;
  renameFault: (id: string, name: string) => void;
  startPicking: () => void;
  addPickPoint: (point: Point3D) => void;
  removeLastPickPoint: () => void;
  finishPicking: () => void;
  cancelPicking: () => void;
  undo: () => void;
  redo: () => void;
  autoTrackHorizon: (
    horizonId: string,
    sliceType: SliceType,
    sliceIndex: number,
    direction: 'forward' | 'backward',
    steps: number
  ) => void;
}

const mockHorizons = generateMockHorizons();
const mockFaults = generateMockFaults();

const horizonColors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
const faultColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#14b8a6', '#6366f1'];

export const useInterpretationStore = create<InterpretationState>((set, get) => ({
  activeTool: 'select',
  horizons: mockHorizons,
  faults: mockFaults,
  activeHorizonId: mockHorizons[0]?.id || null,
  activeFaultId: null,
  isPicking: false,
  currentPickPoints: [],
  undoStack: [],
  redoStack: [],

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    if (tool !== 'horizon' && tool !== 'fault') {
      set({ isPicking: false, currentPickPoints: [] });
    }
  },

  addHorizon: (name, color) => {
    const { horizons, undoStack } = get();
    const newHorizon: Horizon = {
      id: `horizon-${Date.now()}`,
      name,
      datasetId: 'mock-dataset-001',
      color: color || horizonColors[horizons.length % horizonColors.length],
      points: [],
      visible: true,
      createdAt: new Date(),
    };
    set({
      horizons: [...horizons, newHorizon],
      activeHorizonId: newHorizon.id,
      undoStack: [...undoStack, { horizons: JSON.parse(JSON.stringify(horizons)), faults: JSON.parse(JSON.stringify(get().faults)) }].slice(-50),
      redoStack: [],
    });
  },

  addFault: (name, color) => {
    const { faults, undoStack, horizons } = get();
    const newFault: Fault = {
      id: `fault-${Date.now()}`,
      name,
      datasetId: 'mock-dataset-001',
      color: color || faultColors[faults.length % faultColors.length],
      vertices: [],
      throw: 0,
      visible: true,
      createdAt: new Date(),
    };
    set({
      faults: [...faults, newFault],
      activeFaultId: newFault.id,
      undoStack: [...undoStack, { horizons: JSON.parse(JSON.stringify(horizons)), faults: JSON.parse(JSON.stringify(faults)) }].slice(-50),
      redoStack: [],
    });
  },

  deleteHorizon: (id) => {
    const { horizons, faults, undoStack } = get();
    set((state) => ({
      horizons: state.horizons.filter(h => h.id !== id),
      activeHorizonId: state.activeHorizonId === id ? null : state.activeHorizonId,
      undoStack: [...undoStack, { horizons: JSON.parse(JSON.stringify(horizons)), faults: JSON.parse(JSON.stringify(faults)) }].slice(-50),
      redoStack: [],
    }));
  },

  deleteFault: (id) => {
    const { horizons, faults, undoStack } = get();
    set((state) => ({
      faults: state.faults.filter(f => f.id !== id),
      activeFaultId: state.activeFaultId === id ? null : state.activeFaultId,
      undoStack: [...undoStack, { horizons: JSON.parse(JSON.stringify(horizons)), faults: JSON.parse(JSON.stringify(faults)) }].slice(-50),
      redoStack: [],
    }));
  },

  toggleHorizonVisible: (id) => {
    set((state) => ({
      horizons: state.horizons.map(h =>
        h.id === id ? { ...h, visible: !h.visible } : h
      ),
    }));
  },

  toggleFaultVisible: (id) => {
    set((state) => ({
      faults: state.faults.map(f =>
        f.id === id ? { ...f, visible: !f.visible } : f
      ),
    }));
  },

  setActiveHorizon: (id) => set({ activeHorizonId: id }),
  setActiveFault: (id) => set({ activeFaultId: id }),

  updateHorizonColor: (id, color) => {
    const { horizons, faults, undoStack } = get();
    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };
    set((state) => ({
      horizons: state.horizons.map(h =>
        h.id === id ? { ...h, color } : h
      ),
      undoStack: [...undoStack, snapshot].slice(-50),
      redoStack: [],
    }));
  },

  updateFaultColor: (id, color) => {
    const { horizons, faults, undoStack } = get();
    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };
    set((state) => ({
      faults: state.faults.map(f =>
        f.id === id ? { ...f, color } : f
      ),
      undoStack: [...undoStack, snapshot].slice(-50),
      redoStack: [],
    }));
  },

  renameHorizon: (id, name) => {
    const { horizons, faults, undoStack } = get();
    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };
    set((state) => ({
      horizons: state.horizons.map(h =>
        h.id === id ? { ...h, name } : h
      ),
      undoStack: [...undoStack, snapshot].slice(-50),
      redoStack: [],
    }));
  },

  renameFault: (id, name) => {
    const { horizons, faults, undoStack } = get();
    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };
    set((state) => ({
      faults: state.faults.map(f =>
        f.id === id ? { ...f, name } : f
      ),
      undoStack: [...undoStack, snapshot].slice(-50),
      redoStack: [],
    }));
  },

  startPicking: () => set({ isPicking: true, currentPickPoints: [] }),

  addPickPoint: (point) => {
    set((state) => ({
      currentPickPoints: [...state.currentPickPoints, point],
    }));
  },

  removeLastPickPoint: () => {
    set((state) => ({
      currentPickPoints: state.currentPickPoints.slice(0, -1),
    }));
  },

  finishPicking: () => {
    const { activeTool, currentPickPoints, activeHorizonId, activeFaultId, horizons, faults, undoStack } = get();
    
    if (currentPickPoints.length === 0) {
      set({ isPicking: false, currentPickPoints: [] });
      return;
    }

    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };

    if (activeTool === 'horizon' && activeHorizonId) {
      set({
        horizons: horizons.map(h =>
          h.id === activeHorizonId
            ? { ...h, points: [...h.points, ...currentPickPoints] }
            : h
        ),
        isPicking: false,
        currentPickPoints: [],
        undoStack: [...undoStack, snapshot].slice(-50),
        redoStack: [],
      });
    } else if (activeTool === 'fault' && activeFaultId) {
      set({
        faults: faults.map(f =>
          f.id === activeFaultId
            ? { ...f, vertices: [...f.vertices, ...currentPickPoints] }
            : f
        ),
        isPicking: false,
        currentPickPoints: [],
        undoStack: [...undoStack, snapshot].slice(-50),
        redoStack: [],
      });
    } else {
      set({ isPicking: false, currentPickPoints: [] });
    }
  },

  cancelPicking: () => set({ isPicking: false, currentPickPoints: [] }),

  undo: () => {
    const { undoStack, horizons, faults, redoStack } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const current = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };

    set({
      horizons: previous.horizons,
      faults: previous.faults,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current].slice(-50),
    });
  },

  redo: () => {
    const { redoStack, horizons, faults, undoStack } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    const current = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };

    set({
      horizons: next.horizons,
      faults: next.faults,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current].slice(-50),
    });
  },

  autoTrackHorizon: (horizonId, sliceType, sliceIndex, direction, steps) => {
    const { horizons, undoStack, faults } = get();
    const horizon = horizons.find(h => h.id === horizonId);
    if (!horizon) return;

    const snapshot = {
      horizons: JSON.parse(JSON.stringify(horizons)),
      faults: JSON.parse(JSON.stringify(faults)),
    };

    const newPoints: Point3D[] = [];
    const { inlineCount, crosslineCount, timeSamples, inlineStep, crosslineStep, sampleInterval, inlineStart, crosslineStart, timeStart } = MOCK_DATASET;

    const seedPoints = horizon.points.filter(p => {
      if (sliceType === 'inline') {
        const idx = Math.round((p.x - inlineStart) / inlineStep);
        return Math.abs(idx - sliceIndex) < 2;
      } else if (sliceType === 'crossline') {
        const idx = Math.round((p.y - crosslineStart) / crosslineStep);
        return Math.abs(idx - sliceIndex) < 2;
      } else {
        const idx = Math.round((p.z - timeStart) / sampleInterval);
        return Math.abs(idx - sliceIndex) < 2;
      }
    });

    if (seedPoints.length === 0) return;

    const stepDir = direction === 'forward' ? 1 : -1;

    for (let step = 1; step <= steps; step++) {
      const currentIdx = sliceIndex + step * stepDir;

      if (sliceType === 'inline' && (currentIdx < 0 || currentIdx >= inlineCount)) break;
      if (sliceType === 'crossline' && (currentIdx < 0 || currentIdx >= crosslineCount)) break;
      if (sliceType === 'timeslice' && (currentIdx < 0 || currentIdx >= timeSamples)) break;

      seedPoints.forEach((seedPt, i) => {
        const jitter = (Math.random() - 0.5) * 20;
        let point: Point3D;

        if (sliceType === 'inline') {
          point = {
            x: inlineStart + currentIdx * inlineStep,
            y: seedPt.y + jitter,
            z: seedPt.z + jitter * 0.5,
          };
        } else if (sliceType === 'crossline') {
          point = {
            x: seedPt.x + jitter,
            y: crosslineStart + currentIdx * crosslineStep,
            z: seedPt.z + jitter * 0.5,
          };
        } else {
          point = {
            x: seedPt.x + jitter,
            y: seedPt.y + jitter,
            z: timeStart + currentIdx * sampleInterval,
          };
        }

        newPoints.push(point);
      });
    }

    set({
      horizons: horizons.map(h =>
        h.id === horizonId
          ? { ...h, points: [...h.points, ...newPoints] }
          : h
      ),
      undoStack: [...undoStack, snapshot].slice(-50),
      redoStack: [],
    });
  },
}));

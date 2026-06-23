import { create } from 'zustand';
import { ToolType, Horizon, Fault, Point3D } from '../../shared/types';
import { generateMockHorizons, generateMockFaults } from '../data/mockSeismic';

interface InterpretationState {
  activeTool: ToolType;
  horizons: Horizon[];
  faults: Fault[];
  activeHorizonId: string | null;
  activeFaultId: string | null;
  isPicking: boolean;
  currentPickPoints: Point3D[];
  setActiveTool: (tool: ToolType) => void;
  addHorizon: (name: string, color?: string) => void;
  addFault: (name: string, color?: string) => void;
  deleteHorizon: (id: string) => void;
  deleteFault: (id: string) => void;
  toggleHorizonVisible: (id: string) => void;
  toggleFaultVisible: (id: string) => void;
  setActiveHorizon: (id: string | null) => void;
  setActiveFault: (id: string | null) => void;
  startPicking: () => void;
  addPickPoint: (point: Point3D) => void;
  finishPicking: () => void;
  cancelPicking: () => void;
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

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    if (tool !== 'horizon' && tool !== 'fault') {
      set({ isPicking: false, currentPickPoints: [] });
    }
  },

  addHorizon: (name, color) => {
    const { horizons } = get();
    const newHorizon: Horizon = {
      id: `horizon-${Date.now()}`,
      name,
      datasetId: 'mock-dataset-001',
      color: color || horizonColors[horizons.length % horizonColors.length],
      points: [],
      visible: true,
      createdAt: new Date(),
    };
    set({ horizons: [...horizons, newHorizon], activeHorizonId: newHorizon.id });
  },

  addFault: (name, color) => {
    const { faults } = get();
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
    set({ faults: [...faults, newFault], activeFaultId: newFault.id });
  },

  deleteHorizon: (id) => {
    set((state) => ({
      horizons: state.horizons.filter(h => h.id !== id),
      activeHorizonId: state.activeHorizonId === id ? null : state.activeHorizonId,
    }));
  },

  deleteFault: (id) => {
    set((state) => ({
      faults: state.faults.filter(f => f.id !== id),
      activeFaultId: state.activeFaultId === id ? null : state.activeFaultId,
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

  startPicking: () => set({ isPicking: true, currentPickPoints: [] }),

  addPickPoint: (point) => {
    set((state) => ({
      currentPickPoints: [...state.currentPickPoints, point],
    }));
  },

  finishPicking: () => {
    const { activeTool, currentPickPoints, activeHorizonId, activeFaultId, horizons, faults } = get();
    
    if (activeTool === 'horizon' && activeHorizonId) {
      set({
        horizons: horizons.map(h =>
          h.id === activeHorizonId
            ? { ...h, points: [...h.points, ...currentPickPoints] }
            : h
        ),
        isPicking: false,
        currentPickPoints: [],
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
      });
    } else {
      set({ isPicking: false, currentPickPoints: [] });
    }
  },

  cancelPicking: () => set({ isPicking: false, currentPickPoints: [] }),
}));

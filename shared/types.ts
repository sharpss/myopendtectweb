export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface SeismicDataset {
  id: string;
  name: string;
  inlineCount: number;
  crosslineCount: number;
  timeSamples: number;
  sampleInterval: number;
  inlineStart: number;
  crosslineStart: number;
  timeStart: number;
  inlineStep: number;
  crosslineStep: number;
  source: 'mock' | 'segy' | 'api';
  createdAt: Date;
}

export interface Horizon {
  id: string;
  name: string;
  datasetId: string;
  color: string;
  points: Point3D[];
  visible: boolean;
  createdAt: Date;
}

export interface Fault {
  id: string;
  name: string;
  datasetId: string;
  color: string;
  vertices: Point3D[];
  throw: number;
  visible: boolean;
  createdAt: Date;
}

export interface Attribute {
  id: string;
  name: string;
  datasetId: string;
  type: 'amplitude' | 'coherence' | 'curvature' | 'instantaneous_phase' | 'instantaneous_frequency';
  params: Record<string, any>;
  createdAt: Date;
}

export type ViewerMode = '3d' | 'inline' | 'crossline' | 'timeslice' | 'quad';

export type SliceType = 'inline' | 'crossline' | 'timeslice';

export type ToolType = 'select' | 'horizon' | 'fault' | 'zoom' | 'pan' | 'rotate' | 'measure';

export type ColormapType = 'seismic' | 'gray' | 'rainbow' | 'hot' | 'cool' | 'viridis' | 'plasma';

export interface ViewerState {
  viewMode: ViewerMode;
  inlineIndex: number;
  crosslineIndex: number;
  timeIndex: number;
  colormap: ColormapType;
  opacity: number;
  brightness: number;
  contrast: number;
}

export interface SeismicSliceData {
  data: Float32Array;
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
}

export interface SegyHeader {
  inlineRange: [number, number];
  crosslineRange: [number, number];
  timeRange: [number, number];
  sampleInterval: number;
  inlineCount: number;
  crosslineCount: number;
  timeSamples: number;
}

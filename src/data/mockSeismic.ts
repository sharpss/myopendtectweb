import { SeismicDataset, Point3D, Horizon, Fault } from '../../shared/types';

export const MOCK_DATASET: SeismicDataset = {
  id: 'mock-dataset-001',
  name: 'Demo Seismic Volume',
  inlineCount: 100,
  crosslineCount: 120,
  timeSamples: 200,
  sampleInterval: 4,
  inlineStart: 1000,
  crosslineStart: 2000,
  timeStart: 0,
  inlineStep: 25,
  crosslineStep: 25,
  source: 'mock',
  createdAt: new Date(),
};

function generateSynthSeismicData(
  inlineCount: number,
  crosslineCount: number,
  timeSamples: number
): Float32Array {
  const total = inlineCount * crosslineCount * timeSamples;
  const data = new Float32Array(total);
  
  for (let il = 0; il < inlineCount; il++) {
    for (let xl = 0; xl < crosslineCount; xl++) {
      const baseHorizon = Math.floor(
        80 +
          20 * Math.sin(il * 0.08) * Math.cos(xl * 0.06) +
          10 * Math.sin(il * 0.15 + xl * 0.1)
      );
      
      for (let t = 0; t < timeSamples; t++) {
        const idx = (il * crosslineCount + xl) * timeSamples + t;
        
        let value = 0;
        
        const noise = (Math.random() - 0.5) * 0.15;
        value += noise;
        
        const depthFromHorizon = t - baseHorizon;
        
        const mainReflector = Math.exp(-Math.abs(depthFromHorizon) * 0.15) * 
          Math.sin(depthFromHorizon * 0.8) * 0.6;
        value += mainReflector;
        
        const secondHorizon = baseHorizon + 30 + 5 * Math.sin(il * 0.05 + xl * 0.07);
        const depthFromSecond = t - secondHorizon;
        const secondReflector = Math.exp(-Math.abs(depthFromSecond) * 0.2) * 
          Math.sin(depthFromSecond * 1.0) * 0.4;
        value += secondReflector;
        
        const thirdHorizon = baseHorizon + 60 + 8 * Math.cos(il * 0.03) * Math.sin(xl * 0.04);
        const depthFromThird = t - thirdHorizon;
        const thirdReflector = Math.exp(-Math.abs(depthFromThird) * 0.12) * 
          Math.sin(depthFromThird * 0.6) * 0.5;
        value += thirdReflector;
        
        const faultOffset = xl > 60 ? 8 * Math.sin((xl - 60) * 0.2) : 0;
        const faultModulation = Math.max(0, 1 - Math.abs(xl - 60) * 0.08) * 
          Math.sin(il * 0.1) * 0.3;
        
        if (xl > 55 && xl < 65) {
          value += faultModulation * Math.exp(-Math.abs(depthFromHorizon) * 0.1);
        }
        
        const stratigraphic = 0.15 * Math.sin(t * 0.3 + il * 0.02 + xl * 0.03) * 
          Math.exp(-Math.abs(depthFromHorizon - 15) * 0.05);
        value += stratigraphic;
        
        value = Math.max(-1, Math.min(1, value));
        
        data[idx] = value;
      }
    }
  }
  
  return data;
}

let cachedData: Float32Array | null = null;

export function getMockSeismicData(): Float32Array {
  if (!cachedData) {
    cachedData = generateSynthSeismicData(
      MOCK_DATASET.inlineCount,
      MOCK_DATASET.crosslineCount,
      MOCK_DATASET.timeSamples
    );
  }
  return cachedData;
}

export function getInlineSlice(inlineIndex: number): {
  data: Float32Array;
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
} {
  const volume = getMockSeismicData();
  const { crosslineCount, timeSamples, inlineCount } = MOCK_DATASET;
  
  const width = crosslineCount;
  const height = timeSamples;
  const sliceData = new Float32Array(width * height);
  
  let minVal = Infinity;
  let maxVal = -Infinity;
  
  const il = Math.max(0, Math.min(inlineCount - 1, inlineIndex));
  
  for (let xl = 0; xl < crosslineCount; xl++) {
    for (let t = 0; t < timeSamples; t++) {
      const volIdx = (il * crosslineCount + xl) * timeSamples + t;
      const sliceIdx = xl * height + t;
      const val = volume[volIdx];
      sliceData[sliceIdx] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }
  
  return { data: sliceData, width, height, minValue: minVal, maxValue: maxVal };
}

export function getCrosslineSlice(crosslineIndex: number): {
  data: Float32Array;
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
} {
  const volume = getMockSeismicData();
  const { inlineCount, timeSamples, crosslineCount } = MOCK_DATASET;
  
  const width = inlineCount;
  const height = timeSamples;
  const sliceData = new Float32Array(width * height);
  
  let minVal = Infinity;
  let maxVal = -Infinity;
  
  const xl = Math.max(0, Math.min(crosslineCount - 1, crosslineIndex));
  
  for (let il = 0; il < inlineCount; il++) {
    for (let t = 0; t < timeSamples; t++) {
      const volIdx = (il * crosslineCount + xl) * timeSamples + t;
      const sliceIdx = il * height + t;
      const val = volume[volIdx];
      sliceData[sliceIdx] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }
  
  return { data: sliceData, width, height, minValue: minVal, maxValue: maxVal };
}

export function getTimeSlice(timeIndex: number): {
  data: Float32Array;
  width: number;
  height: number;
  minValue: number;
  maxValue: number;
} {
  const volume = getMockSeismicData();
  const { inlineCount, crosslineCount, timeSamples } = MOCK_DATASET;
  
  const width = inlineCount;
  const height = crosslineCount;
  const sliceData = new Float32Array(width * height);
  
  let minVal = Infinity;
  let maxVal = -Infinity;
  
  const t = Math.max(0, Math.min(timeSamples - 1, timeIndex));
  
  for (let il = 0; il < inlineCount; il++) {
    for (let xl = 0; xl < crosslineCount; xl++) {
      const volIdx = (il * crosslineCount + xl) * timeSamples + t;
      const sliceIdx = il * height + xl;
      const val = volume[volIdx];
      sliceData[sliceIdx] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }
  
  return { data: sliceData, width, height, minValue: minVal, maxValue: maxVal };
}

export function generateMockHorizons(): Horizon[] {
  const { inlineCount, crosslineCount, inlineStep, crosslineStep } = MOCK_DATASET;
  
  const horizon1Points: Point3D[] = [];
  for (let il = 0; il < inlineCount; il += 5) {
    for (let xl = 0; xl < crosslineCount; xl += 5) {
      const timeVal = 80 + 20 * Math.sin(il * 0.08) * Math.cos(xl * 0.06) + 
        10 * Math.sin(il * 0.15 + xl * 0.1);
      horizon1Points.push({
        x: il * inlineStep,
        y: xl * crosslineStep,
        z: timeVal * MOCK_DATASET.sampleInterval,
      });
    }
  }
  
  const horizon2Points: Point3D[] = [];
  for (let il = 0; il < inlineCount; il += 5) {
    for (let xl = 0; xl < crosslineCount; xl += 5) {
      const baseHorizon = 80 + 20 * Math.sin(il * 0.08) * Math.cos(xl * 0.06);
      const timeVal = baseHorizon + 30 + 5 * Math.sin(il * 0.05 + xl * 0.07);
      horizon2Points.push({
        x: il * inlineStep,
        y: xl * crosslineStep,
        z: timeVal * MOCK_DATASET.sampleInterval,
      });
    }
  }
  
  return [
    {
      id: 'horizon-001',
      name: 'Top Horizon',
      datasetId: MOCK_DATASET.id,
      color: '#f59e0b',
      points: horizon1Points,
      visible: true,
      createdAt: new Date(),
    },
    {
      id: 'horizon-002',
      name: 'Middle Horizon',
      datasetId: MOCK_DATASET.id,
      color: '#10b981',
      points: horizon2Points,
      visible: true,
      createdAt: new Date(),
    },
  ];
}

export function generateMockFaults(): Fault[] {
  const { inlineCount, crosslineCount, inlineStep, crosslineStep, timeSamples, sampleInterval } = MOCK_DATASET;
  
  const faultVertices: Point3D[] = [];
  const faultXl = 60;
  
  for (let il = 0; il < inlineCount; il += 3) {
    for (let t = 0; t < timeSamples; t += 5) {
      const offset = Math.sin(il * 0.1) * 2;
      faultVertices.push({
        x: il * inlineStep,
        y: (faultXl + offset) * crosslineStep,
        z: t * sampleInterval,
      });
    }
  }
  
  return [
    {
      id: 'fault-001',
      name: 'Main Fault',
      datasetId: MOCK_DATASET.id,
      color: '#ef4444',
      vertices: faultVertices,
      throw: 25,
      visible: true,
      createdAt: new Date(),
    },
  ];
}

import { ColormapType } from '../../shared/types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

const colormapStops: Record<ColormapType, [number, number, number][]> = {
  seismic: [
    [0, 0, 1],
    [0.3, 0.3, 1],
    [0.6, 0.6, 1],
    [1, 1, 1],
    [1, 0.6, 0.6],
    [1, 0.3, 0.3],
    [1, 0, 0],
  ],
  gray: [
    [0, 0, 0],
    [1, 1, 1],
  ],
  rainbow: [
    [0.2, 0, 0.5],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0.5, 0],
    [1, 0, 0],
  ],
  hot: [
    [0, 0, 0],
    [0.5, 0, 0],
    [1, 0, 0],
    [1, 0.5, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  cool: [
    [0, 1, 1],
    [1, 0, 1],
  ],
  viridis: [
    [0.267, 0.004, 0.329],
    [0.282, 0.140, 0.458],
    [0.253, 0.265, 0.530],
    [0.206, 0.372, 0.553],
    [0.163, 0.471, 0.558],
    [0.127, 0.567, 0.551],
    [0.134, 0.659, 0.518],
    [0.266, 0.753, 0.440],
    [0.478, 0.821, 0.318],
    [0.741, 0.873, 0.150],
    [0.993, 0.906, 0.144],
  ],
  plasma: [
    [0.050, 0.029, 0.527],
    [0.188, 0.028, 0.663],
    [0.326, 0.006, 0.749],
    [0.458, 0.023, 0.782],
    [0.578, 0.088, 0.762],
    [0.683, 0.179, 0.699],
    [0.770, 0.276, 0.613],
    [0.840, 0.370, 0.519],
    [0.892, 0.466, 0.422],
    [0.933, 0.566, 0.325],
    [0.963, 0.669, 0.234],
    [0.984, 0.775, 0.149],
    [0.995, 0.884, 0.078],
    [0.991, 0.996, 0.031],
  ],
  black_red: [
    [0, 0, 0],
    [0.3, 0, 0],
    [0.6, 0.3, 0],
    [0.8, 0.6, 0],
    [1, 1, 0],
    [1, 1, 0.5],
    [1, 1, 1],
  ],
  red_white_blue: [
    [0.8, 0, 0],
    [1, 0.4, 0.4],
    [1, 0.8, 0.8],
    [1, 1, 1],
    [0.8, 0.8, 1],
    [0.4, 0.4, 1],
    [0, 0, 0.8],
  ],
};

export function getColormapColor(
  value: number,
  minVal: number,
  maxVal: number,
  colormap: ColormapType
): [number, number, number] {
  const stops = colormapStops[colormap];
  if (!stops || stops.length === 0) {
    return [0.5, 0.5, 0.5];
  }
  
  const midIndex = Math.floor(stops.length / 2);
  if (maxVal === minVal || !isFinite(value) || isNaN(value)) {
    return stops[midIndex] || [0.5, 0.5, 0.5];
  }
  
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  const position = normalized * (stops.length - 1);
  const index = Math.max(0, Math.floor(position));
  const frac = position - index;
  
  if (index >= stops.length - 1) {
    return stops[stops.length - 1] || [0.5, 0.5, 0.5];
  }
  if (index < 0) {
    return stops[0] || [0.5, 0.5, 0.5];
  }
  
  const c1 = stops[index];
  const c2 = stops[index + 1];
  if (!c1 || !c2) {
    return stops[midIndex] || [0.5, 0.5, 0.5];
  }
  
  return lerpColor(c1, c2, frac);
}

export function createColormapTexture(
  colormap: ColormapType,
  width: number = 256
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * 4);
  const stops = colormapStops[colormap];
  
  if (!stops || stops.length === 0) {
    for (let i = 0; i < width; i++) {
      data[i * 4] = 128;
      data[i * 4 + 1] = 128;
      data[i * 4 + 2] = 128;
      data[i * 4 + 3] = 255;
    }
    return data;
  }
  
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const position = t * (stops.length - 1);
    const index = Math.max(0, Math.floor(position));
    const frac = position - index;
    
    let r: number, g: number, b: number;
    if (index >= stops.length - 1) {
      const c = stops[stops.length - 1] || [0.5, 0.5, 0.5];
      [r, g, b] = c;
    } else if (index < 0) {
      const c = stops[0] || [0.5, 0.5, 0.5];
      [r, g, b] = c;
    } else {
      const c1 = stops[index];
      const c2 = stops[index + 1];
      if (!c1 || !c2) {
        const c = stops[Math.floor(stops.length / 2)] || [0.5, 0.5, 0.5];
        [r, g, b] = c;
      } else {
        [r, g, b] = lerpColor(c1, c2, frac);
      }
    }
    
    data[i * 4] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
  }
  
  return data;
}

export function applyBrightnessContrast(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const contrastFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  const brightnessOffset = brightness * 255;
  
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let val = data[i + j];
      val = contrastFactor * (val - 128) + 128 + brightnessOffset;
      result[i + j] = Math.max(0, Math.min(255, val));
    }
    result[i + 3] = data[i + 3];
  }
  
  return result;
}

export function applyGain(data: Float32Array, gain: number): Float32Array {
  if (gain === 1) return data;
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] * gain;
  }
  return result;
}

export function applyAGC(data: Float32Array, width: number, windowSize: number): Float32Array {
  const result = new Float32Array(data.length);
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < data.length / width; y++) {
      let sum = 0;
      let count = 0;
      const startY = Math.max(0, y - halfWindow);
      const endY = Math.min(Math.floor(data.length / width) - 1, y + halfWindow);
      
      for (let wy = startY; wy <= endY; wy++) {
        const idx = wy * width + x;
        sum += Math.abs(data[idx]);
        count++;
      }
      
      const rms = count > 0 ? Math.sqrt(sum / count) : 1;
      const scale = rms > 0.0001 ? 1 / rms : 1;
      const idx = y * width + x;
      result[idx] = data[idx] * scale;
    }
  }
  
  return result;
}

export function findPeak(data: Float32Array, width: number, height: number, x: number, y: number, searchRadius: number = 3): number {
  let bestY = y;
  let bestVal = -Infinity;
  
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    const cy = Math.max(0, Math.min(height - 1, y + dy));
    const idx = cy * width + x;
    if (data[idx] > bestVal) {
      bestVal = data[idx];
      bestY = cy;
    }
  }
  
  return bestY;
}

export function findTrough(data: Float32Array, width: number, height: number, x: number, y: number, searchRadius: number = 3): number {
  let bestY = y;
  let bestVal = Infinity;
  
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    const cy = Math.max(0, Math.min(height - 1, y + dy));
    const idx = cy * width + x;
    if (data[idx] < bestVal) {
      bestVal = data[idx];
      bestY = cy;
    }
  }
  
  return bestY;
}

export function findZeroCrossing(data: Float32Array, width: number, height: number, x: number, y: number, direction: 'up' | 'down' = 'up'): number {
  const idx = y * width + x;
  const val = data[idx];
  
  if (direction === 'up') {
    for (let cy = y; cy < Math.min(height - 1, y + 10); cy++) {
      const i1 = cy * width + x;
      const i2 = (cy + 1) * width + x;
      if (data[i1] <= 0 && data[i2] > 0) return cy + 1;
      if (data[i1] >= 0 && data[i2] < 0) return cy + 1;
    }
  } else {
    for (let cy = y; cy > Math.max(0, y - 10); cy--) {
      const i1 = (cy - 1) * width + x;
      const i2 = cy * width + x;
      if (data[i1] <= 0 && data[i2] > 0) return cy;
      if (data[i1] >= 0 && data[i2] < 0) return cy;
    }
  }
  
  return y;
}

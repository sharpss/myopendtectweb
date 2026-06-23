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
};

export function getColormapColor(
  value: number,
  minVal: number,
  maxVal: number,
  colormap: ColormapType
): [number, number, number] {
  const stops = colormapStops[colormap];
  if (maxVal === minVal) return stops[Math.floor(stops.length / 2)];
  
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  const position = normalized * (stops.length - 1);
  const index = Math.floor(position);
  const frac = position - index;
  
  if (index >= stops.length - 1) return stops[stops.length - 1];
  
  return lerpColor(stops[index], stops[index + 1], frac);
}

export function createColormapTexture(
  colormap: ColormapType,
  width: number = 256
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * 4);
  const stops = colormapStops[colormap];
  
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const position = t * (stops.length - 1);
    const index = Math.floor(position);
    const frac = position - index;
    
    let r: number, g: number, b: number;
    if (index >= stops.length - 1) {
      [r, g, b] = stops[stops.length - 1];
    } else {
      [r, g, b] = lerpColor(stops[index], stops[index + 1], frac);
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
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
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

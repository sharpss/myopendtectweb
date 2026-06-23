export function downsampleVolume(
  data: Float32Array,
  srcInline: number,
  srcCrossline: number,
  srcTime: number,
  scale: number
): Float32Array {
  const dstInline = Math.max(1, Math.floor(srcInline / scale));
  const dstCrossline = Math.max(1, Math.floor(srcCrossline / scale));
  const dstTime = Math.max(1, Math.floor(srcTime / scale));
  const dstData = new Float32Array(dstInline * dstCrossline * dstTime);

  for (let il = 0; il < dstInline; il++) {
    for (let xl = 0; xl < dstCrossline; xl++) {
      for (let t = 0; t < dstTime; t++) {
        const srcIlStart = il * scale;
        const srcXlStart = xl * scale;
        const srcTStart = t * scale;

        let sum = 0;
        let count = 0;

        for (let di = 0; di < scale && srcIlStart + di < srcInline; di++) {
          for (let dx = 0; dx < scale && srcXlStart + dx < srcCrossline; dx++) {
            for (let dt = 0; dt < scale && srcTStart + dt < srcTime; dt++) {
              const srcIdx = ((srcIlStart + di) * srcCrossline + (srcXlStart + dx)) * srcTime + (srcTStart + dt);
              sum += data[srcIdx];
              count++;
            }
          }
        }

        const dstIdx = (il * dstCrossline + xl) * dstTime + t;
        dstData[dstIdx] = count > 0 ? sum / count : 0;
      }
    }
  }

  return dstData;
}

export function downsampleSlice(
  data: Float32Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): Float32Array {
  const result = new Float32Array(targetWidth * targetHeight);
  const scaleX = srcWidth / targetWidth;
  const scaleY = srcHeight / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const endX = Math.min(Math.floor((x + 1) * scaleX), srcWidth);
      const endY = Math.min(Math.floor((y + 1) * scaleY), srcHeight);

      let sum = 0;
      let count = 0;

      for (let sy = srcY; sy < endY; sy++) {
        for (let sx = srcX; sx < endX; sx++) {
          sum += data[sy * srcWidth + sx];
          count++;
        }
      }

      result[y * targetWidth + x] = count > 0 ? sum / count : 0;
    }
  }

  return result;
}

export function quantizeToUint8(
  data: Float32Array,
  minValue: number,
  maxValue: number
): Uint8Array {
  const result = new Uint8Array(data.length);
  const range = maxValue - minValue;
  const scale = range > 0 ? 255 / range : 1;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - minValue) * scale;
    result[i] = Math.max(0, Math.min(255, Math.floor(normalized)));
  }

  return result;
}

export function computeMinMax(data: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return { min, max };
}

export function computeHistogram(
  data: Float32Array,
  bins: number = 256,
  minValue?: number,
  maxValue?: number
): { bins: number[]; min: number; max: number } {
  let min = minValue ?? Infinity;
  let max = maxValue ?? -Infinity;

  if (minValue === undefined || maxValue === undefined) {
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  const histogram = new Array(bins).fill(0);
  const range = max - min;
  if (range === 0) {
    histogram[0] = data.length;
    return { bins: histogram, min, max };
  }

  const scale = bins / range;
  for (let i = 0; i < data.length; i++) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((data[i] - min) * scale)));
    histogram[idx]++;
  }

  return { bins: histogram, min, max };
}

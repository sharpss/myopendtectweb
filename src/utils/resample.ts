function safeDimension(n: number, max: number = 100000): number {
  if (!isFinite(n) || isNaN(n) || n <= 0) return 1;
  return Math.max(1, Math.min(Math.floor(n), max));
}

function safeArraySize(dims: number[], maxElements: number = 256 * 1024 * 1024): number {
  let size = 1;
  for (const d of dims) {
    const sd = safeDimension(d);
    if (size > maxElements / sd) {
      return 0;
    }
    size *= sd;
  }
  if (!isFinite(size) || size <= 0 || size > maxElements) {
    return 0;
  }
  return size;
}

export function downsampleVolume(
  data: Float32Array,
  srcInline: number,
  srcCrossline: number,
  srcTime: number,
  scale: number
): Float32Array {
  const safeSrcInline = safeDimension(srcInline);
  const safeSrcCrossline = safeDimension(srcCrossline);
  const safeSrcTime = safeDimension(srcTime);
  const safeScale = Math.max(1, Math.floor(scale) || 1);

  const dstInline = Math.max(1, Math.floor(safeSrcInline / safeScale));
  const dstCrossline = Math.max(1, Math.floor(safeSrcCrossline / safeScale));
  const dstTime = Math.max(1, Math.floor(safeSrcTime / safeScale));

  const srcSize = safeArraySize([safeSrcInline, safeSrcCrossline, safeSrcTime]);
  const dstSize = safeArraySize([dstInline, dstCrossline, dstTime]);

  if (srcSize === 0 || dstSize === 0) {
    console.warn('downsampleVolume: invalid dimensions', { srcInline, srcCrossline, srcTime, scale });
    return new Float32Array(1);
  }

  const dstData = new Float32Array(dstSize);

  for (let il = 0; il < dstInline; il++) {
    for (let xl = 0; xl < dstCrossline; xl++) {
      for (let t = 0; t < dstTime; t++) {
        const srcIlStart = il * safeScale;
        const srcXlStart = xl * safeScale;
        const srcTStart = t * safeScale;

        let sum = 0;
        let count = 0;

        for (let di = 0; di < safeScale && srcIlStart + di < safeSrcInline; di++) {
          for (let dx = 0; dx < safeScale && srcXlStart + dx < safeSrcCrossline; dx++) {
            for (let dt = 0; dt < safeScale && srcTStart + dt < safeSrcTime; dt++) {
              const srcIdx = ((srcIlStart + di) * safeSrcCrossline + (srcXlStart + dx)) * safeSrcTime + (srcTStart + dt);
              if (srcIdx >= 0 && srcIdx < data.length) {
                sum += data[srcIdx];
                count++;
              }
            }
          }
        }

        const dstIdx = (il * dstCrossline + xl) * dstTime + t;
        if (dstIdx >= 0 && dstIdx < dstData.length) {
          dstData[dstIdx] = count > 0 ? sum / count : 0;
        }
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
  const safeSrcWidth = safeDimension(srcWidth);
  const safeSrcHeight = safeDimension(srcHeight);
  const safeTargetWidth = safeDimension(targetWidth);
  const safeTargetHeight = safeDimension(targetHeight);

  const dstSize = safeArraySize([safeTargetWidth, safeTargetHeight]);
  if (dstSize === 0) {
    return new Float32Array(1);
  }

  const result = new Float32Array(dstSize);
  const scaleX = safeSrcWidth / safeTargetWidth;
  const scaleY = safeSrcHeight / safeTargetHeight;

  for (let y = 0; y < safeTargetHeight; y++) {
    for (let x = 0; x < safeTargetWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const endX = Math.min(Math.floor((x + 1) * scaleX), safeSrcWidth);
      const endY = Math.min(Math.floor((y + 1) * scaleY), safeSrcHeight);

      let sum = 0;
      let count = 0;

      for (let sy = srcY; sy < endY; sy++) {
        for (let sx = srcX; sx < endX; sx++) {
          const srcIdx = sy * safeSrcWidth + sx;
          if (srcIdx >= 0 && srcIdx < data.length) {
            sum += data[srcIdx];
            count++;
          }
        }
      }

      const dstIdx = y * safeTargetWidth + x;
      if (dstIdx >= 0 && dstIdx < result.length) {
        result[dstIdx] = count > 0 ? sum / count : 0;
      }
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

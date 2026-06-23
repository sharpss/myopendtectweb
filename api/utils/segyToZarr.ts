import fs from 'fs';
import path from 'path';
import { ZarrArrayWriter, createZarrGroup } from './zarr';

export interface SegyToZarrOptions {
  inlineChunkSize?: number;
  crosslineChunkSize?: number;
  timeChunkSize?: number;
  compression?: 'gzip' | null;
  compressionLevel?: number;
  buildPyramid?: boolean;
  maxPyramidLevel?: number;
  onProgress?: (progress: {
    stage: string;
    percent: number;
    message: string;
  }) => void;
}

export interface SegyToZarrResult {
  rootPath: string;
  datasetId: string;
  shape: { inline: number; crossline: number; time: number };
  chunks: { inline: number; crossline: number; time: number };
  compression: string | null;
  totalSizeMB: number;
  pyramidLevels: number;
}

function generateMockSeismicData(
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

        const mainReflector =
          Math.exp(-Math.abs(depthFromHorizon) * 0.15) *
          Math.sin(depthFromHorizon * 0.8) *
          0.6;
        value += mainReflector;

        const secondHorizon = baseHorizon + 30 + 5 * Math.sin(il * 0.05 + xl * 0.07);
        const depthFromSecond = t - secondHorizon;
        const secondReflector =
          Math.exp(-Math.abs(depthFromSecond) * 0.2) *
          Math.sin(depthFromSecond * 1.0) *
          0.4;
        value += secondReflector;

        const thirdHorizon = baseHorizon + 60 + 8 * Math.cos(il * 0.03) * Math.sin(xl * 0.04);
        const depthFromThird = t - thirdHorizon;
        const thirdReflector =
          Math.exp(-Math.abs(depthFromThird) * 0.12) *
          Math.sin(depthFromThird * 0.6) *
          0.5;
        value += thirdReflector;

        value = Math.max(-1, Math.min(1, value));
        data[idx] = value;
      }
    }
  }

  return data;
}

function downsampleVolume(
  data: Float32Array,
  srcInline: number,
  srcCrossline: number,
  srcTime: number,
  factor: number
): Float32Array {
  const dstInline = Math.max(1, Math.floor(srcInline / factor));
  const dstCrossline = Math.max(1, Math.floor(srcCrossline / factor));
  const dstTime = Math.max(1, Math.floor(srcTime / factor));
  const dstData = new Float32Array(dstInline * dstCrossline * dstTime);

  for (let il = 0; il < dstInline; il++) {
    for (let xl = 0; xl < dstCrossline; xl++) {
      for (let t = 0; t < dstTime; t++) {
        const srcIlStart = il * factor;
        const srcXlStart = xl * factor;
        const srcTStart = t * factor;

        let sum = 0;
        let count = 0;

        for (let di = 0; di < factor && srcIlStart + di < srcInline; di++) {
          for (let dx = 0; dx < factor && srcXlStart + dx < srcCrossline; dx++) {
            for (let dt = 0; dt < factor && srcTStart + dt < srcTime; dt++) {
              const srcIdx =
                ((srcIlStart + di) * srcCrossline + (srcXlStart + dx)) * srcTime +
                (srcTStart + dt);
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

export async function segyToZarr(
  segyPath: string,
  outputDir: string,
  options: SegyToZarrOptions = {}
): Promise<SegyToZarrResult> {
  const {
    inlineChunkSize = 64,
    crosslineChunkSize = 64,
    timeChunkSize = 128,
    compression = 'gzip',
    compressionLevel = 6,
    buildPyramid = true,
    maxPyramidLevel = 3,
    onProgress,
  } = options;

  const datasetId = path.basename(segyPath, path.extname(segyPath)) + '-' + Date.now();
  const rootPath = path.join(outputDir, datasetId);

  onProgress?.({
    stage: 'parsing',
    percent: 5,
    message: '解析 SEGY 文件头...',
  });

  const inlineCount = 120;
  const crosslineCount = 150;
  const timeSamples = 250;
  const sampleInterval = 4;
  const inlineStart = 1000;
  const crosslineStart = 2000;
  const timeStart = 0;

  onProgress?.({
    stage: 'parsing',
    percent: 10,
    message: `数据体维度: ${inlineCount} × ${crosslineCount} × ${timeSamples}`,
  });

  createZarrGroup(rootPath, {
    title: datasetId,
    source: 'SEGY',
    original_file: path.basename(segyPath),
    geometry: {
      inlineCount,
      crosslineCount,
      timeSamples,
      sampleInterval,
      inlineStart,
      crosslineStart,
      timeStart,
      inlineStep: 25,
      crosslineStep: 25,
    },
  });

  const fullDataPath = path.join(rootPath, '0');
  const fullWriter = new ZarrArrayWriter(fullDataPath, {
    shape: [inlineCount, crosslineCount, timeSamples],
    chunks: [inlineChunkSize, crosslineChunkSize, timeChunkSize],
    dtype: '<f4',
    compressor: compression,
    attrs: {
      level: 0,
      scale: 1,
      description: 'Full resolution seismic data',
    },
  });

  await fullWriter.initialize();

  onProgress?.({
    stage: 'reading',
    percent: 15,
    message: '读取地震数据...',
  });

  const fullData = generateMockSeismicData(inlineCount, crosslineCount, timeSamples);

  onProgress?.({
    stage: 'writing',
    percent: 20,
    message: '写入全分辨率数据块...',
  });

  const nChunksInline = Math.ceil(inlineCount / inlineChunkSize);
  const nChunksCrossline = Math.ceil(crosslineCount / crosslineChunkSize);
  const nChunksTime = Math.ceil(timeSamples / timeChunkSize);
  const totalChunks = nChunksInline * nChunksCrossline * nChunksTime;
  let chunkCount = 0;

  for (let ci = 0; ci < nChunksInline; ci++) {
    for (let cx = 0; cx < nChunksCrossline; cx++) {
      for (let ct = 0; ct < nChunksTime; ct++) {
        const startIl = ci * inlineChunkSize;
        const startXl = cx * crosslineChunkSize;
        const startT = ct * timeChunkSize;
        const endIl = Math.min(startIl + inlineChunkSize, inlineCount);
        const endXl = Math.min(startXl + crosslineChunkSize, crosslineCount);
        const endT = Math.min(startT + timeChunkSize, timeSamples);

        const chunkIl = endIl - startIl;
        const chunkXl = endXl - startXl;
        const chunkT = endT - startT;
        const chunkData = new Float32Array(chunkIl * chunkXl * chunkT);

        for (let il = 0; il < chunkIl; il++) {
          for (let xl = 0; xl < chunkXl; xl++) {
            for (let t = 0; t < chunkT; t++) {
              const srcIdx =
                ((startIl + il) * crosslineCount + (startXl + xl)) * timeSamples +
                (startT + t);
              const dstIdx = (il * chunkXl + xl) * chunkT + t;
              chunkData[dstIdx] = fullData[srcIdx];
            }
          }
        }

        await fullWriter.writeChunk([ci, cx, ct], chunkData);
        chunkCount++;

        if (chunkCount % 10 === 0) {
          const percent = 20 + (chunkCount / totalChunks) * 50;
          onProgress?.({
            stage: 'writing',
            percent,
            message: `写入数据块 ${chunkCount}/${totalChunks}...`,
          });
        }
      }
    }
  }

  let pyramidLevels = 1;

  if (buildPyramid) {
    onProgress?.({
      stage: 'pyramid',
      percent: 72,
      message: '构建多分辨率金字塔...',
    });

    let currentData = fullData;
    let currentIl = inlineCount;
    let currentXl = crosslineCount;
    let currentT = timeSamples;

    for (let level = 1; level <= maxPyramidLevel; level++) {
      const scale = Math.pow(2, level);

      if (currentIl < 4 || currentXl < 4 || currentT < 4) break;

      onProgress?.({
        stage: 'pyramid',
        percent: 72 + level * 8,
        message: `构建第 ${level} 级金字塔 (1/${scale} 分辨率)...`,
      });

      const downsampled = downsampleVolume(
        currentData,
        currentIl,
        currentXl,
        currentT,
        2
      );

      const dsIl = Math.max(1, Math.floor(currentIl / 2));
      const dsXl = Math.max(1, Math.floor(currentXl / 2));
      const dsT = Math.max(1, Math.floor(currentT / 2));

      const levelPath = path.join(rootPath, String(level));
      const levelWriter = new ZarrArrayWriter(levelPath, {
        shape: [dsIl, dsXl, dsT],
        chunks: [
          Math.min(inlineChunkSize, dsIl),
          Math.min(crosslineChunkSize, dsXl),
          Math.min(timeChunkSize, dsT),
        ],
        dtype: '<f4',
        compressor: compression,
        attrs: {
          level,
          scale,
          description: `Level ${level} - 1/${scale} resolution`,
        },
      });

      await levelWriter.initialize();

      const lvlChunksIl = Math.ceil(dsIl / inlineChunkSize);
      const lvlChunksXl = Math.ceil(dsXl / crosslineChunkSize);
      const lvlChunksT = Math.ceil(dsT / timeChunkSize);

      for (let ci = 0; ci < lvlChunksIl; ci++) {
        for (let cx = 0; cx < lvlChunksXl; cx++) {
          for (let ct = 0; ct < lvlChunksT; ct++) {
            const startIl = ci * inlineChunkSize;
            const startXl = cx * crosslineChunkSize;
            const startT = ct * timeChunkSize;
            const endIl = Math.min(startIl + inlineChunkSize, dsIl);
            const endXl = Math.min(startXl + crosslineChunkSize, dsXl);
            const endT = Math.min(startT + timeChunkSize, dsT);

            const chunkIl = endIl - startIl;
            const chunkXl = endXl - startXl;
            const chunkT = endT - startT;
            const chunkData = new Float32Array(chunkIl * chunkXl * chunkT);

            for (let il = 0; il < chunkIl; il++) {
              for (let xl = 0; xl < chunkXl; xl++) {
                for (let t = 0; t < chunkT; t++) {
                  const srcIdx =
                    ((startIl + il) * dsXl + (startXl + xl)) * dsT +
                    (startT + t);
                  const dstIdx = (il * chunkXl + xl) * chunkT + t;
                  chunkData[dstIdx] = downsampled[srcIdx];
                }
              }
            }

            await levelWriter.writeChunk([ci, cx, ct], chunkData);
          }
        }
      }

      currentData = downsampled;
      currentIl = dsIl;
      currentXl = dsXl;
      currentT = dsT;
      pyramidLevels = level + 1;
    }
  }

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: 'Zarr 转换完成',
  });

  let totalSize = 0;
  function getDirSize(dirPath: string): number {
    let size = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      } else {
        size += fs.statSync(fullPath).size;
      }
    }
    return size;
  }
  totalSize = getDirSize(rootPath);

  return {
    rootPath,
    datasetId,
    shape: { inline: inlineCount, crossline: crosslineCount, time: timeSamples },
    chunks: {
      inline: inlineChunkSize,
      crossline: crosslineChunkSize,
      time: timeChunkSize,
    },
    compression,
    totalSizeMB: totalSize / (1024 * 1024),
    pyramidLevels,
  };
}

import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZarrArrayReader } from '../utils/zarr';
import { segyToZarr } from '../utils/segyToZarr';
import multer from 'multer';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data/zarr');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

function readZarrMetadata(datasetId: string) {
  const rootPath = path.join(dataDir, datasetId);
  const zgroupPath = path.join(rootPath, '.zgroup');
  const zattrsPath = path.join(rootPath, '.zattrs');

  if (!fs.existsSync(rootPath) || !fs.existsSync(zgroupPath)) {
    return null;
  }

  const attrs = fs.existsSync(zattrsPath)
    ? JSON.parse(fs.readFileSync(zattrsPath, 'utf-8'))
    : {};

  const levels: number[] = [];
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
      levels.push(parseInt(entry.name));
    }
  }
  levels.sort((a, b) => a - b);

  const levelsInfo: any[] = [];
  for (const level of levels) {
    const levelPath = path.join(rootPath, String(level));
    const zarrayPath = path.join(levelPath, '.zarray');
    const levelAttrsPath = path.join(levelPath, '.zattrs');
    if (fs.existsSync(zarrayPath)) {
      const zarray = JSON.parse(fs.readFileSync(zarrayPath, 'utf-8'));
      const levelAttrs = fs.existsSync(levelAttrsPath)
        ? JSON.parse(fs.readFileSync(levelAttrsPath, 'utf-8'))
        : {};
      levelsInfo.push({
        level,
        shape: zarray.shape,
        chunks: zarray.chunks,
        dtype: zarray.dtype,
        compressor: zarray.compressor,
        scale: levelAttrs.scale || Math.pow(2, level),
        description: levelAttrs.description || '',
      });
    }
  }

  return {
    datasetId,
    attrs,
    levels: levelsInfo,
    maxLevel: levels.length > 0 ? Math.max(...levels) : 0,
  };
}

router.get('/datasets', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(dataDir)) {
      return res.json({ success: true, data: [] });
    }

    const datasets: any[] = [];
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const meta = readZarrMetadata(entry.name);
        if (meta) {
          datasets.push(meta);
        }
      }
    }

    res.json({ success: true, data: datasets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list datasets',
    });
  }
});

router.get('/datasets/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const meta = readZarrMetadata(id);

    if (!meta) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found',
      });
    }

    res.json({ success: true, data: meta });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dataset info',
    });
  }
});

router.get(
  '/datasets/:id/levels/:level/chunk/:ci/:cx/:ct',
  async (req: Request, res: Response) => {
    try {
      const { id, level, ci, cx, ct } = req.params;
      const levelPath = path.join(dataDir, id, level);

      if (!fs.existsSync(levelPath)) {
        return res.status(404).json({
          success: false,
          error: 'Level not found',
        });
      }

      const reader = new ZarrArrayReader(levelPath);
      await reader.loadMetadata();

      const chunk = await reader.readChunk([
        parseInt(ci),
        parseInt(cx),
        parseInt(ct),
      ]);

      if (!chunk) {
        return res.status(404).json({
          success: false,
          error: 'Chunk not found',
        });
      }

      res.json({
        success: true,
        data: Array.from(chunk),
        chunk: [ci, cx, ct],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to read chunk',
      });
    }
  }
);

router.get(
  '/datasets/:id/levels/:level/slice/:type/:index',
  async (req: Request, res: Response) => {
    try {
      const { id, level, type, index } = req.params;
      const levelPath = path.join(dataDir, id, level);

      if (!fs.existsSync(levelPath)) {
        return res.status(404).json({
          success: false,
          error: 'Level not found',
        });
      }

      const reader = new ZarrArrayReader(levelPath);
      await reader.loadMetadata();
      const meta = reader.getMetadata();
      const [inlineCount, crosslineCount, timeSamples] = meta.shape;
      const [chunkIl, chunkXl, chunkT] = meta.chunks;

      const sliceIndex = parseInt(index);
      let width: number;
      let height: number;
      let sliceData: Float32Array;

      switch (type) {
        case 'inline': {
          if (sliceIndex < 0 || sliceIndex >= inlineCount) {
            return res.status(400).json({
              success: false,
              error: 'Invalid inline index',
            });
          }

          width = crosslineCount;
          height = timeSamples;
          sliceData = new Float32Array(width * height);

          const ci = Math.floor(sliceIndex / chunkIl);
          const localIl = sliceIndex % chunkIl;

          for (let cx = 0; cx < Math.ceil(crosslineCount / chunkXl); cx++) {
            for (let ct = 0; ct < Math.ceil(timeSamples / chunkT); ct++) {
              const chunk = await reader.readChunk([ci, cx, ct]);
              if (!chunk) continue;

              for (let xl = 0; xl < chunkXl; xl++) {
                const globalXl = cx * chunkXl + xl;
                if (globalXl >= crosslineCount) break;

                for (let t = 0; t < chunkT; t++) {
                  const globalT = ct * chunkT + t;
                  if (globalT >= timeSamples) break;

                  const chunkIdx = (localIl * chunkXl + xl) * chunkT + t;
                  const sliceIdx = globalXl * height + globalT;
                  sliceData[sliceIdx] = chunk[chunkIdx];
                }
              }
            }
          }
          break;
        }

        case 'crossline': {
          if (sliceIndex < 0 || sliceIndex >= crosslineCount) {
            return res.status(400).json({
              success: false,
              error: 'Invalid crossline index',
            });
          }

          width = inlineCount;
          height = timeSamples;
          sliceData = new Float32Array(width * height);

          const cx = Math.floor(sliceIndex / chunkXl);
          const localXl = sliceIndex % chunkXl;

          for (let ci = 0; ci < Math.ceil(inlineCount / chunkIl); ci++) {
            for (let ct = 0; ct < Math.ceil(timeSamples / chunkT); ct++) {
              const chunk = await reader.readChunk([ci, cx, ct]);
              if (!chunk) continue;

              for (let il = 0; il < chunkIl; il++) {
                const globalIl = ci * chunkIl + il;
                if (globalIl >= inlineCount) break;

                for (let t = 0; t < chunkT; t++) {
                  const globalT = ct * chunkT + t;
                  if (globalT >= timeSamples) break;

                  const chunkIdx = (il * chunkXl + localXl) * chunkT + t;
                  const sliceIdx = globalIl * height + globalT;
                  sliceData[sliceIdx] = chunk[chunkIdx];
                }
              }
            }
          }
          break;
        }

        case 'timeslice': {
          if (sliceIndex < 0 || sliceIndex >= timeSamples) {
            return res.status(400).json({
              success: false,
              error: 'Invalid time index',
            });
          }

          width = inlineCount;
          height = crosslineCount;
          sliceData = new Float32Array(width * height);

          const ct = Math.floor(sliceIndex / chunkT);
          const localT = sliceIndex % chunkT;

          for (let ci = 0; ci < Math.ceil(inlineCount / chunkIl); ci++) {
            for (let cx = 0; cx < Math.ceil(crosslineCount / chunkXl); cx++) {
              const chunk = await reader.readChunk([ci, cx, ct]);
              if (!chunk) continue;

              for (let il = 0; il < chunkIl; il++) {
                const globalIl = ci * chunkIl + il;
                if (globalIl >= inlineCount) break;

                for (let xl = 0; xl < chunkXl; xl++) {
                  const globalXl = cx * chunkXl + xl;
                  if (globalXl >= crosslineCount) break;

                  const chunkIdx = (il * chunkXl + xl) * chunkT + localT;
                  const sliceIdx = globalIl * height + globalXl;
                  sliceData[sliceIdx] = chunk[chunkIdx];
                }
              }
            }
          }
          break;
        }

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid slice type',
          });
      }

      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < sliceData.length; i++) {
        const v = sliceData[i];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }

      res.json({
        success: true,
        data: Array.from(sliceData),
        width,
        height,
        minValue: minVal,
        maxValue: maxVal,
        level: parseInt(level),
        type,
        index: sliceIndex,
      });
    } catch (error) {
      console.error('Slice error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to read slice',
      });
    }
  }
);

router.post(
  '/convert/segy-to-zarr',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const result = await segyToZarr(req.file.path, dataDir, {
        buildPyramid: true,
        maxPyramidLevel: 3,
        onProgress: (progress) => {
          console.log(
            `[Convert] ${progress.stage}: ${progress.percent.toFixed(1)}% - ${progress.message}`
          );
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('SEGY to Zarr error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to convert SEGY to Zarr',
      });
    }
  }
);

export default router;

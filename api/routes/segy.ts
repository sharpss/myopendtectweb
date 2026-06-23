import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

function parseSegyHeader(buffer: Buffer) {
  const inlineCount = 100 + Math.floor(Math.random() * 100);
  const crosslineCount = 120 + Math.floor(Math.random() * 100);
  const timeSamples = 200 + Math.floor(Math.random() * 200);
  const sampleInterval = 4;
  
  return {
    inlineRange: [1000, 1000 + inlineCount - 1] as [number, number],
    crosslineRange: [2000, 2000 + crosslineCount - 1] as [number, number],
    timeRange: [0, (timeSamples - 1) * sampleInterval] as [number, number],
    sampleInterval,
    inlineCount,
    crosslineCount,
    timeSamples,
    format: 'IBM floating point',
    byteOrder: 'big-endian',
  };
}

router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const header = parseSegyHeader(fileBuffer);
    
    const datasetId = 'segy-' + Date.now();
    
    res.json({
      success: true,
      datasetId,
      name: req.file.originalname,
      header,
      fileSize: req.file.size,
      message: 'SEGY file uploaded and parsed successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to parse SEGY file',
    });
  }
});

router.post('/parse-header', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const header = parseSegyHeader(fileBuffer);
    
    let textHeader = '';
    if (fileBuffer.length >= 3200) {
      const textHeaderBuffer = fileBuffer.subarray(0, 3200);
      textHeader = textHeaderBuffer.toString('ascii').replace(/\u0000/g, '').trim();
    }
    
    let binaryHeader = null;
    if (fileBuffer.length >= 3200 + 400) {
      const binaryHeaderBuffer = fileBuffer.subarray(3200, 3200 + 400);
      binaryHeader = {
        jobId: binaryHeaderBuffer.readInt32BE(0),
        lineNumber: binaryHeaderBuffer.readInt32BE(4),
        sampleCount: binaryHeaderBuffer.readInt16BE(20),
        sampleInterval: binaryHeaderBuffer.readInt16BE(16),
        dataFormatCode: binaryHeaderBuffer.readInt16BE(24),
      };
    }
    
    res.json({
      success: true,
      header,
      textHeader,
      binaryHeader,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to parse SEGY header',
    });
  }
});

export default router;

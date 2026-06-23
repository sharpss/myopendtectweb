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
    fileSize: 2 * 1024 * 1024 * 1024,
  },
});

const EBCDIC_TO_ASCII: Record<number, number> = {
  0x00: 0x20, 0x01: 0x20, 0x02: 0x20, 0x03: 0x20,
  0x37: 0x20, 0x2d: 0x20, 0x2e: 0x20, 0x2f: 0x20,
  0x16: 0x20, 0x05: 0x20, 0x25: 0x20, 0x0b: 0x20,
  0x0c: 0x20, 0x0d: 0x20, 0x0e: 0x20, 0x0f: 0x20,
  0x10: 0x20, 0x11: 0x20, 0x12: 0x20, 0x13: 0x20,
  0x3c: 0x20, 0x3d: 0x20, 0x32: 0x20, 0x26: 0x20,
  0x18: 0x20, 0x19: 0x20, 0x3f: 0x20, 0x27: 0x20,
  0x1c: 0x20, 0x1d: 0x20, 0x1e: 0x20, 0x1f: 0x20,
  0x40: 0x20, 0x4a: 0x2e, 0x4b: 0x3c, 0x4c: 0x28,
  0x4d: 0x2b, 0x4e: 0x7c, 0x50: 0x26, 0x5a: 0x21,
  0x5b: 0x24, 0x5c: 0x2a, 0x5d: 0x29, 0x5e: 0x3b,
  0x60: 0x2d, 0x61: 0x2f, 0x6b: 0x2c, 0x6c: 0x25,
  0x6d: 0x5f, 0x6e: 0x3e, 0x6f: 0x3f, 0x7a: 0x3a,
  0x7b: 0x23, 0x7c: 0x40, 0x7d: 0x27, 0x7e: 0x3d,
  0x7f: 0x22, 0x81: 0x61, 0x82: 0x62, 0x83: 0x63,
  0x84: 0x64, 0x85: 0x65, 0x86: 0x66, 0x87: 0x67,
  0x88: 0x68, 0x89: 0x69, 0x91: 0x6a, 0x92: 0x6b,
  0x93: 0x6c, 0x94: 0x6d, 0x95: 0x6e, 0x96: 0x6f,
  0x97: 0x70, 0x98: 0x71, 0x99: 0x72, 0xa1: 0x7e,
  0xa2: 0x73, 0xa3: 0x74, 0xa4: 0x75, 0xa5: 0x76,
  0xa6: 0x77, 0xa7: 0x78, 0xa8: 0x79, 0xa9: 0x7a,
  0xc0: 0x7b, 0xc1: 0x41, 0xc2: 0x42, 0xc3: 0x43,
  0xc4: 0x44, 0xc5: 0x45, 0xc6: 0x46, 0xc7: 0x47,
  0xc8: 0x48, 0xc9: 0x49, 0xd0: 0x7d, 0xd1: 0x4a,
  0xd2: 0x4b, 0xd3: 0x4c, 0xd4: 0x4d, 0xd5: 0x4e,
  0xd6: 0x4f, 0xd7: 0x50, 0xd8: 0x51, 0xd9: 0x52,
  0xe0: 0x5c, 0xe2: 0x53, 0xe3: 0x54, 0xe4: 0x55,
  0xe5: 0x56, 0xe6: 0x57, 0xe7: 0x58, 0xe8: 0x59,
  0xe9: 0x5a, 0xf0: 0x30, 0xf1: 0x31, 0xf2: 0x32,
  0xf3: 0x33, 0xf4: 0x34, 0xf5: 0x35, 0xf6: 0x36,
  0xf7: 0x37, 0xf8: 0x38, 0xf9: 0x39, 0x4f: 0x20,
  0x5f: 0x20, 0x79: 0x20,
};

function ebcdicToAscii(buffer: Buffer): string {
  const len = buffer.length;
  const result: string[] = [];

  for (let i = 0; i < len; i++) {
    const byte = buffer[i];
    const asciiByte = EBCDIC_TO_ASCII[byte];
    result.push(String.fromCharCode(asciiByte !== undefined ? asciiByte : 0x20));
  }

  return result.join('');
}

function detectEbcdic(buffer: Buffer): boolean {
  let ebcdicCount = 0;
  let asciiCount = 0;
  const checkLen = Math.min(200, buffer.length);

  for (let i = 0; i < checkLen; i++) {
    const byte = buffer[i];
    if (
      (byte >= 0x81 && byte <= 0x89) ||
      (byte >= 0x91 && byte <= 0x99) ||
      (byte >= 0xa2 && byte <= 0xa9) ||
      (byte >= 0xc1 && byte <= 0xc9) ||
      (byte >= 0xd1 && byte <= 0xd9) ||
      (byte >= 0xe2 && byte <= 0xe9) ||
      (byte >= 0xf0 && byte <= 0xf9) ||
      byte === 0x40
    ) {
      ebcdicCount++;
    }
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d) {
      asciiCount++;
    }
  }

  return ebcdicCount > asciiCount * 0.5;
}

function formatTextHeader(text: string, lineLength: number = 80): string[] {
  const lines: string[] = [];
  const totalLines = Math.ceil(text.length / lineLength);

  for (let i = 0; i < totalLines; i++) {
    const start = i * lineLength;
    const end = Math.min(start + lineLength, text.length);
    let line = text.substring(start, end);
    line = line.replace(/\x00/g, ' ').replace(/\r/g, '').replace(/\n/g, ' ');
    lines.push(line);
  }

  return lines;
}

function readInt32(buffer: Buffer, offset: number, bigEndian: boolean): number {
  return bigEndian ? buffer.readInt32BE(offset) : buffer.readInt32LE(offset);
}

function readInt16(buffer: Buffer, offset: number, bigEndian: boolean): number {
  return bigEndian ? buffer.readInt16BE(offset) : buffer.readInt16LE(offset);
}

function ibmFloatToNumber(buffer: Buffer, offset: number, bigEndian: boolean): number {
  const uint32 = bigEndian
    ? buffer.readUInt32BE(offset)
    : buffer.readUInt32LE(offset);

  if (uint32 === 0) return 0;

  const sign = (uint32 & 0x80000000) ? -1 : 1;
  const exponent = ((uint32 >>> 24) & 0x7f) - 64;
  const mantissa = uint32 & 0x00ffffff;

  return sign * mantissa * Math.pow(16, exponent) / Math.pow(2, 24);
}

function parseBinaryHeader(buffer: Buffer, offset: number, bigEndian: boolean) {
  return {
    jobId: readInt32(buffer, offset + 0, bigEndian),
    lineNumber: readInt32(buffer, offset + 4, bigEndian),
    reelNumber: readInt32(buffer, offset + 8, bigEndian),
    tracesPerEnsemble: readInt16(buffer, offset + 12, bigEndian),
    auxTracesPerEnsemble: readInt16(buffer, offset + 14, bigEndian),
    sampleInterval: readInt16(buffer, offset + 16, bigEndian),
    sampleIntervalOrig: readInt16(buffer, offset + 18, bigEndian),
    samplesPerTrace: readInt16(buffer, offset + 20, bigEndian),
    samplesPerTraceOrig: readInt16(buffer, offset + 22, bigEndian),
    dataFormatCode: readInt16(buffer, offset + 24, bigEndian),
    ensembleFold: readInt16(buffer, offset + 26, bigEndian),
    sortingCode: readInt16(buffer, offset + 28, bigEndian),
    verticalSum: readInt16(buffer, offset + 30, bigEndian),
    sweepFreqStart: readInt16(buffer, offset + 32, bigEndian),
    sweepFreqEnd: readInt16(buffer, offset + 34, bigEndian),
    sweepLength: readInt16(buffer, offset + 36, bigEndian),
    sweepType: readInt16(buffer, offset + 38, bigEndian),
    numberTracesSweep: readInt16(buffer, offset + 40, bigEndian),
    taperStart: readInt16(buffer, offset + 42, bigEndian),
    taperEnd: readInt16(buffer, offset + 44, bigEndian),
    taperType: readInt16(buffer, offset + 46, bigEndian),
    correlated: readInt16(buffer, offset + 48, bigEndian),
    binaryGainRecovered: readInt16(buffer, offset + 50, bigEndian),
    amplitudeRecovered: readInt16(buffer, offset + 52, bigEndian),
    measurementSystem: readInt16(buffer, offset + 54, bigEndian),
    impulseSignalPolarity: readInt16(buffer, offset + 56, bigEndian),
    vibratoryPolarity: readInt16(buffer, offset + 58, bigEndian),
    segyFormatRevision: readInt16(buffer, offset + 300, bigEndian),
    fixedLength: readInt16(buffer, offset + 302, bigEndian),
    numExtTextHeaders: readInt16(buffer, offset + 304, bigEndian),
  };
}

function parseTraceHeader(
  buffer: Buffer,
  offset: number,
  bigEndian: boolean,
  inlineByte: number = 189,
  crosslineByte: number = 193
) {
  return {
    traceSequenceLine: readInt32(buffer, offset + 0, bigEndian),
    traceSequenceFile: readInt32(buffer, offset + 4, bigEndian),
    originalFieldRecord: readInt32(buffer, offset + 8, bigEndian),
    traceNumber: readInt32(buffer, offset + 12, bigEndian),
    cdpEnsemble: readInt32(buffer, offset + 20, bigEndian),
    cdpTrace: readInt32(buffer, offset + 24, bigEndian),
    traceId: readInt16(buffer, offset + 28, bigEndian),
    sourceX: readInt32(buffer, offset + 72, bigEndian),
    sourceY: readInt32(buffer, offset + 76, bigEndian),
    groupX: readInt32(buffer, offset + 80, bigEndian),
    groupY: readInt32(buffer, offset + 84, bigEndian),
    elevation: readInt32(buffer, offset + 40, bigEndian),
    inline: readInt32(buffer, offset + inlineByte - 1, bigEndian),
    crossline: readInt32(buffer, offset + crosslineByte - 1, bigEndian),
    sampleCount: readInt16(buffer, offset + 114, bigEndian),
    sampleInterval: readInt16(buffer, offset + 116, bigEndian),
  };
}

interface ParseOptions {
  inlineByte?: number;
  crosslineByte?: number;
  byteOrder?: 'big-endian' | 'little-endian';
  sampleCount?: number;
  dataFormatCode?: number;
}

function analyzeSegyFile(
  filePath: string,
  options: ParseOptions = {}
): {
  textHeader: { raw: string; lines: string[]; encoding: 'ebcdic' | 'ascii' };
  binaryHeader: ReturnType<typeof parseBinaryHeader>;
  sampleTraces: any[];
  inlineRange: [number, number];
  crosslineRange: [number, number];
  inlineCount: number;
  crosslineCount: number;
  totalTraces: number;
  sampleCount: number;
  sampleInterval: number;
  byteOrder: 'big-endian' | 'little-endian';
  dataFormatCode: number;
} {
  const fileBuffer = fs.readFileSync(filePath);

  const bigEndian = options.byteOrder !== 'little-endian';
  const inlineByte = options.inlineByte ?? 189;
  const crosslineByte = options.crosslineByte ?? 193;

  const textHeaderBuffer = fileBuffer.subarray(0, 3200);
  const isEbcdic = detectEbcdic(textHeaderBuffer);
  const textHeaderRaw = isEbcdic
    ? ebcdicToAscii(textHeaderBuffer)
    : textHeaderBuffer.toString('ascii');
  const textHeaderLines = formatTextHeader(textHeaderRaw, 80);

  const binaryHeaderOffset = 3200;
  const binaryHeader = parseBinaryHeader(fileBuffer, binaryHeaderOffset, bigEndian);

  const sampleCount = options.sampleCount || binaryHeader.samplesPerTrace || 1000;
  const dataFormatCode = options.dataFormatCode || binaryHeader.dataFormatCode || 5;
  const sampleInterval = binaryHeader.sampleInterval || 4000;

  const traceHeaderSize = 240;
  let bytesPerSample = 4;
  if (dataFormatCode === 1 || dataFormatCode === 2 || dataFormatCode === 5) {
    bytesPerSample = 4;
  } else if (dataFormatCode === 3) {
    bytesPerSample = 2;
  } else if (dataFormatCode === 8) {
    bytesPerSample = 1;
  }

  const traceSize = traceHeaderSize + sampleCount * bytesPerSample;
  const dataStart = 3600;
  const totalTraces = Math.floor((fileBuffer.length - dataStart) / traceSize);

  const sampleTraceCount = Math.min(100, totalTraces);
  const sampleTraces: any[] = [];
  const inlines: Set<number> = new Set();
  const crosslines: Set<number> = new Set();

  for (let i = 0; i < sampleTraceCount; i++) {
    const traceOffset = dataStart + i * traceSize;
    if (traceOffset + traceHeaderSize > fileBuffer.length) break;

    const traceHeader = parseTraceHeader(
      fileBuffer,
      traceOffset,
      bigEndian,
      inlineByte,
      crosslineByte
    );

    sampleTraces.push({
      index: i,
      inline: traceHeader.inline,
      crossline: traceHeader.crossline,
      sourceX: traceHeader.sourceX,
      sourceY: traceHeader.sourceY,
      traceId: traceHeader.traceId,
    });

    if (traceHeader.inline !== 0) inlines.add(traceHeader.inline);
    if (traceHeader.crossline !== 0) crosslines.add(traceHeader.crossline);
  }

  const inlineArr = Array.from(inlines).sort((a, b) => a - b);
  const crosslineArr = Array.from(crosslines).sort((a, b) => a - b);

  const inlineRange: [number, number] =
    inlineArr.length > 0
      ? [inlineArr[0], inlineArr[inlineArr.length - 1]]
      : [1, sampleTraceCount];

  const crosslineRange: [number, number] =
    crosslineArr.length > 0
      ? [crosslineArr[0], crosslineArr[crosslineArr.length - 1]]
      : [1, 1];

  const inlineCount = Math.max(1, inlineArr.length);
  const crosslineCount = Math.max(1, crosslineArr.length);

  return {
    textHeader: {
      raw: textHeaderRaw,
      lines: textHeaderLines,
      encoding: isEbcdic ? 'ebcdic' : 'ascii',
    },
    binaryHeader,
    sampleTraces,
    inlineRange,
    crosslineRange,
    inlineCount,
    crosslineCount,
    totalTraces,
    sampleCount,
    sampleInterval: sampleInterval / 1000,
    byteOrder: bigEndian ? 'big-endian' : 'little-endian',
    dataFormatCode,
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
    const result = analyzeSegyFile(req.file.path);

    const datasetId = 'segy-' + Date.now();

    res.json({
      success: true,
      datasetId,
      name: req.file.originalname,
      fileSize: req.file.size,
      inlineRange: result.inlineRange,
      crosslineRange: result.crosslineRange,
      inlineCount: result.inlineCount,
      crosslineCount: result.crosslineCount,
      timeSamples: result.sampleCount,
      sampleInterval: result.sampleInterval,
      timeRange: [0, (result.sampleCount - 1) * result.sampleInterval],
      totalTraces: result.totalTraces,
      byteOrder: result.byteOrder,
      dataFormatCode: result.dataFormatCode,
      message: 'SEGY file uploaded and parsed successfully',
    });
  } catch (error) {
    console.error('SEGY upload error:', error);
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
    const inlineByte = req.body.inlineByte ? parseInt(req.body.inlineByte) : undefined;
    const crosslineByte = req.body.crosslineByte ? parseInt(req.body.crosslineByte) : undefined;
    const byteOrder = req.body.byteOrder as 'big-endian' | 'little-endian' | undefined;

    const result = analyzeSegyFile(req.file.path, {
      inlineByte,
      crosslineByte,
      byteOrder,
    });

    res.json({
      success: true,
      textHeader: result.textHeader,
      binaryHeader: result.binaryHeader,
      sampleTraces: result.sampleTraces,
      inlineRange: result.inlineRange,
      crosslineRange: result.crosslineRange,
      inlineCount: result.inlineCount,
      crosslineCount: result.crosslineCount,
      sampleCount: result.sampleCount,
      sampleInterval: result.sampleInterval,
      totalTraces: result.totalTraces,
      byteOrder: result.byteOrder,
      dataFormatCode: result.dataFormatCode,
    });
  } catch (error) {
    console.error('SEGY parse error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse SEGY header',
    });
  }
});

router.post('/parse-with-options', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  try {
    const inlineByte = req.body.inlineByte ? parseInt(req.body.inlineByte) : 189;
    const crosslineByte = req.body.crosslineByte ? parseInt(req.body.crosslineByte) : 193;
    const byteOrder = (req.body.byteOrder as 'big-endian' | 'little-endian') || 'big-endian';
    const sampleCount = req.body.sampleCount ? parseInt(req.body.sampleCount) : undefined;
    const dataFormatCode = req.body.dataFormatCode ? parseInt(req.body.dataFormatCode) : undefined;

    const result = analyzeSegyFile(req.file.path, {
      inlineByte,
      crosslineByte,
      byteOrder,
      sampleCount,
      dataFormatCode,
    });

    res.json({
      success: true,
      textHeader: result.textHeader,
      binaryHeader: result.binaryHeader,
      sampleTraces: result.sampleTraces.slice(0, 20),
      geometry: {
        inlineRange: result.inlineRange,
        crosslineRange: result.crosslineRange,
        inlineCount: result.inlineCount,
        crosslineCount: result.crosslineCount,
        sampleCount: result.sampleCount,
        sampleInterval: result.sampleInterval,
        timeRange: [0, (result.sampleCount - 1) * result.sampleInterval],
        totalTraces: result.totalTraces,
      },
      byteOrder: result.byteOrder,
      dataFormatCode: result.dataFormatCode,
    });
  } catch (error) {
    console.error('SEGY parse with options error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse SEGY with options',
    });
  }
});

router.post('/read-trace-header', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  try {
    const traceIndex = parseInt(req.body.traceIndex || '0');
    const inlineByte = parseInt(req.body.inlineByte || '189');
    const crosslineByte = parseInt(req.body.crosslineByte || '193');
    const byteOrder = (req.body.byteOrder as string) || 'big-endian';
    const bigEndian = byteOrder !== 'little-endian';

    const fileBuffer = fs.readFileSync(req.file.path);

    const traceHeaderSize = 240;
    const dataStart = 3600;
    const sampleCount = parseInt(req.body.sampleCount || '1000');
    const bytesPerSample = 4;
    const traceSize = traceHeaderSize + sampleCount * bytesPerSample;

    const traceOffset = dataStart + traceIndex * traceSize;

    if (traceOffset + traceHeaderSize > fileBuffer.length) {
      return res.status(400).json({
        success: false,
        error: 'Trace index out of range',
      });
    }

    const headerBytes = fileBuffer.subarray(traceOffset, traceOffset + traceHeaderSize);
    const headerValues: Record<number, number> = {};

    for (let i = 1; i <= 240; i += 2) {
      if (i <= 236) {
        headerValues[i] = readInt16(headerBytes, i - 1, bigEndian);
      }
    }

    const headerInt32: Record<number, number> = {};
    for (let i = 1; i <= 236; i += 4) {
      headerInt32[i] = readInt32(headerBytes, i - 1, bigEndian);
    }

    res.json({
      success: true,
      traceIndex,
      headerBytes: Array.from(headerBytes),
      headerInt16: headerValues,
      headerInt32,
      inline: readInt32(headerBytes, inlineByte - 1, bigEndian),
      crossline: readInt32(headerBytes, crosslineByte - 1, bigEndian),
    });
  } catch (error) {
    console.error('Read trace header error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read trace header',
    });
  }
});

export default router;

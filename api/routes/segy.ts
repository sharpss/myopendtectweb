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

interface SegyDataset {
  id: string;
  name: string;
  filePath: string;
  fileSize: number;
  inlineCount: number;
  crosslineCount: number;
  timeSamples: number;
  sampleInterval: number;
  inlineStart: number;
  crosslineStart: number;
  timeStart: number;
  inlineStep: number;
  crosslineStep: number;
  inlineRange: [number, number];
  crosslineRange: [number, number];
  totalTraces: number;
  byteOrder: 'big-endian' | 'little-endian';
  dataFormatCode: number;
  bytesPerSample: number;
  inlineByte: number;
  crosslineByte: number;
  dataStart: number;
  traceSize: number;
  textHeader: { raw: string; lines: string[]; encoding: 'ebcdic' | 'ascii' };
  binaryHeader: any;
  traceIndex: Map<string, number>;
  minValue: number;
  maxValue: number;
}

const datasets = new Map<string, SegyDataset>();

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

function readUInt32(buffer: Buffer, offset: number, bigEndian: boolean): number {
  return bigEndian ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset);
}

function readInt16(buffer: Buffer, offset: number, bigEndian: boolean): number {
  return bigEndian ? buffer.readInt16BE(offset) : buffer.readInt16LE(offset);
}

function readUInt16(buffer: Buffer, offset: number, bigEndian: boolean): number {
  return bigEndian ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset);
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
    tracesPerEnsemble: readUInt16(buffer, offset + 12, bigEndian),
    auxTracesPerEnsemble: readUInt16(buffer, offset + 14, bigEndian),
    sampleInterval: readUInt16(buffer, offset + 16, bigEndian),
    sampleIntervalOrig: readUInt16(buffer, offset + 18, bigEndian),
    samplesPerTrace: readUInt16(buffer, offset + 20, bigEndian),
    samplesPerTraceOrig: readUInt16(buffer, offset + 22, bigEndian),
    dataFormatCode: readUInt16(buffer, offset + 24, bigEndian),
    ensembleFold: readUInt16(buffer, offset + 26, bigEndian),
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
    segyFormatRevisionMajor: buffer.readUInt8(offset + 300),
    segyFormatRevisionMinor: buffer.readUInt8(offset + 301),
    fixedLength: readUInt16(buffer, offset + 302, bigEndian),
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
    delayRecordingTime: readInt16(buffer, offset + 108, bigEndian),
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
  sampleIntervalUs: number;
  byteOrder: 'big-endian' | 'little-endian';
  dataFormatCode: number;
  dataStart: number;
  bytesPerSample: number;
  numExtTextHeaders: number;
} {
  const fileBuffer = fs.readFileSync(filePath);

  let bigEndian = options.byteOrder !== 'little-endian';
  const inlineByte = options.inlineByte ?? 189;
  const crosslineByte = options.crosslineByte ?? 193;

  const textHeaderBuffer = fileBuffer.subarray(0, 3200);
  const isEbcdic = detectEbcdic(textHeaderBuffer);
  const textHeaderRaw = isEbcdic
    ? ebcdicToAscii(textHeaderBuffer)
    : textHeaderBuffer.toString('ascii');
  const textHeaderLines = formatTextHeader(textHeaderRaw, 80);

  const binaryHeaderOffset = 3200;
  
  const tryParseWithByteOrder = (be: boolean) => {
    const bh = parseBinaryHeader(fileBuffer, binaryHeaderOffset, be);
    let extHeaders = Math.max(0, bh.numExtTextHeaders);
    let dataStart = 3600 + extHeaders * 3200;
    let sc = options.sampleCount || bh.samplesPerTrace || 1000;
    let dfc = options.dataFormatCode || bh.dataFormatCode || 5;
    let si = bh.sampleInterval || 4000;

    let bps = 4;
    if (dfc === 1 || dfc === 2 || dfc === 5) {
      bps = 4;
    } else if (dfc === 3) {
      bps = 2;
    } else if (dfc === 8) {
      bps = 1;
    } else {
      bps = 4;
      if (dfc === 0 || dfc > 8) {
        dfc = 5;
      }
    }

    if (sc <= 0 || sc > 100000) sc = 1000;
    if (si <= 0 || si > 100000) si = 4000;

    const ths = 240;
    const ts = ths + sc * bps;
    const tt = Math.floor((fileBuffer.length - dataStart) / ts);

    const sampleTraceCount = Math.min(2000, tt);
    const inlines: Set<number> = new Set();
    const crosslines: Set<number> = new Set();

    for (let i = 0; i < sampleTraceCount; i++) {
      const traceOffset = dataStart + i * ts;
      if (traceOffset + ths > fileBuffer.length) break;
      const il = readInt32(fileBuffer, traceOffset + inlineByte - 1, be);
      const xl = readInt32(fileBuffer, traceOffset + crosslineByte - 1, be);
      if (il !== undefined && il !== null && isFinite(il) && il > 0 && il < 100000000) {
        inlines.add(il);
      }
      if (xl !== undefined && xl !== null && isFinite(xl) && xl > 0 && xl < 100000000) {
        crosslines.add(xl);
      }
    }

    let score = 0;
    if (dfc >= 1 && dfc <= 8) score += 10;
    if (dfc === 1) score += 15;
    if (sc >= 100 && sc <= 50000) score += 10;
    if (si >= 100 && si <= 10000) score += 5;
    if (extHeaders >= 0 && extHeaders <= 10) score += 3;
    if (inlines.size > 5) score += 5;
    if (crosslines.size > 5) score += 5;
    if (inlines.size > 50) score += 10;
    if (crosslines.size > 50) score += 10;
    if (tt > 100) score += 5;
    if (tt > 0) {
      let ic = 1, xc = 1;
      const ila = Array.from(inlines).sort((a, b) => a - b);
      const cla = Array.from(crosslines).sort((a, b) => a - b);
      if (ila.length > 1) {
        const st: number[] = [];
        for (let i = 1; i < ila.length; i++) { const d = ila[i] - ila[i-1]; if (d > 0) st.push(d); }
        const step = st.length > 0 ? Math.min(...st) : 1;
        ic = Math.floor((ila[ila.length-1] - ila[0]) / step) + 1;
      }
      if (cla.length > 1) {
        const st: number[] = [];
        for (let i = 1; i < cla.length; i++) { const d = cla[i] - cla[i-1]; if (d > 0) st.push(d); }
        const step = st.length > 0 ? Math.min(...st) : 1;
        xc = Math.floor((cla[cla.length-1] - cla[0]) / step) + 1;
      }
      const ratio = (ic * xc) / tt;
      if (ratio > 0.5 && ratio < 2) score += 25;
      else if (ratio > 0.2 && ratio < 5) score += 10;
      else if (ratio > 0.1 && ratio < 10) score += 3;
    }

    return {
      bh,
      extHeaders,
      dataStart,
      sc,
      dfc,
      si,
      bps,
      ts,
      tt,
      inlines,
      crosslines,
      score,
    };
  };

  let parseResult = tryParseWithByteOrder(bigEndian);
  
  if (!options.byteOrder) {
    const parseResultLE = tryParseWithByteOrder(false);
    if (parseResultLE.score > parseResult.score) {
      parseResult = parseResultLE;
      bigEndian = false;
    }
  }

  const { bh, extHeaders, dataStart, sc: sampleCount, dfc: dataFormatCode, si, bps: bytesPerSample, ts: traceSize, tt: totalTraces, inlines, crosslines } = parseResult;
  const sampleInterval = si;

  const sampleTraceCount = Math.min(2000, totalTraces);
  const sampleTraces: any[] = [];

  for (let i = 0; i < sampleTraceCount; i++) {
    const traceOffset = dataStart + i * traceSize;
    if (traceOffset + 240 > fileBuffer.length) break;

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
  }

  const inlineArr = Array.from(inlines).sort((a, b) => a - b);
  const crosslineArr = Array.from(crosslines).sort((a, b) => a - b);

  let inlineCount: number;
  let crosslineCount: number;
  let inlineRange: [number, number];
  let crosslineRange: [number, number];

  if (inlineArr.length > 1) {
    const minIl = inlineArr[0];
    const maxIl = inlineArr[inlineArr.length - 1];
    const steps = [];
    for (let i = 1; i < inlineArr.length; i++) {
      const diff = inlineArr[i] - inlineArr[i - 1];
      if (diff > 0) steps.push(diff);
    }
    const stepIl = steps.length > 0 ? Math.min(...steps) : 1;
    inlineCount = Math.floor((maxIl - minIl) / stepIl) + 1;
    inlineRange = [minIl, maxIl];
  } else if (inlineArr.length === 1) {
    inlineCount = 1;
    inlineRange = [inlineArr[0], inlineArr[0]];
  } else {
    inlineCount = Math.max(1, Math.floor(Math.sqrt(totalTraces)));
    inlineRange = [1, inlineCount];
  }

  if (crosslineArr.length > 1) {
    const minXl = crosslineArr[0];
    const maxXl = crosslineArr[crosslineArr.length - 1];
    const steps = [];
    for (let i = 1; i < crosslineArr.length; i++) {
      const diff = crosslineArr[i] - crosslineArr[i - 1];
      if (diff > 0) steps.push(diff);
    }
    const stepXl = steps.length > 0 ? Math.min(...steps) : 1;
    crosslineCount = Math.floor((maxXl - minXl) / stepXl) + 1;
    crosslineRange = [minXl, maxXl];
  } else if (crosslineArr.length === 1) {
    crosslineCount = 1;
    crosslineRange = [crosslineArr[0], crosslineArr[0]];
  } else {
    crosslineCount = Math.max(1, Math.ceil(totalTraces / Math.max(1, inlineCount)));
    crosslineRange = [1, crosslineCount];
  }

  if (totalTraces > 0 && inlineCount * crosslineCount < totalTraces * 0.1) {
    const estCount = Math.max(inlineCount, crosslineCount);
    const otherCount = Math.ceil(totalTraces / estCount);
    if (inlineArr.length >= crosslineArr.length) {
      crosslineCount = otherCount;
      crosslineRange = [1, otherCount];
    } else {
      inlineCount = otherCount;
      inlineRange = [1, otherCount];
    }
  }

  return {
    textHeader: {
      raw: textHeaderRaw,
      lines: textHeaderLines,
      encoding: isEbcdic ? 'ebcdic' : 'ascii',
    },
    binaryHeader: bh,
    sampleTraces,
    inlineRange,
    crosslineRange,
    inlineCount,
    crosslineCount,
    totalTraces,
    sampleCount,
    sampleInterval: sampleInterval / 1000,
    sampleIntervalUs: sampleInterval,
    byteOrder: bigEndian ? 'big-endian' : 'little-endian',
    dataFormatCode,
    dataStart,
    bytesPerSample,
    numExtTextHeaders: extHeaders,
  };
}

function readTraceData(
  fileBuffer: Buffer,
  traceIndex: number,
  sampleCount: number,
  dataFormatCode: number,
  bigEndian: boolean,
  traceSize: number,
  dataStart: number = 3600
): Float32Array {
  const traceHeaderSize = 240;
  const dataOffset = dataStart + traceIndex * traceSize + traceHeaderSize;
  const result = new Float32Array(sampleCount);

  let bytesPerSample = 4;
  if (dataFormatCode === 3) bytesPerSample = 2;
  else if (dataFormatCode === 8) bytesPerSample = 1;

  for (let i = 0; i < sampleCount; i++) {
    const sampleOffset = dataOffset + i * bytesPerSample;
    if (sampleOffset + bytesPerSample > fileBuffer.length) {
      result[i] = 0;
      continue;
    }

    if (dataFormatCode === 5) {
      result[i] = bigEndian
        ? fileBuffer.readFloatBE(sampleOffset)
        : fileBuffer.readFloatLE(sampleOffset);
    } else if (dataFormatCode === 1) {
      result[i] = ibmFloatToNumber(fileBuffer, sampleOffset, bigEndian);
    } else if (dataFormatCode === 2) {
      result[i] = bigEndian
        ? fileBuffer.readInt32BE(sampleOffset)
        : fileBuffer.readInt32LE(sampleOffset);
    } else if (dataFormatCode === 3) {
      result[i] = bigEndian
        ? fileBuffer.readInt16BE(sampleOffset)
        : fileBuffer.readInt16LE(sampleOffset);
    } else if (dataFormatCode === 8) {
      result[i] = fileBuffer.readInt8(sampleOffset);
    } else {
      result[i] = bigEndian
        ? fileBuffer.readFloatBE(sampleOffset)
        : fileBuffer.readFloatLE(sampleOffset);
    }
  }

  return result;
}

function buildFullDataset(
  filePath: string,
  inlineByte: number,
  crosslineByte: number,
  _byteOrder: 'big-endian' | 'little-endian',
  _sampleCount?: number,
  _dataFormatCode?: number
): SegyDataset | null {
  const fileBuffer = fs.readFileSync(filePath);

  const analysis = analyzeSegyFile(filePath, {
    inlineByte,
    crosslineByte,
  });

  const bigEndian = analysis.byteOrder !== 'little-endian';
  const actualSampleCount = analysis.sampleCount;
  const actualDataFormat = analysis.dataFormatCode;
  const traceHeaderSize = 240;
  let bytesPerSample = 4;
  if (actualDataFormat === 3) bytesPerSample = 2;
  if (actualDataFormat === 8) bytesPerSample = 1;
  const traceSize = traceHeaderSize + actualSampleCount * bytesPerSample;
  const dataStart = analysis.dataStart || 3600;
  const totalTraces = Math.floor((fileBuffer.length - dataStart) / traceSize);

  const isValidInline = (v: number) => {
    return v !== null && v !== undefined && isFinite(v) && v > 0 && v < 100000000;
  };
  const isValidCrossline = (v: number) => {
    return v !== null && v !== undefined && isFinite(v) && v > 0 && v < 100000000;
  };

  const traceIndex = new Map<string, number>();
  const inlineSet = new Set<number>();
  const crosslineSet = new Set<number>();
  let minVal = Infinity;
  let maxVal = -Infinity;
  let delayTimeSum = 0;
  let delayTimeCount = 0;

  for (let i = 0; i < totalTraces; i++) {
    const traceOffset = dataStart + i * traceSize;
    if (traceOffset + traceHeaderSize > fileBuffer.length) break;

    const header = parseTraceHeader(
      fileBuffer,
      traceOffset,
      bigEndian,
      inlineByte,
      crosslineByte
    );

    if (!isValidInline(header.inline) || !isValidCrossline(header.crossline)) {
      continue;
    }

    const key = `${header.inline}_${header.crossline}`;
    traceIndex.set(key, i);
    inlineSet.add(header.inline);
    crosslineSet.add(header.crossline);

    if (header.delayRecordingTime > 0 && header.delayRecordingTime < 100000) {
      delayTimeSum += header.delayRecordingTime;
      delayTimeCount++;
    }

    const traceData = readTraceData(
      fileBuffer,
      i,
      actualSampleCount,
      actualDataFormat,
      bigEndian,
      traceSize,
      dataStart
    );
    for (let s = 0; s < traceData.length; s++) {
      if (traceData[s] < minVal) minVal = traceData[s];
      if (traceData[s] > maxVal) maxVal = traceData[s];
    }
  }

  const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
  const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

  if (inlineArr.length === 0 || crosslineArr.length === 0) {
    throw new Error('No valid traces found. Please check inline/crossline byte positions and byte order.');
  }

  let inlineStep = 1;
  let crosslineStep = 1;
  if (inlineArr.length > 1) {
    const steps: number[] = [];
    for (let i = 1; i < inlineArr.length; i++) {
      const diff = inlineArr[i] - inlineArr[i - 1];
      if (diff > 0 && diff < 10000) steps.push(diff);
    }
    inlineStep = steps.length > 0 ? Math.min(...steps) : 1;
  }
  if (crosslineArr.length > 1) {
    const steps: number[] = [];
    for (let i = 1; i < crosslineArr.length; i++) {
      const diff = crosslineArr[i] - crosslineArr[i - 1];
      if (diff > 0 && diff < 10000) steps.push(diff);
    }
    crosslineStep = steps.length > 0 ? Math.min(...steps) : 1;
  }

  const calculatedInlineCount = Math.max(1, inlineArr.length > 1 
    ? Math.floor((inlineArr[inlineArr.length - 1] - inlineArr[0]) / inlineStep) + 1
    : inlineArr.length);
  const calculatedCrosslineCount = Math.max(1, crosslineArr.length > 1
    ? Math.floor((crosslineArr[crosslineArr.length - 1] - crosslineArr[0]) / crosslineStep) + 1
    : crosslineArr.length);

  const datasetId = `segy-${Date.now()}`;

  const avgDelayTime = delayTimeCount > 0 ? Math.round(delayTimeSum / delayTimeCount) : 0;
  let timeStartMs = 0;
  if (avgDelayTime > 0 && avgDelayTime < 60000) {
    const sampleIntervalMs = analysis.sampleInterval;
    if (avgDelayTime * sampleIntervalMs < 60000) {
      timeStartMs = avgDelayTime * sampleIntervalMs;
    } else {
      timeStartMs = avgDelayTime;
    }
  } else {
    timeStartMs = 0;
  }

  return {
    id: datasetId,
    name: path.basename(filePath),
    filePath,
    fileSize: fileBuffer.length,
    inlineCount: calculatedInlineCount,
    crosslineCount: calculatedCrosslineCount,
    timeSamples: actualSampleCount,
    sampleInterval: analysis.sampleInterval,
    inlineStart: inlineArr[0],
    crosslineStart: crosslineArr[0],
    timeStart: timeStartMs,
    inlineStep,
    crosslineStep,
    inlineRange: [inlineArr[0], inlineArr[inlineArr.length - 1]],
    crosslineRange: [crosslineArr[0], crosslineArr[crosslineArr.length - 1]],
    totalTraces: traceIndex.size,
    byteOrder: analysis.byteOrder,
    dataFormatCode: actualDataFormat,
    bytesPerSample,
    inlineByte,
    crosslineByte,
    dataStart,
    traceSize,
    textHeader: analysis.textHeader,
    binaryHeader: analysis.binaryHeader,
    traceIndex,
    minValue: isFinite(minVal) ? minVal : -1,
    maxValue: isFinite(maxVal) ? maxVal : 1,
  };
}

function getSliceData(
  dataset: SegyDataset,
  type: 'inline' | 'crossline' | 'timeslice',
  index: number
): { data: Float32Array; width: number; height: number; minValue: number; maxValue: number } {
  const fileBuffer = fs.readFileSync(dataset.filePath);
  const bigEndian = dataset.byteOrder !== 'little-endian';
  const traceHeaderSize = 240;
  const traceSize = dataset.traceSize || (traceHeaderSize + dataset.timeSamples * dataset.bytesPerSample);
  const dataStart = dataset.dataStart || 3600;

  const inlineStart = dataset.inlineStart || 0;
  const crosslineStart = dataset.crosslineStart || 0;
  const inlineStep = dataset.inlineStep || 1;
  const crosslineStep = dataset.crosslineStep || 1;

  let width: number;
  let height: number;
  let sliceData: Float32Array;
  let minVal = Infinity;
  let maxVal = -Infinity;

  const MAX_SLICE_SAMPLES = 64 * 1024 * 1024;
  const sliceSize = type === 'timeslice' 
    ? dataset.inlineCount * dataset.crosslineCount 
    : (type === 'inline' ? dataset.crosslineCount : dataset.inlineCount) * dataset.timeSamples;
  if (!isFinite(sliceSize) || sliceSize <= 0 || sliceSize > MAX_SLICE_SAMPLES) {
    throw new Error(`Slice size ${sliceSize} exceeds maximum allowed size`);
  }

  if (type === 'inline') {
    width = dataset.crosslineCount;
    height = dataset.timeSamples;
    sliceData = new Float32Array(width * height);
    const safeIdx = Math.max(0, Math.min(index, dataset.inlineCount - 1));
    const inlineVal = inlineStart + safeIdx * inlineStep;

    for (const [key, traceIdx] of dataset.traceIndex.entries()) {
      const [ilStr, xlStr] = key.split('_');
      const ilVal = parseInt(ilStr);
      const xlVal = parseInt(xlStr);
      
      if (ilVal !== inlineVal) continue;
      
      const xlIdx = Math.floor((xlVal - crosslineStart) / crosslineStep);
      if (xlIdx < 0 || xlIdx >= width) continue;

      const traceData = readTraceData(
        fileBuffer,
        traceIdx,
        dataset.timeSamples,
        dataset.dataFormatCode,
        bigEndian,
        traceSize,
        dataStart
      );
      for (let t = 0; t < height && t < traceData.length; t++) {
        const sliceIdx = xlIdx * height + t;
        sliceData[sliceIdx] = traceData[t];
        if (traceData[t] < minVal) minVal = traceData[t];
        if (traceData[t] > maxVal) maxVal = traceData[t];
      }
    }
  } else if (type === 'crossline') {
    width = dataset.inlineCount;
    height = dataset.timeSamples;
    sliceData = new Float32Array(width * height);
    const safeIdx = Math.max(0, Math.min(index, dataset.crosslineCount - 1));
    const crosslineVal = crosslineStart + safeIdx * crosslineStep;

    for (const [key, traceIdx] of dataset.traceIndex.entries()) {
      const [ilStr, xlStr] = key.split('_');
      const ilVal = parseInt(ilStr);
      const xlVal = parseInt(xlStr);
      
      if (xlVal !== crosslineVal) continue;
      
      const ilIdx = Math.floor((ilVal - inlineStart) / inlineStep);
      if (ilIdx < 0 || ilIdx >= width) continue;

      const traceData = readTraceData(
        fileBuffer,
        traceIdx,
        dataset.timeSamples,
        dataset.dataFormatCode,
        bigEndian,
        traceSize,
        dataStart
      );
      for (let t = 0; t < height && t < traceData.length; t++) {
        const sliceIdx = ilIdx * height + t;
        sliceData[sliceIdx] = traceData[t];
        if (traceData[t] < minVal) minVal = traceData[t];
        if (traceData[t] > maxVal) maxVal = traceData[t];
      }
    }
  } else {
    width = dataset.inlineCount;
    height = dataset.crosslineCount;
    sliceData = new Float32Array(width * height);
    const timeIdx = Math.max(0, Math.min(index, dataset.timeSamples - 1));

    for (const [key, traceIdx] of dataset.traceIndex.entries()) {
      const [ilStr, xlStr] = key.split('_');
      const ilVal = parseInt(ilStr);
      const xlVal = parseInt(xlStr);
      
      const ilIdx = Math.floor((ilVal - inlineStart) / inlineStep);
      const xlIdx = Math.floor((xlVal - crosslineStart) / crosslineStep);
      
      if (ilIdx < 0 || ilIdx >= width || xlIdx < 0 || xlIdx >= height) continue;

      const traceData = readTraceData(
        fileBuffer,
        traceIdx,
        dataset.timeSamples,
        dataset.dataFormatCode,
        bigEndian,
        traceSize,
        dataStart
      );
      const sliceIdx = ilIdx * height + xlIdx;
      const val = traceData[timeIdx] || 0;
      sliceData[sliceIdx] = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }

  if (!isFinite(minVal)) minVal = dataset.minValue;
  if (!isFinite(maxVal)) maxVal = dataset.maxValue;

  return {
    data: sliceData,
    width,
    height,
    minValue: minVal,
    maxValue: maxVal,
  };
}

function getVolumeData(dataset: SegyDataset): { data: Float32Array; minValue: number; maxValue: number } {
  const fileBuffer = fs.readFileSync(dataset.filePath);
  const bigEndian = dataset.byteOrder !== 'little-endian';
  const traceHeaderSize = 240;
  const traceSize = dataset.traceSize || (traceHeaderSize + dataset.timeSamples * dataset.bytesPerSample);
  const dataStart = dataset.dataStart || 3600;

  const inlineStart = dataset.inlineStart || 0;
  const crosslineStart = dataset.crosslineStart || 0;
  const inlineStep = dataset.inlineStep || 1;
  const crosslineStep = dataset.crosslineStep || 1;

  const MAX_SAMPLES = 256 * 1024 * 1024;
  const totalSize = dataset.inlineCount * dataset.crosslineCount * dataset.timeSamples;
  if (!isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_SAMPLES) {
    throw new Error(`Volume size ${totalSize} exceeds maximum allowed size ${MAX_SAMPLES}`);
  }

  const volume = new Float32Array(totalSize);
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const [key, traceIdx] of dataset.traceIndex.entries()) {
    const [ilStr, xlStr] = key.split('_');
    const ilVal = parseInt(ilStr);
    const xlVal = parseInt(xlStr);

    const ilIdx = Math.floor((ilVal - inlineStart) / inlineStep);
    const xlIdx = Math.floor((xlVal - crosslineStart) / crosslineStep);

    if (ilIdx < 0 || ilIdx >= dataset.inlineCount || xlIdx < 0 || xlIdx >= dataset.crosslineCount) {
      continue;
    }

    const traceData = readTraceData(
      fileBuffer,
      traceIdx,
      dataset.timeSamples,
      dataset.dataFormatCode,
      bigEndian,
      traceSize,
      dataStart
    );
    for (let t = 0; t < dataset.timeSamples && t < traceData.length; t++) {
      const volIdx = (ilIdx * dataset.crosslineCount + xlIdx) * dataset.timeSamples + t;
      volume[volIdx] = traceData[t];
      if (traceData[t] < minVal) minVal = traceData[t];
      if (traceData[t] > maxVal) maxVal = traceData[t];
    }
  }

  if (!isFinite(minVal)) minVal = dataset.minValue;
  if (!isFinite(maxVal)) maxVal = dataset.maxValue;

  return { data: volume, minValue: minVal, maxValue: maxVal };
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

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
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
    const datasetName = req.body.datasetName as string || path.basename(req.file.originalname);

    const dataset = buildFullDataset(
      req.file.path,
      inlineByte,
      crosslineByte,
      byteOrder,
      sampleCount,
      dataFormatCode
    );

    if (!dataset) {
      return res.status(500).json({
        success: false,
        error: 'Failed to build dataset',
      });
    }

    dataset.name = datasetName;
    datasets.set(dataset.id, dataset);

    res.json({
      success: true,
      datasetId: dataset.id,
      name: dataset.name,
      inlineCount: dataset.inlineCount,
      crosslineCount: dataset.crosslineCount,
      timeSamples: dataset.timeSamples,
      sampleInterval: dataset.sampleInterval,
      inlineStart: dataset.inlineStart,
      crosslineStart: dataset.crosslineStart,
      timeStart: dataset.timeStart,
      inlineStep: dataset.inlineStep,
      crosslineStep: dataset.crosslineStep,
      inlineRange: dataset.inlineRange,
      crosslineRange: dataset.crosslineRange,
      totalTraces: dataset.totalTraces,
      byteOrder: dataset.byteOrder,
      dataFormatCode: dataset.dataFormatCode,
      minValue: dataset.minValue,
      maxValue: dataset.maxValue,
      textHeader: dataset.textHeader,
    });
  } catch (error) {
    console.error('SEGY import error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import SEGY',
    });
  }
});

router.get('/datasets/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const dataset = datasets.get(id);

  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found',
    });
  }

  res.json({
    success: true,
    data: {
      id: dataset.id,
      name: dataset.name,
      inlineCount: dataset.inlineCount,
      crosslineCount: dataset.crosslineCount,
      timeSamples: dataset.timeSamples,
      sampleInterval: dataset.sampleInterval,
      inlineStart: dataset.inlineStart,
      crosslineStart: dataset.crosslineStart,
      timeStart: dataset.timeStart,
      inlineStep: dataset.inlineStep,
      crosslineStep: dataset.crosslineStep,
      inlineRange: dataset.inlineRange,
      crosslineRange: dataset.crosslineRange,
      totalTraces: dataset.totalTraces,
      byteOrder: dataset.byteOrder,
      dataFormatCode: dataset.dataFormatCode,
      minValue: dataset.minValue,
      maxValue: dataset.maxValue,
      source: 'segy',
    },
  });
});

router.get('/datasets/:id/slice', (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, index } = req.query;

  const dataset = datasets.get(id);
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found',
    });
  }

  if (!type || !index) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: type, index',
    });
  }

  const sliceType = type as 'inline' | 'crossline' | 'timeslice';
  const sliceIndex = parseInt(index as string);

  try {
    const sliceData = getSliceData(dataset, sliceType, sliceIndex);

    res.json({
      success: true,
      data: {
        type: sliceType,
        index: sliceIndex,
        width: sliceData.width,
        height: sliceData.height,
        minValue: sliceData.minValue,
        maxValue: sliceData.maxValue,
        data: Array.from(sliceData.data),
      },
    });
  } catch (error) {
    console.error('Slice read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read slice',
    });
  }
});

router.get('/datasets/:id/volume', (req: Request, res: Response) => {
  const { id } = req.params;
  const dataset = datasets.get(id);

  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found',
    });
  }

  try {
    const volumeData = getVolumeData(dataset);

    res.json({
      success: true,
      data: {
        inlineCount: dataset.inlineCount,
        crosslineCount: dataset.crosslineCount,
        timeSamples: dataset.timeSamples,
        minValue: volumeData.minValue,
        maxValue: volumeData.maxValue,
        data: Array.from(volumeData.data),
      },
    });
  } catch (error) {
    console.error('Volume read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read volume',
    });
  }
});

export default router;

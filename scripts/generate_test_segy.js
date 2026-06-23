import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INLINE_COUNT = 20;
const CROSSLINE_COUNT = 25;
const TIME_SAMPLES = 50;
const SAMPLE_INTERVAL = 4000;

function writeEBCDICHeader(fd) {
  const header = Buffer.alloc(3200, 0x40);
  const lines = [
    'C01 TEST SEGY FILE - GENERATED FOR DEVELOPMENT',
    'C02 INLINE BYTE LOCATION: 189',
    'C03 CROSSLINE BYTE LOCATION: 193',
    'C04 SAMPLE INTERVAL: 4000 MICROSECONDS',
    'C05 DATA FORMAT: IBM FLOATING POINT (CODE 1)',
    'C06 END OF HEADER',
  ];
  
  for (let i = 0; i < lines.length && i < 40; i++) {
    const line = lines[i].padEnd(80, ' ');
    for (let j = 0; j < 80 && j < line.length; j++) {
      const asciiCode = line.charCodeAt(j);
      header[i * 80 + j] = asciiToEbcdic(asciiCode);
    }
  }
  
  fs.writeSync(fd, header);
}

function asciiToEbcdic(asciiCode) {
  const ebcdicMap = {
    0x20: 0x40, 0x21: 0x5a, 0x22: 0x7f, 0x23: 0x7b,
    0x24: 0x5b, 0x25: 0x6c, 0x26: 0x50, 0x27: 0x7d,
    0x28: 0x4d, 0x29: 0x5d, 0x2a: 0x5c, 0x2b: 0x4e,
    0x2c: 0x6b, 0x2d: 0x60, 0x2e: 0x4b, 0x2f: 0x61,
    0x30: 0xf0, 0x31: 0xf1, 0x32: 0xf2, 0x33: 0xf3,
    0x34: 0xf4, 0x35: 0xf5, 0x36: 0xf6, 0x37: 0xf7,
    0x38: 0xf8, 0x39: 0xf9, 0x3a: 0x7a, 0x3b: 0x5e,
    0x3c: 0x4c, 0x3d: 0x7e, 0x3e: 0x6e, 0x3f: 0x6f,
    0x40: 0x7c, 0x41: 0xc1, 0x42: 0xc2, 0x43: 0xc3,
    0x44: 0xc4, 0x45: 0xc5, 0x46: 0xc6, 0x47: 0xc7,
    0x48: 0xc8, 0x49: 0xc9, 0x4a: 0xd1, 0x4b: 0xd2,
    0x4c: 0xd3, 0x4d: 0xd4, 0x4e: 0xd5, 0x4f: 0xd6,
    0x50: 0xd7, 0x51: 0xd8, 0x52: 0xd9, 0x53: 0xe2,
    0x54: 0xe3, 0x55: 0xe4, 0x56: 0xe5, 0x57: 0xe6,
    0x58: 0xe7, 0x59: 0xe8, 0x5a: 0xe9, 0x5f: 0x6d,
    0x61: 0x81, 0x62: 0x82, 0x63: 0x83, 0x64: 0x84,
    0x65: 0x85, 0x66: 0x86, 0x67: 0x87, 0x68: 0x88,
    0x69: 0x89, 0x6a: 0x91, 0x6b: 0x92, 0x6c: 0x93,
    0x6d: 0x94, 0x6e: 0x95, 0x6f: 0x96, 0x70: 0x97,
    0x71: 0x98, 0x72: 0x99, 0x73: 0xa2, 0x74: 0xa3,
    0x75: 0xa4, 0x76: 0xa5, 0x77: 0xa6, 0x78: 0xa7,
    0x79: 0xa8, 0x7a: 0xa9, 0x7b: 0xc0, 0x7c: 0x4f,
    0x7d: 0xd0, 0x7e: 0xa1,
  };
  return ebcdicMap[asciiCode] || 0x40;
}

function writeBinaryHeader(fd) {
  const buf = Buffer.alloc(400, 0);
  buf.writeInt32BE(INLINE_COUNT * CROSSLINE_COUNT, 0);
  buf.writeInt32BE(0, 4);
  buf.writeInt16BE(0, 8);
  buf.writeInt16BE(SAMPLE_INTERVAL, 16);
  buf.writeInt16BE(SAMPLE_INTERVAL, 20);
  buf.writeInt16BE(TIME_SAMPLES, 24);
  buf.writeInt16BE(TIME_SAMPLES, 28);
  buf.writeInt16BE(1, 24 - 8 + 24);
  buf.writeInt16BE(1, 36);
  buf.writeInt16BE(1, 54);
  fs.writeSync(fd, buf);
}

function floatToIBM(value) {
  if (value === 0) return 0;
  
  const sign = value < 0 ? 1 : 0;
  let absValue = Math.abs(value);
  
  let exponent = 0;
  while (absValue < 0.5) {
    absValue *= 16;
    exponent--;
  }
  while (absValue >= 1.0) {
    absValue /= 16;
    exponent++;
  }
  
  const mantissa = Math.floor(absValue * 0x1000000);
  const exp = exponent + 64;
  
  return (sign << 31) | ((exp & 0x7f) << 24) | (mantissa & 0xffffff);
}

function generateTestData(inline, crossline, time) {
  const x = inline / INLINE_COUNT;
  const y = crossline / CROSSLINE_COUNT;
  const z = time / TIME_SAMPLES;
  
  let value = 0;
  value += Math.sin(x * Math.PI * 3) * Math.cos(y * Math.PI * 2) * 0.3;
  value += Math.sin(z * Math.PI * 4 + x * Math.PI) * 0.4;
  value += Math.sin((x + y + z) * Math.PI * 2) * 0.2;
  value += (Math.random() - 0.5) * 0.1;
  
  return Math.max(-1, Math.min(1, value));
}

function writeTrace(fd, inline, crossline) {
  const traceHeader = Buffer.alloc(240, 0);
  
  traceHeader.writeInt32BE(inline * 100, 0);
  traceHeader.writeInt32BE(crossline * 100, 4);
  traceHeader.writeInt32BE(0, 8);
  traceHeader.writeInt16BE(1, 28);
  traceHeader.writeInt16BE(1, 30);
  traceHeader.writeInt16BE(0, 32);
  traceHeader.writeInt16BE(SAMPLE_INTERVAL, 114);
  traceHeader.writeInt16BE(TIME_SAMPLES, 116);
  traceHeader.writeInt16BE(1, 118);
  traceHeader.writeInt32BE(inline, 188);
  traceHeader.writeInt32BE(crossline, 192);
  traceHeader.writeInt16BE(1, 204);
  
  fs.writeSync(fd, traceHeader);
  
  const data = Buffer.alloc(TIME_SAMPLES * 4);
  for (let t = 0; t < TIME_SAMPLES; t++) {
    const value = generateTestData(inline, crossline, t);
    const ibmValue = floatToIBM(value);
    data.writeInt32BE(ibmValue, t * 4);
  }
  
  fs.writeSync(fd, data);
}

function generateSegy(outputPath) {
  const fd = fs.openSync(outputPath, 'w');
  
  writeEBCDICHeader(fd);
  writeBinaryHeader(fd);
  
  for (let il = 0; il < INLINE_COUNT; il++) {
    for (let xl = 0; xl < CROSSLINE_COUNT; xl++) {
      writeTrace(fd, il, xl);
    }
  }
  
  fs.closeSync(fd);
  console.log(`Generated SEGY file: ${outputPath}`);
  console.log(`  Inlines: ${INLINE_COUNT}`);
  console.log(`  Crosslines: ${CROSSLINE_COUNT}`);
  console.log(`  Time samples: ${TIME_SAMPLES}`);
  console.log(`  Sample interval: ${SAMPLE_INTERVAL} us`);
  console.log(`  Total traces: ${INLINE_COUNT * CROSSLINE_COUNT}`);
}

const outputPath = path.join(__dirname, '../test_data.segy');
generateSegy(outputPath);

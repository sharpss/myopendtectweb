const EBCDIC_TO_ASCII: Record<number, number> = {
  0x00: 0x00, 0x01: 0x01, 0x02: 0x02, 0x03: 0x03,
  0x37: 0x04, 0x2d: 0x05, 0x2e: 0x06, 0x2f: 0x07,
  0x16: 0x08, 0x05: 0x09, 0x25: 0x0a, 0x0b: 0x0b,
  0x0c: 0x0c, 0x0d: 0x0d, 0x0e: 0x0e, 0x0f: 0x0f,
  0x10: 0x10, 0x11: 0x11, 0x12: 0x12, 0x13: 0x13,
  0x3c: 0x14, 0x3d: 0x15, 0x32: 0x16, 0x26: 0x17,
  0x18: 0x18, 0x19: 0x19, 0x3f: 0x1a, 0x27: 0x1b,
  0x1c: 0x1c, 0x1d: 0x1d, 0x1e: 0x1e, 0x1f: 0x1f,
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
  0xf7: 0x37, 0xf8: 0x38, 0xf9: 0x39, 0x4f: 0xa0,
  0x5f: 0xac, 0x79: 0xaf,
};

export function ebcdicToAscii(buffer: Uint8Array | Buffer): string {
  const len = buffer.length;
  const result = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const ebcdicByte = buffer[i];
    const asciiByte = EBCDIC_TO_ASCII[ebcdicByte];
    result[i] = asciiByte !== undefined ? asciiByte : 0x20;
  }

  let str = '';
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = result.subarray(i, Math.min(i + chunkSize, len));
    str += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return str;
}

export function formatSegyTextHeader(text: string, lineLength: number = 80): string[] {
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

export function detectEbcdic(buffer: Uint8Array): boolean {
  let ebcdicCount = 0;
  let asciiCount = 0;
  const checkLen = Math.min(100, buffer.length);

  for (let i = 0; i < checkLen; i++) {
    const byte = buffer[i];
    if (byte >= 0x41 && byte <= 0xf9 && byte !== 0x7f) {
      if ((byte >= 0x81 && byte <= 0x89) ||
          (byte >= 0x91 && byte <= 0x99) ||
          (byte >= 0xa2 && byte <= 0xa9) ||
          (byte >= 0xc1 && byte <= 0xc9) ||
          (byte >= 0xd1 && byte <= 0xd9) ||
          (byte >= 0xe2 && byte <= 0xe9) ||
          (byte >= 0xf0 && byte <= 0xf9) ||
          byte === 0x40) {
        ebcdicCount++;
      }
    }
    if ((byte >= 0x20 && byte <= 0x7e) || byte === 0x0a || byte === 0x0d) {
      asciiCount++;
    }
  }

  return ebcdicCount > asciiCount * 0.5;
}

export function parseSegyTextHeader(buffer: Uint8Array): {
  text: string;
  lines: string[];
  encoding: 'ebcdic' | 'ascii';
} {
  const isEbcdic = detectEbcdic(buffer);
  const text = isEbcdic ? ebcdicToAscii(buffer) : new TextDecoder('ascii').decode(buffer);
  const lines = formatSegyTextHeader(text, 80);

  return { text, lines, encoding: isEbcdic ? 'ebcdic' : 'ascii' };
}

export interface SegyBytePreset {
  name: string;
  description: string;
  inlineByte: number;
  crosslineByte: number;
  sampleIntervalByte: number;
  xByte?: number;
  yByte?: number;
  elevationByte?: number;
}

export const SEGY_BYTE_PRESETS: SegyBytePreset[] = [
  {
    name: '标准 SEGY (Rev 1)',
    description: 'SEG-Y Rev 1 标准位置',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
    elevationByte: 41,
  },
  {
    name: 'G&G / 自定义格式',
    description: 'Inline@9, Crossline@21 (常见非标准格式)',
    inlineByte: 9,
    crosslineByte: 21,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
    elevationByte: 41,
  },
  {
    name: 'ProMAX',
    description: 'Landmark ProMAX 软件输出',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
    elevationByte: 41,
  },
  {
    name: 'OpendTect / dGB',
    description: 'OpendTect 软件输出格式',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
  },
  {
    name: 'Paradigm / Focus',
    description: 'Paradigm Focus / Echos (inline@9, crossline@13)',
    inlineByte: 9,
    crosslineByte: 13,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
  },
  {
    name: 'CGG / GeoQuest',
    description: 'CGG GeoQuest 格式',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
  },
  {
    name: 'WesternGeco',
    description: 'WesternGeco 输出格式',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    xByte: 73,
    yByte: 77,
  },
  {
    name: '自定义',
    description: '手动输入字节位置',
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
  },
];

export function findBytePositionInfo(bytePosition: number): {
  position: number;
  fieldName: string;
  description: string;
  type: string;
}[] {
  const traceHeaderFields = [
    { position: 1, fieldName: 'Trace Sequence Number (line)', description: '道序号（测线内）', type: 'int32' },
    { position: 5, fieldName: 'Trace Sequence Number (file)', description: '道序号（文件内）', type: 'int32' },
    { position: 9, fieldName: 'Original Field Record Number', description: '原始野外记录号', type: 'int32' },
    { position: 13, fieldName: 'Trace Number (record)', description: '记录内道号', type: 'int32' },
    { position: 17, fieldName: 'Energy Source Point Number', description: '震源点号', type: 'int32' },
    { position: 21, fieldName: 'CDP Ensemble Number', description: 'CDP 点号', type: 'int32' },
    { position: 25, fieldName: 'Trace Number (CDP Ensemble)', description: 'CDP 内道号', type: 'int32' },
    { position: 29, fieldName: 'Trace Identification Code', description: '道识别码', type: 'int16' },
    { position: 31, fieldName: 'Number of Vertically Summed Traces', description: '垂直叠加道数', type: 'int16' },
    { position: 33, fieldName: 'Number of Horizontally Stacked Traces', description: '水平叠加道数', type: 'int16' },
    { position: 35, fieldName: 'Data Use', description: '数据用途', type: 'int16' },
    { position: 37, fieldName: 'Distance from Center of Source', description: '距震源中心距离', type: 'int32' },
    { position: 41, fieldName: 'Receiver Group Elevation', description: '接收点高程', type: 'int32' },
    { position: 45, fieldName: 'Source Surface Elevation', description: '震源地表高程', type: 'int32' },
    { position: 49, fieldName: 'Source Depth', description: '震源深度', type: 'int32' },
    { position: 53, fieldName: 'Receiver Datum Elevation', description: '接收点基准面高程', type: 'int32' },
    { position: 57, fieldName: 'Source Datum Elevation', description: '震源基准面高程', type: 'int32' },
    { position: 61, fieldName: 'Source Water Depth', description: '震源水深', type: 'int32' },
    { position: 65, fieldName: 'Group Water Depth', description: '接收点水深', type: 'int32' },
    { position: 69, fieldName: 'Scalar for Elevations', description: '高程标量', type: 'int16' },
    { position: 71, fieldName: 'Scalar for Coordinates', description: '坐标标量', type: 'int16' },
    { position: 73, fieldName: 'Source X Coordinate', description: '震源 X 坐标', type: 'int32' },
    { position: 77, fieldName: 'Source Y Coordinate', description: '震源 Y 坐标', type: 'int32' },
    { position: 81, fieldName: 'Group X Coordinate', description: '接收点 X 坐标', type: 'int32' },
    { position: 85, fieldName: 'Group Y Coordinate', description: '接收点 Y 坐标', type: 'int32' },
    { position: 89, fieldName: 'Coordinate Units', description: '坐标单位', type: 'int16' },
    { position: 91, fieldName: 'Weathering Velocity', description: '低降速带速度', type: 'int16' },
    { position: 93, fieldName: 'Subweathering Velocity', description: '稳定层速度', type: 'int16' },
    { position: 95, fieldName: 'Source Uphole Time', description: '震源井口时间', type: 'int16' },
    { position: 97, fieldName: 'Group Uphole Time', description: '接收点井口时间', type: 'int16' },
    { position: 99, fieldName: 'Source Static Correction', description: '震源静校正', type: 'int16' },
    { position: 101, fieldName: 'Group Static Correction', description: '接收点静校正', type: 'int16' },
    { position: 103, fieldName: 'Total Static Applied', description: '总静校正量', type: 'int16' },
    { position: 105, fieldName: 'Static Lag A', description: '静校正延迟 A', type: 'int16' },
    { position: 107, fieldName: 'Static Lag B', description: '静校正延迟 B', type: 'int16' },
    { position: 109, fieldName: 'Year Recorded', description: '记录年份', type: 'int16' },
    { position: 111, fieldName: 'Day of Year', description: '年内日序', type: 'int16' },
    { position: 113, fieldName: 'Hour of Day', description: '时', type: 'int16' },
    { position: 115, fieldName: 'Minute of Hour', description: '分', type: 'int16' },
    { position: 117, fieldName: 'Second of Minute', description: '秒', type: 'int16' },
    { position: 119, fieldName: 'Time Basis Code', description: '时间基准码', type: 'int16' },
    { position: 121, fieldName: 'Trace Weighting Factor', description: '道加权因子', type: 'int16' },
    { position: 123, fieldName: 'Number of Groups', description: '检波点数', type: 'int16' },
    { position: 125, fieldName: 'Number of Samples Per Trace', description: '每道采样数', type: 'int16' },
    { position: 127, fieldName: 'Sample Interval (us)', description: '采样间隔（微秒）', type: 'int16' },
    { position: 129, fieldName: 'Gain Type', description: '增益类型', type: 'int16' },
    { position: 131, fieldName: 'Instrument Gain Constant', description: '仪器增益常数', type: 'int16' },
    { position: 133, fieldName: 'Instrument Initial Gain', description: '仪器初始增益', type: 'int16' },
    { position: 135, fieldName: 'Correlated', description: '相关标志', type: 'int16' },
    { position: 137, fieldName: 'Sweep Frequency Start', description: '扫描起始频率', type: 'int16' },
    { position: 139, fieldName: 'Sweep Frequency End', description: '扫描终止频率', type: 'int16' },
    { position: 141, fieldName: 'Sweep Length', description: '扫描长度', type: 'int16' },
    { position: 143, fieldName: 'Sweep Type', description: '扫描类型', type: 'int16' },
    { position: 145, fieldName: 'Sweep Channel Taper Start', description: '扫描道斜坡起点', type: 'int16' },
    { position: 147, fieldName: 'Sweep Channel Taper End', description: '扫描道斜坡终点', type: 'int16' },
    { position: 149, fieldName: 'Taper Type', description: '斜坡类型', type: 'int16' },
    { position: 151, fieldName: 'Alias Filter Frequency', description: '假频滤波频率', type: 'int16' },
    { position: 153, fieldName: 'Alias Filter Slope', description: '假频滤波斜率', type: 'int16' },
    { position: 155, fieldName: 'Low Cut Frequency', description: '低截频', type: 'int16' },
    { position: 157, fieldName: 'High Cut Frequency', description: '高截频', type: 'int16' },
    { position: 159, fieldName: 'Low Cut Slope', description: '低截斜率', type: 'int16' },
    { position: 161, fieldName: 'High Cut Slope', description: '高截斜率', type: 'int16' },
    { position: 163, fieldName: 'Year Data Recorded', description: '数据记录年份', type: 'int16' },
    { position: 165, fieldName: 'Day of Year', description: '年内日序', type: 'int16' },
    { position: 167, fieldName: 'Hour of Day', description: '时', type: 'int16' },
    { position: 169, fieldName: 'Minute of Hour', description: '分', type: 'int16' },
    { position: 171, fieldName: 'Second of Minute', description: '秒', type: 'int16' },
    { position: 173, fieldName: 'Time Basis Code', description: '时间基准码', type: 'int16' },
    { position: 175, fieldName: 'Time Zero of Trace', description: '道时间零点', type: 'int32' },
    { position: 179, fieldName: 'Min Time of Waveform (enc)', description: '最小振幅时间', type: 'int32' },
    { position: 183, fieldName: 'Max Time of Waveform (enc)', description: '最大振幅时间', type: 'int32' },
    { position: 187, fieldName: 'Number of Samples Per Trace', description: '每道采样数', type: 'int16' },
    { position: 189, fieldName: 'Inline Number', description: 'Inline 号（3D）', type: 'int32' },
    { position: 193, fieldName: 'Crossline Number', description: 'Crossline 号（3D）', type: 'int32' },
    { position: 197, fieldName: 'Shotpoint Number', description: '炮点号', type: 'int32' },
    { position: 201, fieldName: 'Scalar for Shotpoint', description: '炮点标量', type: 'int16' },
    { position: 203, fieldName: 'Trace Value Unit', description: '采样值单位', type: 'int16' },
    { position: 205, fieldName: 'Transduction Constant', description: '转换常数', type: 'int32' },
    { position: 209, fieldName: 'Transduction Units', description: '转换单位', type: 'int16' },
    { position: 211, fieldName: 'Device/Trace Identifier', description: '设备/道识别符', type: 'int16' },
    { position: 213, fieldName: 'Scalar for Source X/Y', description: '震源坐标标量', type: 'int16' },
    { position: 215, fieldName: 'Scalar for Group X/Y', description: '接收点坐标标量', type: 'int16' },
    { position: 217, fieldName: 'Source Direction (deg)', description: '震源方向（度）', type: 'int16' },
    { position: 219, fieldName: 'Source Direction (min)', description: '震源方向（分）', type: 'int16' },
    { position: 221, fieldName: 'Source Direction (sec)', description: '震源方向（秒）', type: 'int16' },
    { position: 223, fieldName: 'Source Measurement', description: '震源测量', type: 'int16' },
    { position: 225, fieldName: 'Source Unit', description: '震源单位', type: 'int16' },
    { position: 227, fieldName: 'Source Type/Quality', description: '震源类型/质量', type: 'int16' },
    { position: 229, fieldName: 'Source Energy', description: '震源能量', type: 'int16' },
    { position: 231, fieldName: 'Source Direction (vertical)', description: '震源垂直方向', type: 'int16' },
    { position: 233, fieldName: 'Source Direction (horizontal)', description: '震源水平方向', type: 'int16' },
    { position: 235, fieldName: 'Source Measurement Method', description: '震源测量方法', type: 'int16' },
    { position: 237, fieldName: 'Zero Offset Correction', description: '零偏移距校正', type: 'int16' },
    { position: 239, fieldName: 'Zero Offset Phase', description: '零偏移距相位', type: 'int16' },
    { position: 241, fieldName: 'Number of Bytes in Header', description: '道头字节数', type: 'int16' },
  ];

  return traceHeaderFields.filter(
    (f) => f.position >= bytePosition - 4 && f.position <= bytePosition + 12
  );
}

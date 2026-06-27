import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  Info,
  Eye,
  Settings,
  Search,
  FileCode,
  Layers,
} from 'lucide-react';
import Modal from './Modal';
import { cn } from '../../lib/utils';
import { SegyImportOptions } from '../../../shared/types';
import {
  SEGY_BYTE_PRESETS,
  findBytePositionInfo,
  ebcdicToAscii as ebcdicToAsciiUtil,
  formatSegyTextHeader,
  detectEbcdic,
} from '../../utils/segyUtils';
import { useSeismicStore } from '../../store/seismicStore';

interface SegyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (file: File, options: SegyImportOptions) => Promise<void>;
}

type StepId = 'upload' | 'preview' | 'header' | 'options' | 'importing' | 'done';

type TraceHeaderMap = Record<number, number> & { __offset?: number };

type ParseResult = {
  score?: number;
  textHeaderLines: string[];
  isEbcdic: boolean;
  sampleCount: number;
  sampleInterval: number;
  sampleIntervalMs: number;
  dataFormatCode: number;
  traceSize: number;
  dataStart: number;
  bytesPerSample: number;
  traceHeaderSize?: number;
  numExtTextHeaders: number;
  segyRevision: string;
  byteOrder: 'big-endian' | 'little-endian';
  estimatedTraces?: number;
  totalTraces: number;
  inlineCount: number;
  crosslineCount: number;
  inlineArrLen: number;
  crosslineArrLen: number;
  timeRange?: [number, number];
  timeStartMs: number;
  timeEndMs: number;
  inlineRange: [number, number];
  crosslineRange: [number, number];
  firstTraceHeader: TraceHeaderMap | null;
  jobId?: number;
  lineNumber?: number;
  reelNumber?: number;
  fixedLengthTraceFlag?: number;
  detectedInlineByte?: number;
  detectedCrosslineByte?: number;
};

export default function SegyImportModal({
  isOpen,
  onClose,
  onImport,
}: SegyImportModalProps) {
  const [step, setStep] = useState<StepId>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTextHeader, setShowTextHeader] = useState(false);
  const [textHeaderLines, setTextHeaderLines] = useState<string[]>([]);
  const [textHeaderEncoding, setTextHeaderEncoding] = useState<'ebcdic' | 'ascii'>('ebcdic');
  const [traceIndex, setTraceIndex] = useState(0);
  const [traceHeaderData, setTraceHeaderData] = useState<Record<number, number>>({});
  const [searchByte, setSearchByte] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadProgress, isLoading } = useSeismicStore();

  useEffect(() => {
    if (step === 'importing' && loadProgress) {
      setImportProgress(loadProgress.percentage);
      setImportStage(loadProgress.currentStage);
    }
  }, [step, loadProgress]);

  const [options, setOptions] = useState<SegyImportOptions>({
    datasetName: '',
    byteOrder: 'big-endian',
    dataFormat: 5,
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 117,
    preset: '标准 SEGY (Rev 1)',
  });

  const inlineByteInfo = useMemo(
    () => findBytePositionInfo(options.inlineByte),
    [options.inlineByte]
  );

  const crosslineByteInfo = useMemo(
    () => findBytePositionInfo(options.crosslineByte),
    [options.crosslineByte]
  );

  const filteredBytePositions = useMemo(() => {
    if (!searchByte) return [];
    const byte = parseInt(searchByte);
    if (isNaN(byte)) return [];
    return findBytePositionInfo(byte);
  }, [searchByte]);

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setParsedData(null);
    setError(null);
    setImportProgress(0);
    setShowTextHeader(false);
    setTextHeaderLines([]);
    setTraceHeaderData({});
    setTraceIndex(0);
    setOptions({
      datasetName: '',
      byteOrder: 'big-endian',
      dataFormat: 5,
      inlineByte: 189,
      crosslineByte: 193,
      sampleIntervalByte: 117,
      preset: '标准 SEGY (Rev 1)',
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setOptions((prev) => ({
      ...prev,
      datasetName: file.name.replace('.segy', '').replace('.sgy', ''),
    }));
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.segy') || file.name.endsWith('.sgy'))) {
      handleFileSelect(file);
    } else {
      setError('请选择 .segy 或 .sgy 格式的文件');
    }
  };

  const parseFile = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    setError(null);

    try {
      const parseWithByteOrder = (byteOrder: 'big-endian' | 'little-endian'): ParseResult => {
        const bigEndian = byteOrder === 'big-endian';
        const textHeaderBuffer = uint8Array.subarray(0, 3200);
        const isEbcdic = detectEbcdic(textHeaderBuffer);
        const textHeaderStr = isEbcdic
          ? ebcdicToAsciiUtil(textHeaderBuffer)
          : new TextDecoder('ascii').decode(textHeaderBuffer);
        const lines = formatSegyTextHeader(textHeaderStr, 80);

        const view = new DataView(buffer);
        const bhOffset = 3200;
        
        const sampleIntervalRaw = view.getUint16(bhOffset + 16, bigEndian);
        const samplesPerTraceRaw = view.getUint16(bhOffset + 20, bigEndian);
        const dataFormatCodeRaw = view.getUint16(bhOffset + 24, bigEndian);
        const segyRevMajor = view.getUint8(bhOffset + 300);
        const segyRevMinor = view.getUint8(bhOffset + 301);
        const numExtTextHeaders = view.getInt16(bhOffset + 304, bigEndian);

        let sampleCount = samplesPerTraceRaw || 0;
        let sampleInterval = sampleIntervalRaw || 0;
        let dataFormatCode = dataFormatCodeRaw || 0;

        const traceHeaderSize = 240;
        let bytesPerSample = 4;
        if (dataFormatCode === 1 || dataFormatCode === 2 || dataFormatCode === 5) {
          bytesPerSample = 4;
        } else if (dataFormatCode === 3) {
          bytesPerSample = 2;
        } else if (dataFormatCode === 8) {
          bytesPerSample = 1;
        } else {
          bytesPerSample = 4;
          if (dataFormatCode === 0 || dataFormatCode > 8) {
            dataFormatCode = 5;
          }
        }

        const extHeaders = Math.max(0, numExtTextHeaders);
        const dataStart = 3600 + extHeaders * 3200;

        if (sampleCount <= 0 || sampleCount > 100000) {
          sampleCount = 1000;
        }
        if (sampleInterval <= 0 || sampleInterval > 100000) {
          sampleInterval = 4000;
        }

        const traceSize = traceHeaderSize + sampleCount * bytesPerSample;
        const totalTraces = Math.floor((selectedFile.size - dataStart) / traceSize);

        const maxSampleTraces = Math.min(2000, totalTraces);
        const sampleBufferSize = Math.min(
          selectedFile.size,
          dataStart + maxSampleTraces * traceSize
        );

        const candidatePositions = [
          { il: 9, xl: 21, name: 'G&G / ProMAX' },
          { il: 5, xl: 21, name: 'ProMAX' },
          { il: 189, xl: 193, name: 'SEGY Rev 1' },
          { il: 73, xl: 77, name: '坐标' },
          { il: 21, xl: 25, name: 'Ensemble' },
        ];

        let bestIlPos = 189;
        let bestXlPos = 193;
        let bestInlineCount = 1;
        let bestCrosslineCount = 1;
        let bestInlineRange: [number, number] = [1, 1];
        let bestCrosslineRange: [number, number] = [1, 1];
        let bestInlineArrLen = 0;
        let bestCrosslineArrLen = 0;
        let bestDetectScore = -1;
        let bestFirstTrace: TraceHeaderMap | null = null;

        const readTraceHeaderAt = (idx: number, ilPos: number, xlPos: number) => {
          const traceOffset = dataStart + idx * traceSize;
          if (traceOffset + traceHeaderSize > buffer.byteLength) return null;
          const il = view.getInt32(traceOffset + ilPos - 1, bigEndian);
          const xl = view.getInt32(traceOffset + xlPos - 1, bigEndian);
          const delay = view.getInt16(traceOffset + 108, bigEndian);
          return { il, xl, delay, offset: traceOffset };
        };

        for (const cand of candidatePositions) {
          const inlineSet = new Set<number>();
          const crosslineSet = new Set<number>();
          let firstTraceForCand: any = null;
          const sampleTraces = Math.min(
            maxSampleTraces,
            Math.floor((Math.min(buffer.byteLength, sampleBufferSize) - dataStart) / traceSize)
          );

          for (let i = 0; i < sampleTraces; i++) {
            const th = readTraceHeaderAt(i, cand.il, cand.xl);
            if (th) {
              if (!firstTraceForCand) firstTraceForCand = th;
              const il = th.il;
              const xl = th.xl;
              if (isFinite(il) && il > 0 && il < 100000000) inlineSet.add(il);
              if (isFinite(xl) && xl > 0 && xl < 100000000) crosslineSet.add(xl);
            }
          }

          const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
          const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

          let detectScore = 0;
          let inlineCount = 1;
          let crosslineCount = 1;
          let inlineRange: [number, number] = [1, 1];
          let crosslineRange: [number, number] = [1, 1];

          if (inlineArr.length > 1) {
            detectScore += 10;
            const minIl = inlineArr[0];
            const maxIl = inlineArr[inlineArr.length - 1];
            const steps: number[] = [];
            for (let i = 1; i < inlineArr.length; i++) {
              const diff = inlineArr[i] - inlineArr[i - 1];
              if (diff > 0) steps.push(diff);
            }
            const stepIl = steps.length > 0 ? Math.min(...steps) : 1;
            if (stepIl > 0 && stepIl < 1000) detectScore += 10;
            inlineCount = Math.floor((maxIl - minIl) / stepIl) + 1;
            inlineRange = [minIl, maxIl];
          }
          if (crosslineArr.length > 1) {
            detectScore += 10;
            const minXl = crosslineArr[0];
            const maxXl = crosslineArr[crosslineArr.length - 1];
            const steps: number[] = [];
            for (let i = 1; i < crosslineArr.length; i++) {
              const diff = crosslineArr[i] - crosslineArr[i - 1];
              if (diff > 0) steps.push(diff);
            }
            const stepXl = steps.length > 0 ? Math.min(...steps) : 1;
            if (stepXl > 0 && stepXl < 1000) detectScore += 10;
            crosslineCount = Math.floor((maxXl - minXl) / stepXl) + 1;
            crosslineRange = [minXl, maxXl];
          }

          if (inlineArr.length > 5) detectScore += 5;
          if (crosslineArr.length > 5) detectScore += 5;

          if (totalTraces > 0) {
            const ratio = (inlineCount * crosslineCount) / totalTraces;
            if (ratio > 0.3 && ratio < 3) detectScore += 20;
            else if (ratio > 0.1 && ratio < 10) detectScore += 8;
          }

          if (inlineArr.length > 20 && crosslineArr.length > 20) detectScore += 10;

          if (cand.il === 9 && cand.xl === 21) detectScore += 3;

          if (detectScore > bestDetectScore) {
            bestDetectScore = detectScore;
            bestIlPos = cand.il;
            bestXlPos = cand.xl;
            bestInlineCount = inlineCount;
            bestCrosslineCount = crosslineCount;
            bestInlineRange = inlineRange;
            bestCrosslineRange = crosslineRange;
            bestInlineArrLen = inlineArr.length;
            bestCrosslineArrLen = crosslineArr.length;
            bestFirstTrace = firstTraceForCand;
          }
        }

        const readFirstTraceFull = (): TraceHeaderMap | null => {
          const traceOffset = dataStart;
          if (traceOffset + traceHeaderSize > buffer.byteLength) return null;
          const headerInt32: TraceHeaderMap = {};
          for (let bytePos = 1; bytePos <= 240 - 3; bytePos += 4) {
            headerInt32[bytePos] = view.getInt32(traceOffset + bytePos - 1, bigEndian);
          }
          headerInt32.__offset = traceOffset;
          return headerInt32;
        };

        const firstTrace = readFirstTraceFull();

        let timeStartMs = 0;
        let delaySum = 0;
        let delayCount = 0;
        const sampleTracesForDelay = Math.min(100, Math.floor((buffer.byteLength - dataStart) / traceSize));
        for (let i = 0; i < sampleTracesForDelay; i++) {
          const traceOffset = dataStart + i * traceSize;
          if (traceOffset + 240 > buffer.byteLength) break;
          const delay = view.getInt16(traceOffset + 108, bigEndian);
          if (delay >= 0 && delay < 60000) {
            delaySum += delay;
            delayCount++;
          }
        }
        if (delayCount > 0) {
          const avgDelay = Math.round(delaySum / delayCount);
          timeStartMs = (avgDelay * sampleInterval) / 1000;
        } else {
          timeStartMs = 0;
        }

        const timeEndMs = timeStartMs + ((sampleCount - 1) * sampleInterval) / 1000;

        return {
          byteOrder,
          isEbcdic,
          textHeaderLines: lines,
          sampleCount,
          sampleInterval,
          sampleIntervalMs: sampleInterval / 1000,
          dataFormatCode,
          bytesPerSample,
          dataStart,
          traceSize,
          totalTraces,
          segyRevision: segyRevMajor > 0 ? `${segyRevMajor}.${segyRevMinor}` : 'Rev 0',
          firstTraceHeader: firstTrace,
          inlineCount: bestInlineCount,
          crosslineCount: bestCrosslineCount,
          inlineRange: bestInlineRange,
          crosslineRange: bestCrosslineRange,
          inlineArrLen: bestInlineArrLen,
          crosslineArrLen: bestCrosslineArrLen,
          timeStartMs,
          timeEndMs,
          numExtTextHeaders: extHeaders,
          detectedInlineByte: bestIlPos,
          detectedCrosslineByte: bestXlPos,
        };
      };

      const previewSize = Math.min(
        selectedFile.size,
        3600 + 5 * 1024 * 1024
      );
      const buffer = await selectedFile.slice(0, previewSize).arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      const resultBE = parseWithByteOrder('big-endian');
      const resultLE = parseWithByteOrder('little-endian');

      let scoreBE = 0;
      let scoreLE = 0;

      const calcByteOrderScore = (r: ParseResult) => {
        let s = 0;
        if (r.dataFormatCode >= 1 && r.dataFormatCode <= 8) s += 10;
        if (r.dataFormatCode === 1) s += 15;
        if (r.sampleCount >= 100 && r.sampleCount <= 50000) s += 10;
        if (r.sampleInterval >= 100 && r.sampleInterval <= 10000) s += 5;
        if (r.numExtTextHeaders >= 0 && r.numExtTextHeaders <= 10) s += 3;
        if (r.inlineArrLen > 5) s += 5;
        if (r.crosslineArrLen > 5) s += 5;
        if (r.inlineArrLen > 50) s += 10;
        if (r.crosslineArrLen > 50) s += 10;
        if (r.totalTraces > 100) s += 5;
        if (r.totalTraces > 0) {
          const ratio = (r.inlineCount * r.crosslineCount) / r.totalTraces;
          if (ratio > 0.5 && ratio < 2) s += 25;
          else if (ratio > 0.2 && ratio < 5) s += 10;
          else if (ratio > 0.1 && ratio < 10) s += 3;
        }
        return s;
      };

      scoreBE = calcByteOrderScore(resultBE);
      scoreLE = calcByteOrderScore(resultLE);

      if (resultBE.dataFormatCode === 1) scoreBE += 20;

      const result = scoreBE >= scoreLE ? resultBE : resultLE;
      const detectedByteOrder = scoreBE >= scoreLE ? 'big-endian' : 'little-endian';

      setOptions((prev) => ({
        ...prev,
        byteOrder: detectedByteOrder,
        dataFormat: result.dataFormatCode,
        inlineByte: result.detectedInlineByte || 189,
        crosslineByte: result.detectedCrosslineByte || 193,
      }));

      setTextHeaderLines(result.textHeaderLines);
      setTextHeaderEncoding(result.isEbcdic ? 'ebcdic' : 'ascii');

      if (result.firstTraceHeader) {
        const { __offset, ...firstTraceInt32 } = result.firstTraceHeader;
        setTraceHeaderData(firstTraceInt32);
      }

      const formatNames: Record<number, string> = {
        1: 'IBM 浮点 (4 字节)',
        2: '32位定点整数',
        3: '16位定点整数',
        4: '固定增益 (4 字节)',
        5: 'IEEE 浮点 (4 字节)',
        6: '8位整型',
        7: '增益范围',
        8: '8位整型 (unsigned)',
      };

      setParsedData({
        fileName: selectedFile.name,
        fileSize: (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB',
        sampleCount: result.sampleCount,
        sampleInterval: result.sampleIntervalMs,
        dataFormatCode: result.dataFormatCode,
        bytesPerSample: result.bytesPerSample,
        dataFormatName: formatNames[result.dataFormatCode] || `格式 ${result.dataFormatCode}`,
        segyRevision: result.segyRevision,
        inlineCount: result.inlineCount,
        crosslineCount: result.crosslineCount,
        timeRange: [result.timeStartMs, result.timeEndMs],
        byteOrder: result.byteOrder,
        byteOrderDetected: scoreBE !== scoreLE,
        estimatedTraces: result.totalTraces,
        inlineRange: result.inlineRange,
        crosslineRange: result.crosslineRange,
        textHeaderEncoding: result.isEbcdic ? 'ebcdic' : 'ascii',
        numExtTextHeaders: result.numExtTextHeaders,
        dataStart: result.dataStart,
        traceSize: result.traceSize,
      });

      setStep('preview');
    } catch (err) {
      setError('文件解析失败，请检查文件格式');
      console.error('Parse error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const handlePresetChange = (presetName: string) => {
    const preset = SEGY_BYTE_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setOptions((prev) => ({
        ...prev,
        preset: presetName,
        inlineByte: preset.inlineByte,
        crosslineByte: preset.crosslineByte,
        sampleIntervalByte: preset.sampleIntervalByte,
      }));
    }
  };

  const autoDetectBytePositions = async () => {
    if (!selectedFile || !parsedData) return;

    setIsParsing(true);
    try {
      const dataFormatCode = parsedData.dataFormatCode || options.dataFormat || 5;
      const sampleCount = parsedData.sampleCount || 1000;
      const numExtHeaders = parsedData.numExtTextHeaders || 0;
      const sampleIntervalRaw = parsedData.sampleInterval * 1000 || 4000;
      
      let bytesPerSample = 4;
      if (dataFormatCode === 1 || dataFormatCode === 2 || dataFormatCode === 5) bytesPerSample = 4;
      else if (dataFormatCode === 3) bytesPerSample = 2;
      else if (dataFormatCode === 8) bytesPerSample = 1;

      const dataStart = 3600 + numExtHeaders * 3200;
      const traceSize = 240 + sampleCount * bytesPerSample;
      const previewTraces = 2000;
      const bufferSize = Math.min(selectedFile.size, dataStart + previewTraces * traceSize);
      const buffer = await selectedFile.slice(0, bufferSize).arrayBuffer();
      const view = new DataView(buffer);

      const candidatePositions = [
        { il: 9, xl: 21, name: 'G&G / ProMAX' },
        { il: 5, xl: 21, name: 'ProMAX' },
        { il: 189, xl: 193, name: '标准 SEGY (Rev 1)' },
        { il: 73, xl: 77, name: '坐标位置' },
        { il: 21, xl: 25, name: 'Ensemble 位置' },
      ];

      let bestScore = -1;
      let bestCandidate = candidatePositions[0];
      let bestInlineRange: [number, number] = [1, 1];
      let bestCrosslineRange: [number, number] = [1, 1];
      let bestInlineCount = 1;
      let bestCrosslineCount = 1;
      let bestByteOrder: 'big-endian' | 'little-endian' = 'big-endian';
      let bestTimeStart = 0;

      for (const useBE of [true, false]) {
        for (const candidate of candidatePositions) {
          const inlineSet = new Set<number>();
          const crosslineSet = new Set<number>();
          let delaySum = 0;
          let delayCount = 0;
          const sampleTraces = Math.min(previewTraces, Math.floor((buffer.byteLength - dataStart) / traceSize));

          for (let i = 0; i < sampleTraces; i++) {
            const traceOffset = dataStart + i * traceSize;
            if (traceOffset + 240 > buffer.byteLength) break;
            
            const il = view.getInt32(traceOffset + candidate.il - 1, useBE);
            const xl = view.getInt32(traceOffset + candidate.xl - 1, useBE);
            const delay = view.getInt16(traceOffset + 108, useBE);
            
            if (isFinite(il) && il > 0 && il < 100000000) inlineSet.add(il);
            if (isFinite(xl) && xl > 0 && xl < 100000000) crosslineSet.add(xl);
            if (delay >= 0 && delay < 60000) { delaySum += delay; delayCount++; }
          }

          const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
          const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

          let score = 0;
          let inlineCount = 1;
          let crosslineCount = 1;
          let inlineRange: [number, number] = [1, 1];
          let crosslineRange: [number, number] = [1, 1];

          if (inlineArr.length > 1) {
            score += 10;
            const minIl = inlineArr[0], maxIl = inlineArr[inlineArr.length - 1];
            const steps: number[] = [];
            for (let i = 1; i < inlineArr.length; i++) {
              const diff = inlineArr[i] - inlineArr[i - 1];
              if (diff > 0) steps.push(diff);
            }
            const stepIl = steps.length > 0 ? Math.min(...steps) : 1;
            if (stepIl > 0 && stepIl < 1000) score += 10;
            inlineCount = Math.floor((maxIl - minIl) / stepIl) + 1;
            inlineRange = [minIl, maxIl];
          }
          if (crosslineArr.length > 1) {
            score += 10;
            const minXl = crosslineArr[0], maxXl = crosslineArr[crosslineArr.length - 1];
            const steps: number[] = [];
            for (let i = 1; i < crosslineArr.length; i++) {
              const diff = crosslineArr[i] - crosslineArr[i - 1];
              if (diff > 0) steps.push(diff);
            }
            const stepXl = steps.length > 0 ? Math.min(...steps) : 1;
            if (stepXl > 0 && stepXl < 1000) score += 10;
            crosslineCount = Math.floor((maxXl - minXl) / stepXl) + 1;
            crosslineRange = [minXl, maxXl];
          }

          if (inlineArr.length > 5) score += 5;
          if (crosslineArr.length > 5) score += 5;
          if (inlineArr.length > 50) score += 10;
          if (crosslineArr.length > 50) score += 10;

          if (candidate.il === 9 && candidate.xl === 21) score += 3;
          if (useBE && dataFormatCode === 1) score += 10;

          const totalTraces = parsedData.estimatedTraces || sampleTraces;
          if (totalTraces > 0) {
            const ratio = (inlineCount * crosslineCount) / totalTraces;
            if (ratio > 0.5 && ratio < 2) score += 25;
            else if (ratio > 0.3 && ratio < 3) score += 15;
            else if (ratio > 0.1 && ratio < 10) score += 5;
          }

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = candidate;
            bestInlineCount = inlineCount;
            bestCrosslineCount = crosslineCount;
            bestInlineRange = inlineRange;
            bestCrosslineRange = crosslineRange;
            bestByteOrder = useBE ? 'big-endian' : 'little-endian';
            if (delayCount > 0) {
              const avgDelay = Math.round(delaySum / delayCount);
              bestTimeStart = (avgDelay * sampleIntervalRaw) / 1000;
            }
          }
        }
      }

      const timeEndMs = bestTimeStart + ((sampleCount - 1) * sampleIntervalRaw) / 1000;

      setOptions(prev => ({
        ...prev,
        inlineByte: bestCandidate.il,
        crosslineByte: bestCandidate.xl,
        byteOrder: bestByteOrder,
        preset: bestCandidate.name,
      }));

      setParsedData((prev: any) => ({
        ...prev,
        inlineCount: bestInlineCount,
        crosslineCount: bestCrosslineCount,
        inlineRange: bestInlineRange,
        crosslineRange: bestCrosslineRange,
        timeRange: [bestTimeStart, timeEndMs],
        byteOrder: bestByteOrder,
      }));

      await reparseWithNewBytes(bestByteOrder);
    } catch (err) {
      console.error('Auto-detect error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const reparseWithNewBytes = async (overrideByteOrder?: 'big-endian' | 'little-endian') => {
    if (!selectedFile) return;

    setIsParsing(true);
    try {
      const byteOrder = overrideByteOrder || options.byteOrder;
      const bigEndian = byteOrder === 'big-endian';

      const previewSize = Math.min(selectedFile.size, 3600 + 5 * 1024 * 1024);
      const buffer = await selectedFile.slice(0, previewSize).arrayBuffer();
      const view = new DataView(buffer);

      const bhOffset = 3200;
      const sampleIntervalRaw = view.getUint16(bhOffset + 16, bigEndian);
      const samplesPerTraceRaw = view.getUint16(bhOffset + 20, bigEndian);
      const dataFormatCodeRaw = view.getUint16(bhOffset + 24, bigEndian);
      const numExtTextHeaders = view.getInt16(bhOffset + 304, bigEndian);

      let sampleCount = samplesPerTraceRaw || 1000;
      let sampleInterval = sampleIntervalRaw || 4000;
      let dataFormatCode = dataFormatCodeRaw || 5;

      if (sampleCount <= 0 || sampleCount > 100000) sampleCount = 1000;
      if (sampleInterval <= 0 || sampleInterval > 100000) sampleInterval = 4000;
      if (dataFormatCode === 0 || dataFormatCode > 8) dataFormatCode = 5;

      let bytesPerSample = 4;
      if (dataFormatCode === 3) bytesPerSample = 2;
      else if (dataFormatCode === 8) bytesPerSample = 1;

      const extHeaders = Math.max(0, numExtTextHeaders);
      const dataStart = 3600 + extHeaders * 3200;
      const traceSize = 240 + sampleCount * bytesPerSample;
      const previewTraces = 1000;

      const readTraceHeaderFull = (idx: number): TraceHeaderMap | null => {
        const traceOffset = dataStart + idx * traceSize;
        if (traceOffset + 240 > buffer.byteLength) return null;

        const headerInt32: TraceHeaderMap = {};
        for (let bytePos = 1; bytePos <= 240 - 3; bytePos += 4) {
          headerInt32[bytePos] = view.getInt32(traceOffset + bytePos - 1, bigEndian);
        }
        headerInt32.__offset = traceOffset;
        return headerInt32;
      };

      const getTraceInt32 = (
        th: TraceHeaderMap,
        bytePos: number
      ): number => {
        if (bytePos < 1 || bytePos > 240 - 3) return 0;
        const traceOffset = th.__offset;
        if (traceOffset === undefined) return 0;
        return view.getInt32(traceOffset + bytePos - 1, bigEndian);
      };

      const selectedTrace = readTraceHeaderFull(traceIndex);
      if (selectedTrace) {
        const { __offset, ...traceInt32 } = selectedTrace;
        setTraceHeaderData(traceInt32);
      }

      const inlineSet = new Set<number>();
      const crosslineSet = new Set<number>();
      let delaySum = 0;
      let delayCount = 0;
      const sampleTraces = Math.min(
        previewTraces,
        Math.floor((buffer.byteLength - dataStart) / traceSize)
      );

      const ilPos = options.inlineByte || 189;
      const xlPos = options.crosslineByte || 193;

      for (let i = 0; i < sampleTraces; i++) {
        const traceOffset = dataStart + i * traceSize;
        if (traceOffset + 240 > buffer.byteLength) break;

        const il = view.getInt32(traceOffset + ilPos - 1, bigEndian);
        const xl = view.getInt32(traceOffset + xlPos - 1, bigEndian);
        const delay = view.getInt16(traceOffset + 108, bigEndian);

        if (isFinite(il) && il > 0 && il < 100000000) inlineSet.add(il);
        if (isFinite(xl) && xl > 0 && xl < 100000000) crosslineSet.add(xl);
        if (delay >= 0 && delay < 60000) { delaySum += delay; delayCount++; }
      }

      const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
      const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

      let inlineCount: number;
      let crosslineCount: number;
      let inlineRange: [number, number];
      let crosslineRange: [number, number];
      const totalTraces = Math.floor((selectedFile.size - dataStart) / traceSize);

      if (inlineArr.length > 1) {
        const minIl = inlineArr[0];
        const maxIl = inlineArr[inlineArr.length - 1];
        const steps: number[] = [];
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
        const steps: number[] = [];
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

      let timeStartMs = 0;
      if (delayCount > 0) {
        const avgDelay = Math.round(delaySum / delayCount);
        if (avgDelay > 0 && avgDelay < 60000) {
          const siMs = sampleInterval / 1000;
          if (avgDelay * siMs < 60000) {
            timeStartMs = avgDelay * siMs;
          } else {
            timeStartMs = avgDelay;
          }
        }
      }
      const timeEndMs = timeStartMs + ((sampleCount - 1) * sampleInterval) / 1000;

      setParsedData((prev: any) => ({
        ...prev,
        inlineCount,
        crosslineCount,
        inlineRange,
        crosslineRange,
        timeRange: [timeStartMs, timeEndMs],
        sampleCount,
        sampleInterval: sampleInterval / 1000,
        dataFormatCode,
        byteOrder,
        estimatedTraces: totalTraces,
      }));
    } catch (err) {
      console.error('Reparse error:', err);
    } finally {
      setIsParsing(false);
    }
  };

  const startImport = async () => {
    setStep('importing');
    setImportProgress(0);
    setImportStage('准备导入...');
    setError(null);

    try {
      if (onImport && selectedFile) {
        await onImport(selectedFile, options);
      }
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
      setStep('options');
    }
  };

  const steps = [
    { id: 'upload', label: '选择文件', icon: Upload },
    { id: 'preview', label: '文件预览', icon: Eye },
    { id: 'header', label: '道头设置', icon: FileCode },
    { id: 'options', label: '导入设置', icon: Settings },
    { id: 'importing', label: '导入中', icon: Upload },
    { id: 'done', label: '完成', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const goToPrevStep = () => {
    const stepOrder: StepId[] = [
      'upload',
      'preview',
      'header',
      'options',
      'importing',
      'done',
    ];
    const idx = stepOrder.indexOf(step);
    if (idx > 0) {
      setStep(stepOrder[idx - 1]);
    }
  };

  const goToNextStep = () => {
    const stepOrder: StepId[] = [
      'upload',
      'preview',
      'header',
      'options',
      'importing',
      'done',
    ];
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 2) {
      setStep(stepOrder[idx + 1]);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="导入 SEGY 数据"
      width="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400">
            {step !== 'upload' && step !== 'done' && step !== 'importing' && (
              <button
                className="text-blue-400 hover:text-blue-300"
                onClick={goToPrevStep}
              >
                ← 上一步
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              onClick={handleClose}
            >
              取消
            </button>
            {step === 'upload' && selectedFile && (
              <button
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                onClick={parseFile}
                disabled={isParsing}
              >
                {isParsing ? '解析中...' : '下一步 →'}
              </button>
            )}
            {(step === 'preview' || step === 'header') && (
              <button
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                onClick={goToNextStep}
              >
                下一步 →
              </button>
            )}
            {step === 'options' && (
              <button
                className="px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-500 rounded transition-colors"
                onClick={startImport}
              >
                开始导入
              </button>
            )}
            {step === 'done' && (
              <button
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                onClick={handleClose}
              >
                完成
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                  i <= currentStepIndex ? 'text-blue-400' : 'text-slate-500'
                )}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              {i < steps.length - 2 && (
                <ChevronRight
                  className={cn(
                    'w-4 h-4 mx-1',
                    i < currentStepIndex ? 'text-blue-500' : 'text-slate-600'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {step === 'upload' && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".segy,.sgy"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {selectedFile ? (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200 font-medium">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  className="text-xs text-blue-400 hover:text-blue-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  重新选择
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-slate-700 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-200">拖拽 SEGY 文件到这里</p>
                  <p className="text-xs text-slate-400 mt-1">或点击选择文件</p>
                </div>
                <button
                  className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  选择文件
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center justify-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && parsedData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <InfoItem label="文件名" value={parsedData.fileName} />
              <InfoItem label="文件大小" value={parsedData.fileSize} />
              <InfoItem
                label="文件头编码"
                value={textHeaderEncoding === 'ebcdic' ? 'EBCDIC' : 'ASCII'}
              />
              <InfoItem label="采样点数" value={parsedData.sampleCount} />
              <InfoItem
                label="采样间隔"
                value={`${parsedData.sampleInterval} ms`}
              />
              <InfoItem label="数据格式" value={parsedData.dataFormatName} />
              <InfoItem label="字节序" value={parsedData.byteOrder} />
              <InfoItem label="Inline 数" value={parsedData.inlineCount} />
              <InfoItem label="Crossline 数" value={parsedData.crosslineCount} />
              <InfoItem
                label="时间范围"
                value={`0 - ${parsedData.timeRange[1]} ms`}
              />
              <InfoItem
                label="预估道数"
                value={parsedData.estimatedTraces?.toLocaleString()}
              />
              <InfoItem
                label="Inline 范围"
                value={`${parsedData.inlineRange[0]} - ${parsedData.inlineRange[1]}`}
              />
              <InfoItem
                label="Crossline 范围"
                value={`${parsedData.crosslineRange[0]} - ${parsedData.crosslineRange[1]}`}
              />
            </div>

            <button
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded hover:bg-blue-500/20 transition-colors"
              onClick={() => setShowTextHeader(!showTextHeader)}
            >
              <FileText className="w-3.5 h-3.5" />
              {showTextHeader ? '隐藏' : '查看'} EBCDIC 文本文件头（3200 字节）
            </button>

            {showTextHeader && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    文本文件头 ({textHeaderLines.length} 行 × 80 字符)
                  </span>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
                      {textHeaderEncoding.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto p-2 font-mono text-[11px] leading-relaxed">
                  {textHeaderLines.map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="text-slate-600 w-8 flex-shrink-0 text-right pr-2 select-none">
                        {idx + 1}
                      </span>
                      <span className="text-slate-300 whitespace-pre">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200">
                  <p className="font-medium mb-1">下一步：配置道头字节位置</p>
                  <p className="text-blue-300/70">
                    SEGY 格式没有统一的 Inline/Crossline 字节位置标准。
                    下一步您可以查看道头数据并配置正确的字节位置。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'header' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    软件预设
                  </label>
                  <select
                    value={options.preset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {SEGY_BYTE_PRESETS.map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Inline 字节位置
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="237"
                      value={options.inlineByte}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          inlineByte: parseInt(e.target.value) || 1,
                          preset: '自定义',
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Crossline 字节位置
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="237"
                      value={options.crosslineByte}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          crosslineByte: parseInt(e.target.value) || 1,
                          preset: '自定义',
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    字节序
                  </label>
                  <select
                    value={options.byteOrder}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        byteOrder: e.target.value as 'big-endian' | 'little-endian',
                      }))
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="big-endian">大端序 (Big Endian)</option>
                    <option value="little-endian">小端序 (Little Endian)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    onClick={autoDetectBytePositions}
                    disabled={isParsing}
                  >
                    <Search className="w-3 h-3" />
                    {isParsing ? '检测中...' : '自动检测'}
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                    onClick={() => reparseWithNewBytes()}
                    disabled={isParsing}
                  >
                    {isParsing ? '解析中...' : '应用并重新解析'}
                  </button>
                </div>

                <div className="p-2 bg-slate-700/50 rounded space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    当前设置解析结果
                  </p>
                  <p className="text-xs text-slate-300">
                    Inline:{' '}
                    <span className="font-mono text-blue-400">
                      {parsedData?.inlineRange?.[0]} -{' '}
                      {parsedData?.inlineRange?.[1]} ({parsedData?.inlineCount} 个)
                    </span>
                  </p>
                  <p className="text-xs text-slate-300">
                    Crossline:{' '}
                    <span className="font-mono text-green-400">
                      {parsedData?.crosslineRange?.[0]} -{' '}
                      {parsedData?.crosslineRange?.[1]} (
                      {parsedData?.crosslineCount} 个)
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400">
                    道头字节查看（第 {traceIndex + 1} 道）
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                      onClick={() => setTraceIndex(Math.max(0, traceIndex - 1))}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      value={traceIndex}
                      onChange={(e) => setTraceIndex(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-0.5 text-[10px] bg-slate-700 border border-slate-600 rounded text-center text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      className="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                      onClick={() => setTraceIndex(traceIndex + 1)}
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="搜索字节位置..."
                    value={searchByte}
                    onChange={(e) => setSearchByte(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded overflow-hidden max-h-80 overflow-auto">
                  <table className="w-full text-[10px] font-mono">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-slate-400">
                        <th className="px-2 py-1 text-left">字节</th>
                        <th className="px-2 py-1 text-left">字段名</th>
                        <th className="px-2 py-1 text-right">int32 值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(traceHeaderData)
                        .filter(([pos]) => {
                          if (!searchByte) return true;
                          const posNum = parseInt(pos);
                          const search = parseInt(searchByte);
                          return (
                            !isNaN(search) &&
                            posNum >= search - 4 &&
                            posNum <= search + 16
                          );
                        })
                        .slice(0, 60)
                        .map(([pos, value]) => {
                          const isInline = parseInt(pos) === options.inlineByte;
                          const isCrossline = parseInt(pos) === options.crosslineByte;
                          return (
                            <tr
                              key={pos}
                              className={cn(
                                'border-t border-slate-800',
                                isInline && 'bg-blue-500/20',
                                isCrossline && 'bg-green-500/20'
                              )}
                            >
                              <td className="px-2 py-0.5 text-slate-400">
                                {pos}
                              </td>
                              <td className="px-2 py-0.5 text-slate-300">
                                {findBytePositionInfo(parseInt(pos))[0]
                                  ?.fieldName || '—'}
                              </td>
                              <td
                                className={cn(
                                  'px-2 py-0.5 text-right',
                                  isInline && 'text-blue-400 font-semibold',
                                  isCrossline && 'text-green-400 font-semibold',
                                  !isInline && !isCrossline && 'text-slate-500'
                                )}
                              >
                                {value.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500/30 rounded" />
                    <span className="text-slate-400">Inline 位置</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500/30 rounded" />
                    <span className="text-slate-400">Crossline 位置</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <p className="font-medium mb-1">如何确定正确的字节位置？</p>
                  <ol className="text-amber-300/70 space-y-1 list-decimal list-inside">
                    <li>查看 EBCDIC 文件头，通常会标注数据处理软件和格式说明</li>
                    <li>在道头查看器中搜索合理范围的 Inline/Crossline 值</li>
                    <li>选择对应的数据处理软件预设（如 ProMAX、OpendTect 等）</li>
                    <li>点击「应用并重新解析」验证结果是否合理</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'options' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  数据集名称
                </label>
                <input
                  type="text"
                  value={options.datasetName}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      datasetName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  数据格式
                </label>
                <select
                  value={options.dataFormat}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      dataFormat: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>IBM 浮点 (4 字节)</option>
                  <option value={2}>32 位定点数</option>
                  <option value={3}>16 位定点数</option>
                  <option value={5}>IEEE 浮点 (4 字节)</option>
                  <option value={8}>8 位整型</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs font-medium text-blue-300 mb-2">
                  几何参数
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inline 数</span>
                    <span className="text-slate-200 font-mono">
                      {parsedData?.inlineCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Crossline 数</span>
                    <span className="text-slate-200 font-mono">
                      {parsedData?.crosslineCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">时间采样</span>
                    <span className="text-slate-200 font-mono">
                      {parsedData?.sampleCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">采样间隔</span>
                    <span className="text-slate-200 font-mono">
                      {parsedData?.sampleInterval} ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-xs font-medium text-green-300 mb-2">
                  道头字节配置
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inline 字节</span>
                    <span className="text-blue-400 font-mono">
                      {options.inlineByte}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Crossline 字节</span>
                    <span className="text-green-400 font-mono">
                      {options.crosslineByte}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">字节序</span>
                    <span className="text-slate-200 font-mono">
                      {options.byteOrder}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">数据格式</span>
                    <span className="text-slate-200 font-mono">
                      格式 {options.dataFormat}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <p className="font-medium mb-1">导入确认</p>
                  <p className="text-slate-400">
                    确认以上参数无误后，点击「开始导入」将数据加载到系统中。
                    导入后可在工作台中查看和分析数据。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>
              <p className="mt-4 text-sm text-slate-200">{importStage || '正在导入数据...'}</p>
              <p className="text-xs text-slate-400 mt-1">{selectedFile?.name}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>导入进度</span>
                <span>{Math.round(importProgress)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <p className="text-base text-slate-100 font-medium">导入成功</p>
              <p className="text-xs text-slate-400 mt-1">
                数据集 "{options.datasetName}" 已成功导入
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <p className="text-lg font-semibold text-blue-400">
                  {parsedData?.inlineCount}
                </p>
                <p className="text-[10px] text-slate-400">Inline</p>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <p className="text-lg font-semibold text-green-400">
                  {parsedData?.crosslineCount}
                </p>
                <p className="text-[10px] text-slate-400">Crossline</p>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <p className="text-lg font-semibold text-amber-400">
                  {parsedData?.sampleCount}
                </p>
                <p className="text-[10px] text-slate-400">时间采样</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 bg-slate-700/50 rounded">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs text-slate-200 mt-0.5 font-mono">{value}</p>
    </div>
  );
}

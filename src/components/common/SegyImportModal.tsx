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
      const previewSize = Math.min(selectedFile.size, 3600 + 200 * 1024);
      const buffer = await selectedFile.slice(0, previewSize).arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      const textHeaderBuffer = uint8Array.subarray(0, 3200);
      const isEbcdic = detectEbcdic(textHeaderBuffer);
      const textHeaderStr = isEbcdic
        ? ebcdicToAsciiUtil(textHeaderBuffer)
        : new TextDecoder('ascii').decode(textHeaderBuffer);
      const lines = formatSegyTextHeader(textHeaderStr, 80);

      setTextHeaderLines(lines);
      setTextHeaderEncoding(isEbcdic ? 'ebcdic' : 'ascii');

      const view = new DataView(buffer);
      const bigEndian = options.byteOrder === 'big-endian';

      const sampleCount = view.getInt16(3220, bigEndian) || 1000;
      const sampleInterval = view.getInt16(3216, bigEndian) || 4000;
      const dataFormatCode = view.getInt16(3224, bigEndian) || 5;

      const traceHeaderStart = 3600;
      let bytesPerSample = 4;
      if (dataFormatCode === 1 || dataFormatCode === 2 || dataFormatCode === 5) {
        bytesPerSample = 4;
      } else if (dataFormatCode === 3) {
        bytesPerSample = 2;
      } else if (dataFormatCode === 8) {
        bytesPerSample = 1;
      }
      const traceSize = 240 + sampleCount * bytesPerSample;

      const readTraceHeader = (idx: number) => {
        const offset = traceHeaderStart + idx * traceSize;
        if (offset + 240 > buffer.byteLength) return null;

        const headerInt32: Record<number, number> = {};
        for (let i = 1; i <= 237; i += 4) {
          headerInt32[i] = view.getInt32(offset + i - 1, bigEndian);
        }
        return headerInt32;
      };

      const firstTrace = readTraceHeader(0);
      if (firstTrace) {
        setTraceHeaderData(firstTrace);
      }

      const inlineSet = new Set<number>();
      const crosslineSet = new Set<number>();
      const sampleTraces = Math.min(50, Math.floor((buffer.byteLength - 3600) / traceSize));

      for (let i = 0; i < sampleTraces; i++) {
        const th = readTraceHeader(i);
        if (th) {
          const il = th[options.inlineByte];
          const xl = th[options.crosslineByte];
          if (il !== undefined && il !== null && Math.abs(il) < 1000000) inlineSet.add(il);
          if (xl !== undefined && xl !== null && Math.abs(xl) < 1000000) crosslineSet.add(xl);
        }
      }

      const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
      const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

      const inlineCount = Math.max(1, inlineArr.length);
      const crosslineCount = Math.max(1, crosslineArr.length);
      const totalTraces = Math.floor((selectedFile.size - 3600) / traceSize);

      setParsedData({
        fileName: selectedFile.name,
        fileSize: (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB',
        sampleCount,
        sampleInterval: sampleInterval / 1000,
        dataFormatCode,
        dataFormatName:
          dataFormatCode === 5
            ? 'IEEE 浮点'
            : dataFormatCode === 1
            ? 'IBM 浮点'
            : dataFormatCode === 2
            ? '32位整型'
            : dataFormatCode === 3
            ? '16位整型'
            : `格式 ${dataFormatCode}`,
        inlineCount,
        crosslineCount,
        timeRange: [0, ((sampleCount - 1) * sampleInterval) / 1000],
        byteOrder: options.byteOrder,
        estimatedTraces: totalTraces,
        inlineRange:
          inlineArr.length > 0
            ? [inlineArr[0], inlineArr[inlineArr.length - 1]]
            : [1, inlineCount],
        crosslineRange:
          crosslineArr.length > 0
            ? [crosslineArr[0], crosslineArr[crosslineArr.length - 1]]
            : [1, crosslineCount],
        textHeaderEncoding: isEbcdic ? 'ebcdic' : 'ascii',
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

  const reparseWithNewBytes = async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    try {
      const buffer = await selectedFile.slice(0, 3600 + 100 * 260).arrayBuffer();
      const view = new DataView(buffer);
      const bigEndian = options.byteOrder === 'big-endian';

      const sampleCount = parsedData?.sampleCount || 1000;
      const traceSize = 240 + sampleCount * 4;

      const readTraceHeader = (idx: number) => {
        const offset = 3600 + idx * traceSize;
        if (offset + 240 > buffer.byteLength) return null;

        const headerInt32: Record<number, number> = {};
        for (let i = 1; i <= 237; i += 4) {
          headerInt32[i] = view.getInt32(offset + i - 1, bigEndian);
        }
        return headerInt32;
      };

      const firstTrace = readTraceHeader(traceIndex);
      if (firstTrace) {
        setTraceHeaderData(firstTrace);
      }

      const inlineSet = new Set<number>();
      const crosslineSet = new Set<number>();
      const sampleTraces = Math.min(
        100,
        Math.floor((buffer.byteLength - 3600) / traceSize)
      );

      for (let i = 0; i < sampleTraces; i++) {
        const th = readTraceHeader(i);
        if (th) {
          const il = th[options.inlineByte] ?? 0;
          const xl = th[options.crosslineByte] ?? 0;
          if (il !== 0 && Math.abs(il) < 1000000) inlineSet.add(il);
          if (xl !== 0 && Math.abs(xl) < 1000000) crosslineSet.add(xl);
        }
      }

      const inlineArr = Array.from(inlineSet).sort((a, b) => a - b);
      const crosslineArr = Array.from(crosslineSet).sort((a, b) => a - b);

      setParsedData((prev: any) => ({
        ...prev,
        inlineCount: Math.max(1, inlineArr.length),
        crosslineCount: Math.max(1, crosslineArr.length),
        inlineRange:
          inlineArr.length > 0
            ? [inlineArr[0], inlineArr[inlineArr.length - 1]]
            : [1, inlineArr.length || 1],
        crosslineRange:
          crosslineArr.length > 0
            ? [crosslineArr[0], crosslineArr[crosslineArr.length - 1]]
            : [1, crosslineArr.length || 1],
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

                <button
                  className="w-full px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                  onClick={reparseWithNewBytes}
                  disabled={isParsing}
                >
                  {isParsing ? '重新解析中...' : '应用并重新解析'}
                </button>

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

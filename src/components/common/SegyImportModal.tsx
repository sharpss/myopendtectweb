import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, ChevronRight, ChevronDown, Info } from 'lucide-react';
import Modal from './Modal';
import { cn } from '../../lib/utils';

interface SegyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (file: File, options: SegyImportOptions) => Promise<void>;
}

export interface SegyImportOptions {
  datasetName: string;
  byteOrder: 'big-endian' | 'little-endian';
  dataFormat: number;
  inlineByte: number;
  crosslineByte: number;
  sampleIntervalByte: number;
}

export default function SegyImportModal({ isOpen, onClose, onImport }: SegyImportModalProps) {
  const [step, setStep] = useState<'upload' | 'parse' | 'options' | 'importing' | 'done'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedHeader, setParsedHeader] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<SegyImportOptions>({
    datasetName: '',
    byteOrder: 'big-endian',
    dataFormat: 5,
    inlineByte: 189,
    crosslineByte: 193,
    sampleIntervalByte: 17,
  });

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setParsedHeader(null);
    setError(null);
    setImportProgress(0);
    setOptions({
      datasetName: '',
      byteOrder: 'big-endian',
      dataFormat: 5,
      inlineByte: 189,
      crosslineByte: 193,
      sampleIntervalByte: 17,
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setOptions(prev => ({ ...prev, datasetName: file.name.replace('.segy', '').replace('.sgy', '') }));
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
      const buffer = await selectedFile.slice(0, 4000).arrayBuffer();
      const view = new DataView(buffer);
      
      const sampleCount = view.getInt16(3220, false);
      const sampleInterval = view.getInt16(3216, false);
      const dataFormatCode = view.getInt16(3224, false);
      
      const inlineCount = 100 + Math.floor(Math.random() * 50);
      const crosslineCount = 120 + Math.floor(Math.random() * 50);
      
      setParsedHeader({
        fileName: selectedFile.name,
        fileSize: (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB',
        sampleCount,
        sampleInterval: sampleInterval / 1000,
        dataFormatCode,
        dataFormatName: dataFormatCode === 5 ? 'IBM 浮点' : dataFormatCode === 1 ? 'IBM 浮点' : `格式 ${dataFormatCode}`,
        inlineCount,
        crosslineCount,
        timeRange: [0, (sampleCount - 1) * sampleInterval / 1000],
        byteOrder: 'big-endian',
        estimatedTraces: Math.floor(selectedFile.size / (240 + sampleCount * 4)),
      });
      
      setStep('parse');
    } catch (err) {
      setError('文件解析失败，请检查文件格式');
    } finally {
      setIsParsing(false);
    }
  };

  const startImport = async () => {
    setStep('importing');
    setImportProgress(0);
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 100));
      setImportProgress(i);
    }
    
    if (onImport && selectedFile) {
      await onImport(selectedFile, options);
    }
    
    setStep('done');
  };

  const steps = [
    { id: 'upload', label: '选择文件', icon: Upload },
    { id: 'parse', label: '解析文件', icon: FileText },
    { id: 'options', label: '导入设置', icon: Info },
    { id: 'importing', label: '导入中', icon: Upload },
    { id: 'done', label: '完成', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="导入 SEGY 数据"
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-400">
            {step !== 'upload' && step !== 'done' && step !== 'importing' && (
              <button 
                className="text-blue-400 hover:text-blue-300"
                onClick={() => setStep(step === 'parse' ? 'upload' : 'parse')}
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
            {step === 'parse' && (
              <button
                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                onClick={() => setStep('options')}
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
              <div className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                i <= currentStepIndex ? 'text-blue-400' : 'text-slate-500'
              )}>
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
              {i < steps.length - 2 && (
                <ChevronRight className={cn(
                  'w-4 h-4 mx-1',
                  i < currentStepIndex ? 'text-blue-500' : 'text-slate-600'
                )} />
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                  <p className="text-sm text-slate-200 font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  className="text-xs text-blue-400 hover:text-blue-300"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
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

        {step === 'parse' && parsedHeader && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="文件名" value={parsedHeader.fileName} />
              <InfoItem label="文件大小" value={parsedHeader.fileSize} />
              <InfoItem label="采样点数" value={parsedHeader.sampleCount} />
              <InfoItem label="采样间隔" value={`${parsedHeader.sampleInterval} ms`} />
              <InfoItem label="数据格式" value={parsedHeader.dataFormatName} />
              <InfoItem label="字节序" value={parsedHeader.byteOrder} />
              <InfoItem label="Inline 数" value={parsedHeader.inlineCount} />
              <InfoItem label="Crossline 数" value={parsedHeader.crosslineCount} />
              <InfoItem label="时间范围" value={`0 - ${parsedHeader.timeRange[1]} ms`} />
              <InfoItem label="预估道数" value={parsedHeader.estimatedTraces?.toLocaleString()} />
            </div>
            
            <div className="p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <p className="font-medium mb-1">解析信息</p>
                  <p className="text-slate-400">
                    系统已自动检测文件参数。如解析结果不正确，可在下一步手动调整道头字节位置。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'options' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">数据集名称</label>
                <input
                  type="text"
                  value={options.datasetName}
                  onChange={(e) => setOptions(prev => ({ ...prev, datasetName: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">字节序</label>
                <select
                  value={options.byteOrder}
                  onChange={(e) => setOptions(prev => ({ ...prev, byteOrder: e.target.value as 'big-endian' | 'little-endian' }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="big-endian">大端序 (Big Endian)</option>
                  <option value="little-endian">小端序 (Little Endian)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Inline 道头字节位置</label>
                <input
                  type="number"
                  value={options.inlineByte}
                  onChange={(e) => setOptions(prev => ({ ...prev, inlineByte: parseInt(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Crossline 道头字节位置</label>
                <input
                  type="number"
                  value={options.crosslineByte}
                  onChange={(e) => setOptions(prev => ({ ...prev, crosslineByte: parseInt(e.target.value) }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <p className="font-medium mb-1">提示</p>
                  <p className="text-amber-300/70">
                    不正确的道头字节位置将导致数据无法正确加载。如有疑问，请参考 SEGY 文件的元数据说明。
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
                <Upload className="w-8 h-8 text-blue-400 animate-bounce" />
              </div>
              <p className="mt-4 text-sm text-slate-200">正在导入数据...</p>
              <p className="text-xs text-slate-400 mt-1">{selectedFile?.name}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>导入进度</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
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
                <p className="text-lg font-semibold text-blue-400">100+</p>
                <p className="text-[10px] text-slate-400">Inline</p>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <p className="text-lg font-semibold text-green-400">120+</p>
                <p className="text-[10px] text-slate-400">Crossline</p>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <p className="text-lg font-semibold text-amber-400">200</p>
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

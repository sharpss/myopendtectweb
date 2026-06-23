import { useRef, useEffect } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { getColormapColor, applyBrightnessContrast } from '../../utils/colormap';
import { MOCK_DATASET } from '../../data/mockSeismic';

interface SliceViewProps {
  type: 'inline' | 'crossline' | 'timeslice';
  className?: string;
}

export default function SliceView({ type, className }: SliceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getSlice } = useSeismicStore();
  const { colormap, brightness, contrast, inlineIndex, crosslineIndex, timeIndex, setInlineIndex, setCrosslineIndex, setTimeIndex } = useViewerStore();
  
  const index = type === 'inline' ? inlineIndex : type === 'crossline' ? crosslineIndex : timeIndex;
  const setIndex = type === 'inline' ? setInlineIndex : type === 'crossline' ? setCrosslineIndex : setTimeIndex;
  
  const title = type === 'inline' ? 'Inline 剖面' : type === 'crossline' ? 'Crossline 剖面' : '时间切片';
  const axisLabel = type === 'inline' ? 'Inline' : type === 'crossline' ? 'Crossline' : 'Time';
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const sliceData = getSlice(type, index);
    const { data, width, height, minValue, maxValue } = sliceData;
    
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const displayWidth = rect.width - 40;
    const displayHeight = rect.height - 30;
    
    let imageData: Uint8ClampedArray;
    
    if (type === 'timeslice') {
      imageData = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i++) {
        const [r, g, b] = getColormapColor(data[i], minValue, maxValue, colormap);
        imageData[i * 4] = Math.round(r * 255);
        imageData[i * 4 + 1] = Math.round(g * 255);
        imageData[i * 4 + 2] = Math.round(b * 255);
        imageData[i * 4 + 3] = 255;
      }
    } else {
      imageData = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = x * height + y;
          const dstIdx = (y * width + x) * 4;
          const [r, g, b] = getColormapColor(data[srcIdx], minValue, maxValue, colormap);
          imageData[dstIdx] = Math.round(r * 255);
          imageData[dstIdx + 1] = Math.round(g * 255);
          imageData[dstIdx + 2] = Math.round(b * 255);
          imageData[dstIdx + 3] = 255;
        }
      }
    }
    
    if (brightness !== 0 || contrast !== 0) {
      imageData = applyBrightnessContrast(imageData, brightness, contrast);
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      const imgData = new ImageData(imageData, width, height);
      tempCtx.putImageData(imgData, 0, 0);
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, 30, 10, displayWidth, displayHeight);
    }
    
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 10, displayWidth, displayHeight);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    
    if (type === 'timeslice') {
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const x = 30 + (displayWidth / ticks) * i;
        const val = Math.round((MOCK_DATASET.inlineStart + (MOCK_DATASET.inlineCount - 1) * MOCK_DATASET.inlineStep) * (i / ticks));
        ctx.fillText(val.toString(), x - 15, displayHeight + 22);
        
        const y = 10 + (displayHeight / ticks) * i;
        const yVal = Math.round((MOCK_DATASET.crosslineStart + (MOCK_DATASET.crosslineCount - 1) * MOCK_DATASET.crosslineStep) * (i / ticks));
        ctx.save();
        ctx.translate(5, y + 3);
        ctx.fillText(yVal.toString(), 0, 0);
        ctx.restore();
      }
    } else {
      const ticks = 5;
      const horizLabel = type === 'inline' ? 'Crossline' : 'Inline';
      for (let i = 0; i <= ticks; i++) {
        const x = 30 + (displayWidth / ticks) * i;
        const startVal = type === 'inline' ? MOCK_DATASET.crosslineStart : MOCK_DATASET.inlineStart;
        const endVal = type === 'inline' 
          ? MOCK_DATASET.crosslineStart + (MOCK_DATASET.crosslineCount - 1) * MOCK_DATASET.crosslineStep
          : MOCK_DATASET.inlineStart + (MOCK_DATASET.inlineCount - 1) * MOCK_DATASET.inlineStep;
        const val = Math.round(startVal + (endVal - startVal) * (i / ticks));
        ctx.fillText(val.toString(), x - 15, displayHeight + 22);
      }
      
      for (let i = 0; i <= ticks; i++) {
        const y = 10 + (displayHeight / ticks) * i;
        const timeVal = Math.round(MOCK_DATASET.timeStart + (MOCK_DATASET.timeSamples - 1) * MOCK_DATASET.sampleInterval * (i / ticks));
        ctx.save();
        ctx.translate(5, y + 3);
        ctx.fillText(timeVal + 'ms', 0, 0);
        ctx.restore();
      }
    }
    
  }, [type, index, colormap, brightness, contrast, getSlice]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const maxIdx = type === 'inline' 
      ? MOCK_DATASET.inlineCount - 1 
      : type === 'crossline' 
        ? MOCK_DATASET.crosslineCount - 1 
        : MOCK_DATASET.timeSamples - 1;
    setIndex(Math.max(0, Math.min(maxIdx, index + delta)));
  };
  
  return (
    <div 
      ref={containerRef} 
      className={`relative bg-[#0f172a] ${className || ''}`}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 rounded text-[11px] text-slate-300 z-10">
        <div className={`w-2 h-2 rounded-full ${
          type === 'inline' ? 'bg-blue-500' : type === 'crossline' ? 'bg-green-500' : 'bg-amber-500'
        }`} />
        {title}
        <span className="text-slate-500">|</span>
        <span className="font-mono text-slate-400">
          {axisLabel}: {index}
        </span>
      </div>
      
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 rounded text-[10px] text-slate-400 z-10">
        滚轮切换切片
      </div>
    </div>
  );
}

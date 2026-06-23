import { useRef, useEffect, useState, useCallback } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { useInterpretationStore } from '../../store/interpretationStore';
import { getColormapColor, applyBrightnessContrast } from '../../utils/colormap';
import { MOCK_DATASET } from '../../data/mockSeismic';
import { Point3D, SliceType } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { X, Undo2, Check, SkipForward, SkipBack } from 'lucide-react';

interface SliceViewProps {
  type: 'inline' | 'crossline' | 'timeslice';
  className?: string;
}

interface MeasurePoint {
  x: number;
  y: number;
  value: number;
}

interface CursorInfo {
  x: number;
  y: number;
  dataX: number;
  dataY: number;
  value: number;
}

export default function SliceView({ type, className }: SliceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getSlice } = useSeismicStore();
  const { colormap, brightness, contrast, inlineIndex, crosslineIndex, timeIndex, setInlineIndex, setCrosslineIndex, setTimeIndex } = useViewerStore();
  const { activeTool, horizons, faults, activeHorizonId, activeFaultId, addPickPoint, isPicking, currentPickPoints, startPicking, finishPicking, cancelPicking, removeLastPickPoint, autoTrackHorizon } = useInterpretationStore();
  
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  
  const index = type === 'inline' ? inlineIndex : type === 'crossline' ? crosslineIndex : timeIndex;
  const setIndex = type === 'inline' ? setInlineIndex : type === 'crossline' ? setCrosslineIndex : setTimeIndex;
  
  const title = type === 'inline' ? 'Inline 剖面' : type === 'crossline' ? 'Crossline 剖面' : '时间切片';
  const axisLabel = type === 'inline' ? 'Inline' : type === 'crossline' ? 'Crossline' : 'Time';
  
  const PLOT_X = 40;
  const PLOT_Y = 20;
  
  const getDataCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left - PLOT_X;
    const y = clientY - rect.top - PLOT_Y;
    
    const displayWidth = rect.width - PLOT_X - 10;
    const displayHeight = rect.height - PLOT_Y - 25;
    
    if (x < 0 || x > displayWidth || y < 0 || y > displayHeight) return null;
    
    const sliceData = getSlice(type, index);
    const { width, height } = sliceData;
    
    const dataX = Math.floor((x / displayWidth) * width);
    const dataY = Math.floor((y / displayHeight) * height);
    
    const dataIdx = dataY * width + dataX;
    const value = sliceData.data[Math.min(dataIdx, sliceData.data.length - 1)];
    
    let worldX: number, worldY: number;
    if (type === 'timeslice') {
      worldX = MOCK_DATASET.inlineStart + dataX * MOCK_DATASET.inlineStep;
      worldY = MOCK_DATASET.crosslineStart + dataY * MOCK_DATASET.crosslineStep;
    } else if (type === 'inline') {
      worldX = MOCK_DATASET.crosslineStart + dataX * MOCK_DATASET.crosslineStep;
      worldY = dataY * MOCK_DATASET.sampleInterval;
    } else {
      worldX = MOCK_DATASET.inlineStart + dataX * MOCK_DATASET.inlineStep;
      worldY = dataY * MOCK_DATASET.sampleInterval;
    }
    
    return {
      x, y, dataX, dataY, value, worldX, worldY,
      displayWidth, displayHeight,
    };
  }, [type, index, getSlice]);
  
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
    
    const displayWidth = rect.width - PLOT_X - 10;
    const displayHeight = rect.height - PLOT_Y - 25;
    
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
      ctx.drawImage(tempCanvas, PLOT_X, PLOT_Y, displayWidth, displayHeight);
    }
    
    horizons.filter(h => h.visible).forEach(horizon => {
      ctx.strokeStyle = horizon.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      let started = false;
      const points = horizon.points.filter(p => {
        if (type === 'inline') {
          const il = Math.round(p.x / MOCK_DATASET.inlineStep);
          return Math.abs(il - index) < 2;
        } else if (type === 'crossline') {
          const xl = Math.round(p.y / MOCK_DATASET.crosslineStep);
          return Math.abs(xl - index) < 2;
        } else {
          const t = Math.round(p.z / MOCK_DATASET.sampleInterval);
          return Math.abs(t - index) < 2;
        }
      });
      
      points.forEach((p, i) => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayHeight;
        } else if (type === 'inline') {
          px = PLOT_X + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        } else {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        }
        
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      });
      
      ctx.stroke();
    });
    
    faults.filter(f => f.visible).forEach(fault => {
      ctx.strokeStyle = fault.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      
      const points = fault.vertices.filter(p => {
        if (type === 'inline') {
          const il = Math.round(p.x / MOCK_DATASET.inlineStep);
          return Math.abs(il - index) < 3;
        } else if (type === 'crossline') {
          const xl = Math.round(p.y / MOCK_DATASET.crosslineStep);
          return Math.abs(xl - index) < 3;
        } else {
          const t = Math.round(p.z / MOCK_DATASET.sampleInterval);
          return Math.abs(t - index) < 3;
        }
      });
      
      let started = false;
      points.forEach(p => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayHeight;
        } else if (type === 'inline') {
          px = PLOT_X + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        } else {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        }
        
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      });
      
      ctx.stroke();
      ctx.setLineDash([]);
    });
    
    if (isPicking && currentPickPoints.length > 0) {
      const color = activeTool === 'horizon' 
        ? horizons.find(h => h.id === activeHorizonId)?.color || '#f59e0b'
        : faults.find(f => f.id === useInterpretationStore.getState().activeFaultId)?.color || '#ef4444';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      currentPickPoints.forEach((p, i) => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayHeight;
        } else if (type === 'inline') {
          px = PLOT_X + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        } else {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        }
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      
      currentPickPoints.forEach(p => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayHeight;
        } else if (type === 'inline') {
          px = PLOT_X + ((p.y - MOCK_DATASET.crosslineStart) / (MOCK_DATASET.crosslineCount * MOCK_DATASET.crosslineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        } else {
          px = PLOT_X + ((p.x - MOCK_DATASET.inlineStart) / (MOCK_DATASET.inlineCount * MOCK_DATASET.inlineStep)) * displayWidth;
          py = PLOT_Y + (p.z / (MOCK_DATASET.timeSamples * MOCK_DATASET.sampleInterval)) * displayHeight;
        }
        
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    
    if (activeTool === 'measure' && measurePoints.length > 0) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      
      measurePoints.forEach((p, i) => {
        const px = PLOT_X + p.x;
        const py = PLOT_Y + p.y;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      
      measurePoints.forEach(p => {
        const px = PLOT_X + p.x;
        const py = PLOT_Y + p.y;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      
      if (measurePoints.length >= 2) {
        const last = measurePoints[measurePoints.length - 1];
        const prev = measurePoints[measurePoints.length - 2];
        let dist: string;
        
        if (type === 'timeslice') {
          const dx = (last.x - prev.x) * MOCK_DATASET.inlineStep;
          const dy = (last.y - prev.y) * MOCK_DATASET.crosslineStep;
          dist = `${Math.sqrt(dx * dx + dy * dy).toFixed(1)} m`;
        } else {
          const dx = type === 'inline'
            ? (last.x - prev.x) * MOCK_DATASET.crosslineStep
            : (last.x - prev.x) * MOCK_DATASET.inlineStep;
          const dy = (last.y - prev.y) * MOCK_DATASET.sampleInterval;
          dist = `${Math.sqrt(dx * dx + dy * dy).toFixed(1)} ms`;
        }
        
        const px = PLOT_X + (last.x + prev.x) / 2;
        const py = PLOT_Y + (last.y + prev.y) / 2 - 8;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = '10px monospace';
        const textWidth = ctx.measureText(dist).width + 8;
        ctx.fillRect(px - textWidth / 2, py - 8, textWidth, 14);
        ctx.fillStyle = '#22d3ee';
        ctx.textAlign = 'center';
        ctx.fillText(dist, px, py + 2);
        ctx.textAlign = 'left';
      }
    }
    
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(PLOT_X, PLOT_Y, displayWidth, displayHeight);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    if (type === 'timeslice') {
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const x = PLOT_X + (displayWidth / ticks) * i;
        const val = Math.round(MOCK_DATASET.inlineStart + (MOCK_DATASET.inlineCount - 1) * MOCK_DATASET.inlineStep * (i / ticks));
        ctx.fillText(val.toString(), x, displayHeight + PLOT_Y + 15);
        
        const y = PLOT_Y + (displayHeight / ticks) * i;
        const yVal = Math.round(MOCK_DATASET.crosslineStart + (MOCK_DATASET.crosslineCount - 1) * MOCK_DATASET.crosslineStep * (i / ticks));
        ctx.save();
        ctx.translate(PLOT_X - 5, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(yVal.toString(), 0, 0);
        ctx.restore();
      }
    } else {
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const x = PLOT_X + (displayWidth / ticks) * i;
        const startVal = type === 'inline' ? MOCK_DATASET.crosslineStart : MOCK_DATASET.inlineStart;
        const endVal = type === 'inline' 
          ? MOCK_DATASET.crosslineStart + (MOCK_DATASET.crosslineCount - 1) * MOCK_DATASET.crosslineStep
          : MOCK_DATASET.inlineStart + (MOCK_DATASET.inlineCount - 1) * MOCK_DATASET.inlineStep;
        const val = Math.round(startVal + (endVal - startVal) * (i / ticks));
        ctx.fillText(val.toString(), x, displayHeight + PLOT_Y + 15);
      }
      
      for (let i = 0; i <= ticks; i++) {
        const y = PLOT_Y + (displayHeight / ticks) * i;
        const timeVal = Math.round(MOCK_DATASET.timeStart + (MOCK_DATASET.timeSamples - 1) * MOCK_DATASET.sampleInterval * (i / ticks));
        ctx.save();
        ctx.translate(PLOT_X - 5, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(timeVal + 'ms', 0, 0);
        ctx.restore();
      }
    }
    
    ctx.textAlign = 'left';
    
  }, [type, index, colormap, brightness, contrast, getSlice, horizons, faults, activeHorizonId, isPicking, currentPickPoints, activeTool, measurePoints]);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getDataCoordinates(e.clientX, e.clientY);
    if (coords) {
      setCursorInfo({
        x: coords.x,
        y: coords.y,
        dataX: coords.dataX,
        dataY: coords.dataY,
        value: coords.value,
      } as CursorInfo);
    } else {
      setCursorInfo(null);
    }
  };
  
  const handleClick = (e: React.MouseEvent) => {
    const coords = getDataCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    
    if (activeTool === 'horizon' || activeTool === 'fault') {
      if (!isPicking) {
        startPicking();
      }
      
      let point: Point3D;
      if (type === 'timeslice') {
        point = {
          x: coords.worldX!,
          y: coords.worldY!,
          z: index * MOCK_DATASET.sampleInterval,
        };
      } else if (type === 'inline') {
        point = {
          x: index * MOCK_DATASET.inlineStep + MOCK_DATASET.inlineStart,
          y: coords.worldX!,
          z: coords.worldY!,
        };
      } else {
        point = {
          x: coords.worldX!,
          y: index * MOCK_DATASET.crosslineStep + MOCK_DATASET.crosslineStart,
          z: coords.worldY!,
        };
      }
      
      addPickPoint(point);
    }
    
    if (activeTool === 'measure') {
      setMeasurePoints(prev => [...prev, { x: coords.x, y: coords.y, value: coords.value }]);
    }
  };
  
  const handleDoubleClick = () => {
    if ((activeTool === 'horizon' || activeTool === 'fault') && isPicking) {
      finishPicking();
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((activeTool === 'horizon' || activeTool === 'fault') && isPicking) {
      cancelPicking();
    }
    if (activeTool === 'measure') {
      setMeasurePoints([]);
      setIsMeasuring(false);
    }
  };
  
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
  
  const getCursorStyle = () => {
    if (activeTool === 'horizon' || activeTool === 'fault') return 'crosshair';
    if (activeTool === 'measure') return 'crosshair';
    if (activeTool === 'zoom') return 'zoom-in';
    if (activeTool === 'pan') return 'grab';
    return 'default';
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((activeTool === 'horizon' || activeTool === 'fault') && isPicking) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          removeLastPickPoint();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          finishPicking();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelPicking();
        }
      }

      if (activeTool === 'measure') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setMeasurePoints([]);
          setIsMeasuring(false);
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          setMeasurePoints(prev => prev.slice(0, -1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, isPicking, removeLastPickPoint, finishPicking, cancelPicking]);

  const handleAutoTrack = (direction: 'forward' | 'backward') => {
    if (activeTool === 'horizon' && activeHorizonId) {
      autoTrackHorizon(activeHorizonId, type as SliceType, index, direction, 10);
    }
  };
  
  return (
    <div 
      ref={containerRef} 
      className={cn('relative bg-[#0f172a] overflow-hidden', className || '')}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{ cursor: getCursorStyle() }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 rounded text-[11px] text-slate-300 z-10">
        <div className={cn('w-2 h-2 rounded-full',
          type === 'inline' ? 'bg-blue-500' : type === 'crossline' ? 'bg-green-500' : 'bg-amber-500'
        )} />
        {title}
        <span className="text-slate-500">|</span>
        <span className="font-mono text-slate-400">
          {axisLabel}: {index}
        </span>
      </div>
      
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {activeTool === 'measure' && measurePoints.length > 0 && (
          <>
            <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded text-[10px] text-cyan-300">
              测量: {measurePoints.length - 1} 段
            </div>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); setMeasurePoints(prev => prev.slice(0, -1)); }}
              title="撤销测量点 (Backspace)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); setMeasurePoints([]); }}
              title="清除测量 (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {(activeTool === 'horizon' || activeTool === 'fault') && isPicking && (
          <>
            <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded text-[10px] text-amber-300">
              拾取中: {currentPickPoints.length} 点
            </div>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); removeLastPickPoint(); }}
              title="撤销上一点 (Backspace)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 bg-slate-900/80 rounded text-green-400 hover:text-green-300 hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); finishPicking(); }}
              title="完成拾取 (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); cancelPicking(); }}
              title="取消拾取 (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {activeTool === 'horizon' && !isPicking && activeHorizonId && (
          <>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); handleAutoTrack('backward'); }}
              title="向回追踪 10 道"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              onClick={(e) => { e.stopPropagation(); handleAutoTrack('forward'); }}
              title="向前追踪 10 道"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      
      {cursorInfo && (
        <div className="absolute bottom-2 left-2 px-2 py-1.5 bg-slate-900/90 rounded text-[10px] text-slate-300 z-10 font-mono space-y-0.5 min-w-[140px]">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">
              {type === 'timeslice' ? 'Inline:' : type === 'inline' ? 'Crossline:' : 'Inline:'}
            </span>
            <span className="text-cyan-400">
              {type === 'timeslice' ? cursorInfo.dataX : cursorInfo.dataX}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">
              {type === 'timeslice' ? 'Crossline:' : 'Time:'}
            </span>
            <span className="text-green-400">
              {type === 'timeslice' ? cursorInfo.dataY : cursorInfo.dataY}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t border-slate-700 pt-0.5">
            <span className="text-slate-500">值:</span>
            <span className="text-amber-400">{cursorInfo.value.toFixed(4)}</span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 rounded text-[10px] text-slate-400 z-10">
        滚轮切换切片
      </div>
      
      {(activeTool === 'horizon' || activeTool === 'fault') && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity z-10">
          <div className="px-3 py-2 bg-slate-900/90 rounded text-[10px] text-slate-400">
            单击拾取点，双击完成，右键取消
          </div>
        </div>
      )}
    </div>
  );
}

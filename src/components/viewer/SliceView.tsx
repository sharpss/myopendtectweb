import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { useInterpretationStore } from '../../store/interpretationStore';
import { getColormapColor, applyBrightnessContrast } from '../../utils/colormap';
import { Point3D, SliceType, SeismicSliceData } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { X, Undo2, Check, SkipForward, SkipBack, Database, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface SliceViewProps {
  type: 'inline' | 'crossline' | 'timeslice';
  className?: string;
}

interface MeasurePoint {
  x: number;
  y: number;
  dataX: number;
  dataY: number;
  worldX: number;
  worldY: number;
  value: number;
}

interface CursorInfo {
  x: number;
  y: number;
  dataX: number;
  dataY: number;
  worldX: number;
  worldY: number;
  value: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export default function SliceView({ type, className }: SliceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorbarCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getSlice, datasets, activeDatasetId, dataProvider, isLoading } = useSeismicStore();
  const { colormap, brightness, contrast, inlineIndex, crosslineIndex, timeIndex, setInlineIndex, setCrosslineIndex, setTimeIndex, setCursorPosition } = useViewerStore();
  const { activeTool, horizons, faults, activeHorizonId, activeFaultId, addPickPoint, isPicking, currentPickPoints, startPicking, finishPicking, cancelPicking, removeLastPickPoint, autoTrackHorizon } = useInterpretationStore();
  
  const dataset = datasets.find((d) => d.id === activeDatasetId);
  const dataLoaded = dataProvider?.isLoaded ?? false;
  
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);
  const [sliceData, setSliceData] = useState<SeismicSliceData | null>(null);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  
  const index = type === 'inline' ? inlineIndex : type === 'crossline' ? crosslineIndex : timeIndex;
  const setIndex = type === 'inline' ? setInlineIndex : type === 'crossline' ? setCrosslineIndex : setTimeIndex;
  
  const title = type === 'inline' ? 'Inline 剖面' : type === 'crossline' ? 'Crossline 剖面' : '时间切片';
  const axisLabel = type === 'inline' ? 'Inline' : type === 'crossline' ? 'Crossline' : 'Time';
  
  const PLOT_X = 50;
  const PLOT_Y = 25;
  const PLOT_RIGHT_PAD = 40;
  const PLOT_BOTTOM_PAD = 30;
  
  const getSliceNumber = useCallback(() => {
    if (!dataset) return index;
    const timeStart = dataset.timeStart ?? 0;
    if (type === 'inline') return dataset.inlineStart + index * dataset.inlineStep;
    if (type === 'crossline') return dataset.crosslineStart + index * dataset.crosslineStep;
    return timeStart + index * dataset.sampleInterval;
  }, [dataset, type, index]);
  
  const sliceNumber = getSliceNumber();
  const sliceUnit = type === 'timeslice' ? 'ms' : '';
  
  const maxIndex = useMemo(() => {
    if (!dataset) return 0;
    return type === 'inline' ? dataset.inlineCount - 1 : type === 'crossline' ? dataset.crosslineCount - 1 : dataset.timeSamples - 1;
  }, [dataset, type]);

  const zoomIn = useCallback(() => {
    setViewTransform(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 8),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewTransform(prev => {
      const newScale = Math.max(prev.scale / 1.2, 0.5);
      if (newScale <= 1) {
        return { scale: 1, offsetX: 0, offsetY: 0 };
      }
      return { ...prev, scale: newScale };
    });
  }, []);

  const resetView = useCallback(() => {
    setViewTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);
  
  const getDataCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !dataset || !sliceData) return null;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const displayWidth = rect.width - PLOT_X - PLOT_RIGHT_PAD;
    const displayHeight = rect.height - PLOT_Y - PLOT_BOTTOM_PAD;
    
    const { width: dataWidth, height: dataHeight } = sliceData;
    if (dataWidth === 0 || dataHeight === 0) return null;
    
    const scaledWidth = displayWidth * viewTransform.scale;
    const scaledHeight = displayHeight * viewTransform.scale;
    
    const plotOffsetX = PLOT_X + viewTransform.offsetX + (displayWidth - scaledWidth) / 2;
    const plotOffsetY = PLOT_Y + viewTransform.offsetY + (displayHeight - scaledHeight) / 2;
    
    const relX = x - plotOffsetX;
    const relY = y - plotOffsetY;
    
    if (relX < 0 || relX > scaledWidth || relY < 0 || relY > scaledHeight) return null;
    
    const dataX = Math.floor((relX / scaledWidth) * dataWidth);
    const dataY = Math.floor((relY / scaledHeight) * dataHeight);
    
    const dataIdx = type === 'timeslice' 
      ? dataY * dataWidth + dataX
      : dataX * dataHeight + dataY;
    const safeIdx = Math.min(Math.max(0, dataIdx), sliceData.data.length - 1);
    const value = sliceData.data[safeIdx];
    
    let worldX: number, worldY: number;
    const timeStart = dataset.timeStart ?? 0;
    if (type === 'timeslice') {
      worldX = dataset.inlineStart + dataX * dataset.inlineStep;
      worldY = dataset.crosslineStart + dataY * dataset.crosslineStep;
    } else if (type === 'inline') {
      worldX = dataset.crosslineStart + dataX * dataset.crosslineStep;
      worldY = timeStart + dataY * dataset.sampleInterval;
    } else {
      worldX = dataset.inlineStart + dataX * dataset.inlineStep;
      worldY = timeStart + dataY * dataset.sampleInterval;
    }
    
    return {
      x: relX,
      y: relY,
      plotOffsetX,
      plotOffsetY,
      scaledWidth,
      scaledHeight,
      dataX,
      dataY,
      value,
      worldX,
      worldY,
      displayWidth,
      displayHeight,
    };
  }, [type, dataset, sliceData, viewTransform]);
  
  useEffect(() => {
    if (dataLoaded && dataset) {
      const data = getSlice(type, index);
      setSliceData(data);
    } else {
      setSliceData(null);
    }
  }, [type, index, getSlice, dataLoaded, dataset]);

  useEffect(() => {
    if (!colorbarCanvasRef.current || !sliceData) return;
    
    const cbCanvas = colorbarCanvasRef.current;
    const cbCtx = cbCanvas.getContext('2d');
    if (!cbCtx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = cbCanvas.getBoundingClientRect();
    cbCanvas.width = rect.width * dpr;
    cbCanvas.height = rect.height * dpr;
    cbCtx.scale(dpr, dpr);
    
    const { minValue, maxValue } = sliceData;
    const h = rect.height;
    const w = rect.width;
    
    const gradient = cbCtx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const val = minValue + t * (maxValue - minValue);
      const [r, g, b] = getColormapColor(val, minValue, maxValue, colormap);
      gradient.addColorStop(1 - t, `rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`);
    }
    cbCtx.fillStyle = gradient;
    cbCtx.fillRect(0, 0, w, h);
    
    cbCtx.strokeStyle = '#475569';
    cbCtx.lineWidth = 1;
    cbCtx.strokeRect(0, 0, w, h);
  }, [sliceData, colormap]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !dataset || !dataLoaded || !sliceData) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { data, width, height, minValue, maxValue } = sliceData;
    
    if (width === 0 || height === 0 || data.length === 0) return;
    if (typeof minValue !== 'number' || typeof maxValue !== 'number') return;
    
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    const displayWidth = rect.width - PLOT_X - PLOT_RIGHT_PAD;
    const displayHeight = rect.height - PLOT_Y - PLOT_BOTTOM_PAD;
    
    const scaledWidth = displayWidth * viewTransform.scale;
    const scaledHeight = displayHeight * viewTransform.scale;
    
    const plotOffsetX = PLOT_X + viewTransform.offsetX + (displayWidth - scaledWidth) / 2;
    const plotOffsetY = PLOT_Y + viewTransform.offsetY + (displayHeight - scaledHeight) / 2;
    
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
      
      ctx.imageSmoothingEnabled = viewTransform.scale <= 2;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, plotOffsetX, plotOffsetY, scaledWidth, scaledHeight);
    }
    
    horizons.filter(h => h.visible).forEach(horizon => {
      ctx.strokeStyle = horizon.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      let started = false;
      const points = horizon.points.filter(p => {
        if (type === 'inline') {
          const il = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          return Math.abs(il - index) < 2;
        } else if (type === 'crossline') {
          const xl = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          return Math.abs(xl - index) < 2;
        } else {
          const t = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          return Math.abs(t - index) < 2;
        }
      });
      
      points.forEach((p, i) => {
        let px: number, py: number;
        const sx = scaledWidth / width;
        const sy = scaledHeight / height;
        
        if (type === 'timeslice') {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else if (type === 'inline') {
          const dx = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
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
          const il = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          return Math.abs(il - index) < 3;
        } else if (type === 'crossline') {
          const xl = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          return Math.abs(xl - index) < 3;
        } else {
          const t = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          return Math.abs(t - index) < 3;
        }
      });
      
      let started = false;
      points.forEach(p => {
        let px: number, py: number;
        const sx = scaledWidth / width;
        const sy = scaledHeight / height;
        
        if (type === 'timeslice') {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else if (type === 'inline') {
          const dx = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
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
      
      const sx = scaledWidth / width;
      const sy = scaledHeight / height;
      
      currentPickPoints.forEach((p, i) => {
        let px: number, py: number;
        if (type === 'timeslice') {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else if (type === 'inline') {
          const dx = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        }
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      
      currentPickPoints.forEach(p => {
        let px: number, py: number;
        if (type === 'timeslice') {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else if (type === 'inline') {
          const dx = Math.round((p.y - dataset.crosslineStart) / dataset.crosslineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
        } else {
          const dx = Math.round((p.x - dataset.inlineStart) / dataset.inlineStep);
          const dy = Math.round((p.z - (dataset.timeStart ?? 0)) / dataset.sampleInterval);
          px = plotOffsetX + dx * sx;
          py = plotOffsetY + dy * sy;
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
        const px = plotOffsetX + p.x * (scaledWidth / width);
        const py = plotOffsetY + p.y * (scaledHeight / height);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      
      measurePoints.forEach(p => {
        const px = plotOffsetX + p.x * (scaledWidth / width);
        const py = plotOffsetY + p.y * (scaledHeight / height);
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      
      if (measurePoints.length >= 2) {
        let totalDist = 0;
        for (let i = 1; i < measurePoints.length; i++) {
          const prev = measurePoints[i - 1];
          const curr = measurePoints[i];
          let dist: number;
          if (type === 'timeslice') {
            const dx = (curr.worldX - prev.worldX);
            const dy = (curr.worldY - prev.worldY);
            dist = Math.sqrt(dx * dx + dy * dy);
          } else {
            const dx = type === 'inline' ? (curr.worldX - prev.worldX) : (curr.worldX - prev.worldX);
            const dy = (curr.worldY - prev.worldY);
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          totalDist += dist;
        }
        
        const last = measurePoints[measurePoints.length - 1];
        const px = plotOffsetX + last.x * (scaledWidth / width);
        const py = plotOffsetY + last.y * (scaledHeight / height) - 10;
        
        const distText = type === 'timeslice' ? `${totalDist.toFixed(1)} m` : `${totalDist.toFixed(1)} ms`;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.font = '10px monospace';
        const textWidth = ctx.measureText(distText).width + 10;
        ctx.fillRect(px - textWidth / 2, py - 10, textWidth, 16);
        ctx.fillStyle = '#22d3ee';
        ctx.textAlign = 'center';
        ctx.fillText(distText, px, py + 2);
        ctx.textAlign = 'left';
      }
    }
    
    if (cursorInfo) {
      const cx = plotOffsetX + cursorInfo.dataX * (scaledWidth / width);
      const cy = plotOffsetY + cursorInfo.dataY * (scaledHeight / height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      
      ctx.beginPath();
      ctx.moveTo(cx, plotOffsetY);
      ctx.lineTo(cx, plotOffsetY + scaledHeight);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(plotOffsetX, cy);
      ctx.lineTo(plotOffsetX + scaledWidth, cy);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }
    
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotOffsetX, plotOffsetY, scaledWidth, scaledHeight);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const timeStart = dataset.timeStart ?? 0;
    const ticks = 6;
    const tickSize = 5;
    
    if (type === 'timeslice') {
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const x = plotOffsetX + scaledWidth * t;
        const val = Math.round(dataset.inlineStart + (dataset.inlineCount - 1) * dataset.inlineStep * t);
        
        ctx.beginPath();
        ctx.moveTo(x, plotOffsetY + scaledHeight);
        ctx.lineTo(x, plotOffsetY + scaledHeight + tickSize);
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
        
        ctx.fillText(val.toString(), x, plotOffsetY + scaledHeight + 18);
        
        const y = plotOffsetY + scaledHeight * t;
        const yVal = Math.round(dataset.crosslineStart + (dataset.crosslineCount - 1) * dataset.crosslineStep * t);
        
        ctx.beginPath();
        ctx.moveTo(plotOffsetX, y);
        ctx.lineTo(plotOffsetX - tickSize, y);
        ctx.stroke();
        
        ctx.save();
        ctx.translate(PLOT_X - 8, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(yVal.toString(), 0, 0);
        ctx.restore();
      }
      
      ctx.save();
      ctx.translate(plotOffsetX + scaledWidth / 2, rect.height - 5);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Inline', 0, 0);
      ctx.restore();
      
      ctx.save();
      ctx.translate(10, plotOffsetY + scaledHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Crossline', 0, 0);
      ctx.restore();
    } else {
      const xStart = type === 'inline' ? dataset.crosslineStart : dataset.inlineStart;
      const xEnd = type === 'inline' 
        ? dataset.crosslineStart + (dataset.crosslineCount - 1) * dataset.crosslineStep
        : dataset.inlineStart + (dataset.inlineCount - 1) * dataset.inlineStep;
      
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const x = plotOffsetX + scaledWidth * t;
        const val = Math.round(xStart + (xEnd - xStart) * t);
        
        ctx.beginPath();
        ctx.moveTo(x, plotOffsetY + scaledHeight);
        ctx.lineTo(x, plotOffsetY + scaledHeight + tickSize);
        ctx.strokeStyle = '#64748b';
        ctx.stroke();
        
        ctx.fillText(val.toString(), x, plotOffsetY + scaledHeight + 18);
      }
      
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const y = plotOffsetY + scaledHeight * t;
        const timeVal = Math.round(timeStart + (dataset.timeSamples - 1) * dataset.sampleInterval * t);
        
        ctx.beginPath();
        ctx.moveTo(plotOffsetX, y);
        ctx.lineTo(plotOffsetX - tickSize, y);
        ctx.stroke();
        
        ctx.save();
        ctx.translate(PLOT_X - 8, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(timeVal + 'ms', 0, 0);
        ctx.restore();
      }
      
      ctx.save();
      ctx.translate(plotOffsetX + scaledWidth / 2, rect.height - 5);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(type === 'inline' ? 'Crossline' : 'Inline', 0, 0);
      ctx.restore();
      
      ctx.save();
      ctx.translate(10, plotOffsetY + scaledHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Time (ms)', 0, 0);
      ctx.restore();
    }
    
    ctx.textAlign = 'left';
    
    if (viewTransform.scale > 1) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.font = '10px monospace';
      ctx.fillText(`${(viewTransform.scale * 100).toFixed(0)}%`, PLOT_X + 5, PLOT_Y + 15);
    }
    
  }, [type, index, colormap, brightness, contrast, getSlice, horizons, faults, activeHorizonId, isPicking, currentPickPoints, activeTool, measurePoints, dataset, dataLoaded, sliceData, viewTransform, cursorInfo]);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStart) {
      setViewTransform(prev => ({
        ...prev,
        offsetX: panStart.offsetX + (e.clientX - panStart.x),
        offsetY: panStart.offsetY + (e.clientY - panStart.y),
      }));
      return;
    }
    
    const coords = getDataCoordinates(e.clientX, e.clientY);
    if (coords && dataset) {
      setCursorInfo({
        x: coords.x,
        y: coords.y,
        dataX: coords.dataX,
        dataY: coords.dataY,
        worldX: coords.worldX,
        worldY: coords.worldY,
        value: coords.value,
      } as CursorInfo);
      
      let cursorInline: number, cursorCrossline: number, cursorTime: number;
      const timeStart = dataset.timeStart ?? 0;
      
      if (type === 'inline') {
        cursorInline = dataset.inlineStart + index * dataset.inlineStep;
        cursorCrossline = coords.worldX;
        cursorTime = coords.worldY;
      } else if (type === 'crossline') {
        cursorInline = coords.worldX;
        cursorCrossline = dataset.crosslineStart + index * dataset.crosslineStep;
        cursorTime = coords.worldY;
      } else {
        cursorInline = coords.worldX;
        cursorCrossline = coords.worldY;
        cursorTime = timeStart + index * dataset.sampleInterval;
      }
      
      setCursorPosition({
        inline: cursorInline,
        crossline: cursorCrossline,
        time: cursorTime,
        value: coords.value,
      });
    } else {
      setCursorInfo(null);
      setCursorPosition(null);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        offsetX: viewTransform.offsetX,
        offsetY: viewTransform.offsetY,
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };
  
  const handleClick = (e: React.MouseEvent) => {
    if (isPanning) return;
    
    const coords = getDataCoordinates(e.clientX, e.clientY);
    if (!coords) return;
    
    if (activeTool === 'horizon' || activeTool === 'fault') {
      if (!isPicking) {
        startPicking();
      }
      
      let point: Point3D;
      const timeStart = dataset!.timeStart ?? 0;
      
      if (type === 'timeslice') {
        point = {
          x: coords.worldX!,
          y: coords.worldY!,
          z: timeStart + index * dataset!.sampleInterval,
        };
      } else if (type === 'inline') {
        point = {
          x: dataset!.inlineStart + index * dataset!.inlineStep,
          y: coords.worldX!,
          z: coords.worldY!,
        };
      } else {
        point = {
          x: coords.worldX!,
          y: dataset!.crosslineStart + index * dataset!.crosslineStep,
          z: coords.worldY!,
        };
      }
      
      addPickPoint(point);
    }
    
    if (activeTool === 'measure') {
      setMeasurePoints(prev => [...prev, {
        x: coords.dataX,
        y: coords.dataY,
        dataX: coords.dataX,
        dataY: coords.dataY,
        worldX: coords.worldX!,
        worldY: coords.worldY!,
        value: coords.value,
      }]);
      setIsMeasuring(true);
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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey || activeTool === 'zoom') {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewTransform(prev => {
        const newScale = Math.max(0.5, Math.min(8, prev.scale * delta));
        if (newScale <= 1) {
          return { scale: 1, offsetX: 0, offsetY: 0 };
        }
        return { ...prev, scale: newScale };
      });
    } else {
      if (!dataset) return;
      const delta = e.deltaY > 0 ? 1 : -1;
      setIndex(Math.max(0, Math.min(maxIndex, index + delta)));
    }
  }, [dataset, activeTool, index, setIndex, maxIndex]);
  
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
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
      
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
      if (e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, isPicking, removeLastPickPoint, finishPicking, cancelPicking, zoomIn, zoomOut, resetView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleAutoTrack = (direction: 'forward' | 'backward') => {
    if (activeTool === 'horizon' && activeHorizonId && dataset) {
      autoTrackHorizon(activeHorizonId, type as SliceType, index, direction, 10);
    }
  };
  
  return (
    <div 
      ref={containerRef} 
      className={cn('relative bg-[#0f172a] overflow-hidden select-none', className || '')}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{ cursor: getCursorStyle() }}
    >
      {!dataset ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 mb-3 rounded-full bg-slate-800 flex items-center justify-center">
            <Database className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-xs text-slate-400">未选择数据集</p>
        </div>
      ) : !dataLoaded || isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-10 h-10 mb-3 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400">{isLoading ? '加载数据中...' : '初始化数据...'}</p>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
          <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 rounded text-[11px] text-slate-300 z-10 backdrop-blur-sm">
            <div className={cn('w-2 h-2 rounded-full',
              type === 'inline' ? 'bg-blue-500' : type === 'crossline' ? 'bg-green-500' : 'bg-amber-500'
            )} />
            {title}
            <span className="text-slate-500">|</span>
            <span className="font-mono text-slate-200 font-semibold">
              {axisLabel}: {Math.round(sliceNumber)}{sliceUnit}
            </span>
          </div>
          
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.max(0, index - 10)); }}
              title="后退10个切片"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.max(0, index - 1)); }}
              title="上一个切片"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="px-3 py-1 bg-slate-900/80 rounded text-[10px] text-slate-400 font-mono min-w-[80px] text-center backdrop-blur-sm">
              {index + 1} / {maxIndex + 1}
            </div>
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { 
                e.stopPropagation(); 
                setIndex(Math.min(maxIndex, index + 1)); 
              }}
              title="下一个切片"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { 
                e.stopPropagation(); 
                setIndex(Math.min(maxIndex, index + 10)); 
              }}
              title="前进10个切片"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); zoomOut(); }}
              title="缩小 (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); zoomIn(); }}
              title="放大 (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); resetView(); }}
              title="重置视图 (0)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            
            {activeTool === 'measure' && measurePoints.length > 0 && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded text-[10px] text-cyan-300">
                  {measurePoints.length} 点
                </div>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); setMeasurePoints(prev => prev.slice(0, -1)); }}
                  title="撤销 (Backspace)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); setMeasurePoints([]); setIsMeasuring(false); }}
                  title="清除 (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            
            {(activeTool === 'horizon' || activeTool === 'fault') && isPicking && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded text-[10px] text-amber-300">
                  拾取: {currentPickPoints.length}
                </div>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); removeLastPickPoint(); }}
                  title="撤销 (Backspace)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-green-400 hover:text-green-300 hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); finishPicking(); }}
                  title="完成 (Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); cancelPicking(); }}
                  title="取消 (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            
            {activeTool === 'horizon' && !isPicking && activeHorizonId && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); handleAutoTrack('backward'); }}
                  title="向回追踪"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/80 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); handleAutoTrack('forward'); }}
                  title="向前追踪"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          
          {dataLoaded && sliceData && (
            <div className="absolute right-2 top-14 bottom-14 w-8 flex flex-col z-10">
              <div className="text-[9px] text-slate-500 text-center mb-1 font-mono">
                {sliceData.maxValue.toFixed(1)}
              </div>
              <canvas
                ref={colorbarCanvasRef}
                className="w-full flex-1 rounded"
                style={{ minHeight: '100px' }}
              />
              <div className="text-[9px] text-slate-500 text-center mt-1 font-mono">
                {sliceData.minValue.toFixed(1)}
              </div>
            </div>
          )}
          
          {cursorInfo && (
            <div className="absolute bottom-2 left-2 px-3 py-2 bg-slate-900/90 rounded text-[10px] text-slate-300 z-10 font-mono space-y-0.5 min-w-[160px] backdrop-blur-sm border border-slate-700/50">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  {type === 'timeslice' ? 'Inline:' : type === 'inline' ? 'Crossline:' : 'Inline:'}
                </span>
                <span className="text-cyan-400">
                  {Math.round(cursorInfo.worldX)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  {type === 'timeslice' ? 'Crossline:' : 'Time:'}
                </span>
                <span className="text-green-400">
                  {type === 'timeslice' ? Math.round(cursorInfo.worldY) : cursorInfo.worldY.toFixed(1) + 'ms'}
                </span>
              </div>
              <div className="flex justify-between gap-4 pt-0.5 border-t border-slate-700">
                <span className="text-slate-500">振幅:</span>
                <span className="text-amber-400">{cursorInfo.value.toFixed(4)}</span>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/80 rounded text-[9px] text-slate-500 z-10 backdrop-blur-sm">
            滚轮切换切片 | Ctrl+滚轮缩放 | 中键拖拽平移
          </div>
          
          {(activeTool === 'horizon' || activeTool === 'fault') && !isPicking && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 rounded text-[10px] text-slate-400 z-10 backdrop-blur-sm">
              单击拾取点 | 双击/Enter完成 | 右键/Esc取消
            </div>
          )}
          
          {activeTool === 'measure' && !isMeasuring && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 rounded text-[10px] text-cyan-400 z-10 backdrop-blur-sm">
              单击添加测量点 | 右键/Esc清除
            </div>
          )}
        </>
      )}
    </div>
  );
}

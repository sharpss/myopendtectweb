import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { useInterpretationStore } from '../../store/interpretationStore';
import { getColormapColor, applyBrightnessContrast, applyGain, applyAGC, findPeak, findTrough } from '../../utils/colormap';
import { Point3D, SliceType, SeismicSliceData, DisplayMode } from '../../../shared/types';
import { cn } from '../../lib/utils';
import { X, Undo2, Check, SkipForward, SkipBack, Database, ZoomIn, ZoomOut, Maximize2, Activity, Layers, Target, Move } from 'lucide-react';

interface SliceViewProps {
  type: 'inline' | 'crossline' | 'timeslice';
  className?: string;
}

interface MeasurePoint {
  dataX: number;
  dataY: number;
  worldX: number;
  worldY: number;
  value: number;
}

interface CursorInfo {
  dataX: number;
  dataY: number;
  worldX: number;
  worldY: number;
  value: number;
  plotX: number;
  plotY: number;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const DISPLAY_MODES: { id: DisplayMode; label: string; icon: React.ReactNode }[] = [
  { id: 'vd', label: '变密度', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'wiggle', label: '波形', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'va', label: '变面积', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'wiggle_va', label: '波形+变面积', icon: <Layers className="w-3.5 h-3.5" /> },
];

export default function SliceView({ type, className }: SliceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorbarCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getSlice, datasets, activeDatasetId, dataProvider, isLoading } = useSeismicStore();
  const {
    colormap, brightness, contrast, displayMode, gain, agcWindow, wiggleOverlap, wigglePolarity,
    pickMode, showCrosshair, inlineIndex, crosslineIndex, timeIndex,
    setInlineIndex, setCrosslineIndex, setTimeIndex, setCursorPosition, crosshairPosition, setCrosshairPosition, setSliceIndices,
  } = useViewerStore();
  const { activeTool, horizons, faults, activeHorizonId, addPickPoint, isPicking, currentPickPoints, startPicking, finishPicking, cancelPicking, removeLastPickPoint } = useInterpretationStore();
  
  const dataset = datasets.find((d) => d.id === activeDatasetId);
  const dataLoaded = dataProvider?.isLoaded ?? false;
  
  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);
  const [sliceData, setSliceData] = useState<SeismicSliceData | null>(null);
  const [processedData, setProcessedData] = useState<Float32Array | null>(null);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [jumpInputValue, setJumpInputValue] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  
  const index = type === 'inline' ? inlineIndex : type === 'crossline' ? crosslineIndex : timeIndex;
  const setIndex = type === 'inline' ? setInlineIndex : type === 'crossline' ? setCrosslineIndex : setTimeIndex;
  
  const title = type === 'inline' ? 'Inline' : type === 'crossline' ? 'Crossline' : 'Time Slice';
  const axisLabel = type === 'inline' ? 'Inline' : type === 'crossline' ? 'Crossline' : 'Time';
  const isProfile = type !== 'timeslice';
  
  const PLOT_MARGIN_LEFT = 55;
  const PLOT_MARGIN_TOP = 28;
  const PLOT_MARGIN_RIGHT = 48;
  const PLOT_MARGIN_BOTTOM = 35;

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

  const timeStart = dataset?.timeStart ?? 0;
  const inlineStart = dataset?.inlineStart ?? 0;
  const crosslineStart = dataset?.crosslineStart ?? 0;
  const inlineStep = dataset?.inlineStep ?? 1;
  const crosslineStep = dataset?.crosslineStep ?? 1;
  const sampleInterval = dataset?.sampleInterval ?? 4;

  const getPlotDimensions = useCallback((rect: DOMRect) => {
    const plotWidth = rect.width - PLOT_MARGIN_LEFT - PLOT_MARGIN_RIGHT;
    const plotHeight = rect.height - PLOT_MARGIN_TOP - PLOT_MARGIN_BOTTOM;
    const scaledWidth = plotWidth * viewTransform.scale;
    const scaledHeight = plotHeight * viewTransform.scale;
    const offsetX = PLOT_MARGIN_LEFT + viewTransform.offsetX + (plotWidth - scaledWidth) / 2;
    const offsetY = PLOT_MARGIN_TOP + viewTransform.offsetY + (plotHeight - scaledHeight) / 2;
    return { plotWidth, plotHeight, scaledWidth, scaledHeight, offsetX, offsetY };
  }, [viewTransform]);

  const zoomIn = useCallback(() => {
    setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.25, 16) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewTransform(prev => {
      const newScale = Math.max(prev.scale / 1.25, 0.5);
      if (newScale <= 1) return { scale: 1, offsetX: 0, offsetY: 0 };
      return { ...prev, scale: newScale };
    });
  }, []);

  const resetView = useCallback(() => {
    setViewTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  }, []);
  
  const getDataCoordinates = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container || !dataset || !sliceData || !processedData) return null;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const { scaledWidth, scaledHeight, offsetX, offsetY } = getPlotDimensions(rect);
    const { width: dataWidth, height: dataHeight } = sliceData;
    if (dataWidth === 0 || dataHeight === 0) return null;
    
    const relX = x - offsetX;
    const relY = y - offsetY;
    
    if (relX < 0 || relX > scaledWidth || relY < 0 || relY > scaledHeight) return null;
    
    const dataX = Math.max(0, Math.min(dataWidth - 1, Math.floor((relX / scaledWidth) * dataWidth)));
    const dataY = Math.max(0, Math.min(dataHeight - 1, Math.floor((relY / scaledHeight) * dataHeight)));
    
    const dataIdx = type === 'timeslice' ? dataY * dataWidth + dataX : dataX * dataHeight + dataY;
    const safeIdx = Math.min(Math.max(0, dataIdx), processedData.length - 1);
    const value = processedData[safeIdx];
    
    let worldX: number, worldY: number;
    if (type === 'timeslice') {
      worldX = inlineStart + dataX * inlineStep;
      worldY = crosslineStart + dataY * crosslineStep;
    } else if (type === 'inline') {
      worldX = crosslineStart + dataX * crosslineStep;
      worldY = timeStart + dataY * sampleInterval;
    } else {
      worldX = inlineStart + dataX * inlineStep;
      worldY = timeStart + dataY * sampleInterval;
    }
    
    return { dataX, dataY, value, worldX, worldY, plotX: relX, plotY: relY };
  }, [type, dataset, sliceData, processedData, getPlotDimensions, inlineStart, crosslineStart, timeStart, inlineStep, crosslineStep, sampleInterval]);

  useEffect(() => {
    if (dataLoaded && dataset) {
      const data = getSlice(type, index);
      setSliceData(data);
    } else {
      setSliceData(null);
      setProcessedData(null);
    }
  }, [type, index, getSlice, dataLoaded, dataset]);

  useEffect(() => {
    if (!sliceData || !sliceData.data) {
      setProcessedData(null);
      return;
    }
    
    let data = sliceData.data;
    const { width, height } = sliceData;
    
    data = applyGain(data, gain);
    
    if (agcWindow > 0 && displayMode !== 'vd') {
      data = applyAGC(data, width, Math.min(agcWindow, height));
    }
    
    setProcessedData(data);
  }, [sliceData, gain, agcWindow, displayMode]);

  useEffect(() => {
    if (showJumpInput && jumpInputRef.current) {
      jumpInputRef.current.focus();
      jumpInputRef.current.select();
    }
  }, [showJumpInput]);

  const handleJumpSubmit = useCallback(() => {
    if (!dataset) return;
    const val = parseInt(jumpInputValue);
    if (isNaN(val)) {
      setShowJumpInput(false);
      return;
    }
    
    if (type === 'inline') {
      const idx = Math.round((val - inlineStart) / inlineStep);
      setIndex(Math.max(0, Math.min(maxIndex, idx)));
    } else if (type === 'crossline') {
      const idx = Math.round((val - crosslineStart) / crosslineStep);
      setIndex(Math.max(0, Math.min(maxIndex, idx)));
    } else {
      const idx = Math.round((val - timeStart) / sampleInterval);
      setIndex(Math.max(0, Math.min(maxIndex, idx)));
    }
    setShowJumpInput(false);
    setJumpInputValue('');
  }, [dataset, type, jumpInputValue, inlineStart, crosslineStart, timeStart, inlineStep, crosslineStep, sampleInterval, maxIndex, setIndex]);

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
    if (!canvas || !container || !dataset || !dataLoaded || !sliceData || !processedData) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width: dataWidth, height: dataHeight, minValue, maxValue } = sliceData;
    
    if (dataWidth === 0 || dataHeight === 0 || processedData.length === 0) return;
    if (typeof minValue !== 'number' || typeof maxValue !== 'number') return;
    
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    const { plotWidth, plotHeight, scaledWidth, scaledHeight, offsetX, offsetY } = getPlotDimensions(rect);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX, offsetY, scaledWidth, scaledHeight);
    
    const sx = scaledWidth / dataWidth;
    const sy = scaledHeight / dataHeight;
    
    const isProfile = type !== 'timeslice';
    
    if (!isProfile || displayMode === 'vd' || displayMode === 'wiggle_va') {
      let imageData: Uint8ClampedArray;
      
      if (type === 'timeslice') {
        imageData = new Uint8ClampedArray(dataWidth * dataHeight * 4);
        for (let i = 0; i < processedData.length; i++) {
          const [r, g, b] = getColormapColor(processedData[i], minValue * gain, maxValue * gain, colormap);
          imageData[i * 4] = Math.round(r * 255);
          imageData[i * 4 + 1] = Math.round(g * 255);
          imageData[i * 4 + 2] = Math.round(b * 255);
          imageData[i * 4 + 3] = 255;
        }
      } else {
        imageData = new Uint8ClampedArray(dataWidth * dataHeight * 4);
        for (let y = 0; y < dataHeight; y++) {
          for (let x = 0; x < dataWidth; x++) {
            const srcIdx = x * dataHeight + y;
            const dstIdx = (y * dataWidth + x) * 4;
            const [r, g, b] = getColormapColor(processedData[srcIdx], minValue * gain, maxValue * gain, colormap);
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
      tempCanvas.width = dataWidth;
      tempCanvas.height = dataHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        const imgData = new ImageData(imageData, dataWidth, dataHeight);
        tempCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = viewTransform.scale <= 2;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = displayMode === 'wiggle_va' ? 0.5 : 1;
        ctx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.globalAlpha = 1;
      }
    }
    
    if (isProfile && (displayMode === 'wiggle' || displayMode === 'va' || displayMode === 'wiggle_va')) {
      const traceSpacing = scaledWidth / dataWidth;
      const wiggleAmp = traceSpacing * (0.5 + wiggleOverlap) * 2;
      const maxAbs = Math.max(Math.abs(minValue * gain), Math.abs(maxValue * gain));
      
      ctx.lineWidth = Math.max(0.5, 0.8);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      const traceStep = Math.max(1, Math.floor(1 / Math.max(sx, 0.5)));
      
      for (let x = 0; x < dataWidth; x += traceStep) {
        const traceX = offsetX + x * sx;
        
        ctx.beginPath();
        ctx.strokeStyle = wigglePolarity === 'negative' ? '#0066ff' : '#ff3333';
        
        let firstPoint = true;
        let prevY = 0;
        let prevVal = 0;
        
        for (let y = 0; y < dataHeight; y++) {
          const idx = x * dataHeight + y;
          const val = processedData[idx];
          const normalizedVal = val / (maxAbs || 1);
          const wiggleX = traceX + normalizedVal * wiggleAmp;
          const plotY = offsetY + y * sy;
          
          if (firstPoint) {
            ctx.moveTo(wiggleX, plotY);
            firstPoint = false;
          } else {
            ctx.lineTo(wiggleX, plotY);
          }
          
          prevY = plotY;
          prevVal = normalizedVal;
        }
        ctx.stroke();
        
        if (displayMode === 'va' || displayMode === 'wiggle_va') {
          const fillPositive = wigglePolarity === 'positive' || wigglePolarity === 'both';
          const fillNegative = wigglePolarity === 'negative' || wigglePolarity === 'both';
          
          if (fillPositive || fillNegative) {
            ctx.beginPath();
            let started = false;
            let startY = 0;
            
            for (let y = 0; y <= dataHeight; y++) {
              const idx = x * dataHeight + Math.min(y, dataHeight - 1);
              const val = y < dataHeight ? processedData[idx] : 0;
              const normalizedVal = val / (maxAbs || 1);
              const wiggleX = traceX + normalizedVal * wiggleAmp;
              const plotY = offsetY + y * sy;
              
              if (fillPositive && normalizedVal > 0) {
                if (!started) {
                  ctx.moveTo(traceX, plotY);
                  started = true;
                  startY = plotY;
                }
                ctx.lineTo(wiggleX, plotY);
              } else if (started && fillPositive) {
                ctx.lineTo(traceX, plotY);
                ctx.closePath();
                ctx.fillStyle = 'rgba(220, 60, 60, 0.7)';
                ctx.fill();
                started = false;
              }
              
              if (fillNegative && normalizedVal < 0) {
                if (!started) {
                  ctx.moveTo(traceX, plotY);
                  started = true;
                  startY = plotY;
                }
                ctx.lineTo(wiggleX, plotY);
              } else if (started && fillNegative) {
                ctx.lineTo(traceX, plotY);
                ctx.closePath();
                ctx.fillStyle = 'rgba(60, 100, 220, 0.7)';
                ctx.fill();
                started = false;
              }
            }
            
            if (started) {
              ctx.lineTo(traceX, offsetY + scaledHeight);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }
      
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < dataWidth; x += traceStep * 5) {
        const traceX = offsetX + x * sx;
        ctx.moveTo(traceX, offsetY);
        ctx.lineTo(traceX, offsetY + scaledHeight);
      }
      ctx.stroke();
    }
    
    horizons.filter(h => h.visible).forEach(horizon => {
      ctx.strokeStyle = horizon.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      let started = false;
      const points = horizon.points.filter(p => {
        if (type === 'inline') {
          const il = Math.round((p.x - inlineStart) / inlineStep);
          return Math.abs(il - index) < 2;
        } else if (type === 'crossline') {
          const xl = Math.round((p.y - crosslineStart) / crosslineStep);
          return Math.abs(xl - index) < 2;
        } else {
          const t = Math.round((p.z - timeStart) / sampleInterval);
          return Math.abs(t - index) < 2;
        }
      });
      
      points.forEach((p) => {
        let px: number, py: number;
        if (type === 'timeslice') {
          const dx = Math.round((p.x - inlineStart) / inlineStep);
          const dy = Math.round((p.y - crosslineStart) / crosslineStep);
          px = offsetX + dx * sx;
          py = offsetY + dy * sy;
        } else if (type === 'inline') {
          const dx = Math.round((p.y - crosslineStart) / crosslineStep);
          const dy = Math.round((p.z - timeStart) / sampleInterval);
          px = offsetX + dx * sx;
          py = offsetY + dy * sy;
        } else {
          const dx = Math.round((p.x - inlineStart) / inlineStep);
          const dy = Math.round((p.z - timeStart) / sampleInterval);
          px = offsetX + dx * sx;
          py = offsetY + dy * sy;
        }
        
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      
      ctx.fillStyle = horizon.color;
      ctx.font = 'bold 9px sans-serif';
      if (points.length > 0) {
        const p = points[0];
        let px: number, py: number;
        if (type === 'inline') {
          px = offsetX + Math.round((p.y - crosslineStart) / crosslineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy - 4;
        } else if (type === 'crossline') {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy - 4;
        } else {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.y - crosslineStart) / crosslineStep) * sy - 4;
        }
        ctx.fillText(horizon.name, px, py);
      }
    });
    
    faults.filter(f => f.visible).forEach(fault => {
      ctx.strokeStyle = fault.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      
      const points = fault.vertices.filter(p => {
        if (type === 'inline') {
          return Math.abs(Math.round((p.x - inlineStart) / inlineStep) - index) < 3;
        } else if (type === 'crossline') {
          return Math.abs(Math.round((p.y - crosslineStart) / crosslineStep) - index) < 3;
        } else {
          return Math.abs(Math.round((p.z - timeStart) / sampleInterval) - index) < 3;
        }
      });
      
      let started = false;
      points.forEach(p => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.y - crosslineStart) / crosslineStep) * sy;
        } else if (type === 'inline') {
          px = offsetX + Math.round((p.y - crosslineStart) / crosslineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
        } else {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
        }
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });
    
    if (isPicking && currentPickPoints.length > 0) {
      const color = activeTool === 'horizon' 
        ? horizons.find(h => h.id === activeHorizonId)?.color || '#f59e0b'
        : '#ef4444';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      currentPickPoints.forEach((p, i) => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.y - crosslineStart) / crosslineStep) * sy;
        } else if (type === 'inline') {
          px = offsetX + Math.round((p.y - crosslineStart) / crosslineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
        } else {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
        }
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      
      currentPickPoints.forEach(p => {
        let px: number, py: number;
        if (type === 'timeslice') {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.y - crosslineStart) / crosslineStep) * sy;
        } else if (type === 'inline') {
          px = offsetX + Math.round((p.y - crosslineStart) / crosslineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
        } else {
          px = offsetX + Math.round((p.x - inlineStart) / inlineStep) * sx;
          py = offsetY + Math.round((p.z - timeStart) / sampleInterval) * sy;
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
        const px = offsetX + p.dataX * sx;
        const py = offsetY + p.dataY * sy;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      
      measurePoints.forEach(p => {
        const px = offsetX + p.dataX * sx;
        const py = offsetY + p.dataY * sy;
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
            const dx = curr.worldX - prev.worldX;
            const dy = curr.worldY - prev.worldY;
            dist = Math.sqrt(dx * dx + dy * dy);
          } else {
            const dx = type === 'inline' ? curr.worldX - prev.worldX : curr.worldX - prev.worldX;
            const dy = curr.worldY - prev.worldY;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          totalDist += dist;
        }
        
        const last = measurePoints[measurePoints.length - 1];
        const px = offsetX + last.dataX * sx;
        const py = offsetY + last.dataY * sy - 12;
        const distText = type === 'timeslice' ? `${totalDist.toFixed(1)} m` : `${totalDist.toFixed(1)} ms`;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.font = '10px monospace';
        const tw = ctx.measureText(distText).width + 10;
        ctx.fillRect(px - tw / 2, py - 10, tw, 16);
        ctx.fillStyle = '#22d3ee';
        ctx.textAlign = 'center';
        ctx.fillText(distText, px, py + 2);
        ctx.textAlign = 'left';
      }
    }
    
    if (crosshairPosition && showCrosshair) {
      let chX: number, chY: number;
      const timeStartVal = timeStart;
      
      if (type === 'inline') {
        const crossIl = crosshairPosition.x;
        const crossXl = crosshairPosition.y;
        const crossT = crosshairPosition.z;
        if (Math.abs(Math.round((crossIl - inlineStart) / inlineStep) - index) > 2) {
        } else {
          chX = offsetX + Math.round((crossXl - crosslineStart) / crosslineStep) * sx;
          chY = offsetY + Math.round((crossT - timeStartVal) / sampleInterval) * sy;
        }
      } else if (type === 'crossline') {
        const crossIl = crosshairPosition.x;
        const crossXl = crosshairPosition.y;
        const crossT = crosshairPosition.z;
        if (Math.abs(Math.round((crossXl - crosslineStart) / crosslineStep) - index) > 2) {
        } else {
          chX = offsetX + Math.round((crossIl - inlineStart) / inlineStep) * sx;
          chY = offsetY + Math.round((crossT - timeStartVal) / sampleInterval) * sy;
        }
      } else {
        const crossIl = crosshairPosition.x;
        const crossXl = crosshairPosition.y;
        chX = offsetX + Math.round((crossIl - inlineStart) / inlineStep) * sx;
        chY = offsetY + Math.round((crossXl - crosslineStart) / crosslineStep) * sy;
      }
      
      if (chX !== undefined && chY !== undefined &&
          chX >= offsetX && chX <= offsetX + scaledWidth &&
          chY >= offsetY && chY <= offsetY + scaledHeight) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.moveTo(chX, offsetY);
        ctx.lineTo(chX, offsetY + scaledHeight);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(offsetX, chY);
        ctx.lineTo(offsetX + scaledWidth, chY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.arc(chX, chY, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    
    if (cursorInfo) {
      const cx = offsetX + cursorInfo.dataX * sx;
      const cy = offsetY + cursorInfo.dataY * sy;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, offsetY);
      ctx.lineTo(cx, offsetY + scaledHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offsetX, cy);
      ctx.lineTo(offsetX + scaledWidth, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    ctx.strokeStyle = '#52607a';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
    
    ctx.fillStyle = '#7a88a0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const ticks = 6;
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 0.5;
    
    if (type === 'timeslice') {
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const x = offsetX + scaledWidth * t;
        const val = Math.round(inlineStart + (sliceData.width - 1) * inlineStep * t);
        
        ctx.beginPath();
        ctx.moveTo(x, offsetY + scaledHeight);
        ctx.lineTo(x, offsetY + scaledHeight + 4);
        ctx.stroke();
        ctx.fillText(val.toString(), x, offsetY + scaledHeight + 16);
        
        if (i > 0 && i < ticks) {
          ctx.beginPath();
          ctx.moveTo(x, offsetY);
          ctx.lineTo(x, offsetY + scaledHeight);
          ctx.strokeStyle = 'rgba(100,110,130,0.15)';
          ctx.stroke();
          ctx.strokeStyle = '#3a4560';
        }
        
        const y = offsetY + scaledHeight * t;
        const yVal = Math.round(crosslineStart + (sliceData.height - 1) * crosslineStep * t);
        
        ctx.beginPath();
        ctx.moveTo(offsetX - 4, y);
        ctx.lineTo(offsetX, y);
        ctx.stroke();
        
        ctx.save();
        ctx.translate(PLOT_MARGIN_LEFT - 8, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(yVal.toString(), 0, 0);
        ctx.restore();
        
        if (i > 0 && i < ticks) {
          ctx.beginPath();
          ctx.moveTo(offsetX, y);
          ctx.lineTo(offsetX + scaledWidth, y);
          ctx.strokeStyle = 'rgba(100,110,130,0.15)';
          ctx.stroke();
          ctx.strokeStyle = '#3a4560';
        }
      }
      
      ctx.save();
      ctx.fillStyle = '#8898b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Inline', offsetX + scaledWidth / 2, rect.height - 6);
      ctx.translate(12, offsetY + scaledHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Crossline', 0, 0);
      ctx.restore();
    } else {
      const xStart = type === 'inline' ? crosslineStart : inlineStart;
      const xEnd = type === 'inline' 
        ? crosslineStart + (sliceData.width - 1) * crosslineStep
        : inlineStart + (sliceData.width - 1) * inlineStep;
      
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const x = offsetX + scaledWidth * t;
        const val = Math.round(xStart + (xEnd - xStart) * t);
        
        ctx.beginPath();
        ctx.moveTo(x, offsetY + scaledHeight);
        ctx.lineTo(x, offsetY + scaledHeight + 4);
        ctx.stroke();
        ctx.fillText(val.toString(), x, offsetY + scaledHeight + 16);
        
        if (i > 0 && i < ticks) {
          ctx.beginPath();
          ctx.moveTo(x, offsetY);
          ctx.lineTo(x, offsetY + scaledHeight);
          ctx.strokeStyle = 'rgba(100,110,130,0.15)';
          ctx.stroke();
          ctx.strokeStyle = '#3a4560';
        }
      }
      
      for (let i = 0; i <= ticks; i++) {
        const t = i / ticks;
        const y = offsetY + scaledHeight * t;
        const timeVal = Math.round(timeStart + (sliceData.height - 1) * sampleInterval * t);
        
        ctx.beginPath();
        ctx.moveTo(offsetX - 4, y);
        ctx.lineTo(offsetX, y);
        ctx.stroke();
        
        ctx.save();
        ctx.translate(PLOT_MARGIN_LEFT - 8, y + 3);
        ctx.textAlign = 'right';
        ctx.fillText(timeVal + '', 0, 0);
        ctx.restore();
        
        if (i > 0 && i < ticks) {
          ctx.beginPath();
          ctx.moveTo(offsetX, y);
          ctx.lineTo(offsetX + scaledWidth, y);
          ctx.strokeStyle = 'rgba(100,110,130,0.15)';
          ctx.stroke();
          ctx.strokeStyle = '#3a4560';
        }
      }
      
      ctx.save();
      ctx.fillStyle = '#8898b8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(type === 'inline' ? 'Crossline' : 'Inline', offsetX + scaledWidth / 2, rect.height - 6);
      ctx.translate(12, offsetY + scaledHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Time (ms)', 0, 0);
      ctx.restore();
    }
    
    ctx.textAlign = 'left';
    
    if (viewTransform.scale > 1) {
      ctx.fillStyle = '#22d3ee';
      ctx.font = '10px monospace';
      ctx.fillText(`${(viewTransform.scale * 100).toFixed(0)}%`, offsetX + 5, offsetY + 14);
    }
    
  }, [type, index, colormap, brightness, contrast, getSlice, horizons, faults, activeHorizonId, isPicking, currentPickPoints, activeTool, measurePoints, dataset, dataLoaded, sliceData, processedData, viewTransform, displayMode, gain, agcWindow, wiggleOverlap, wigglePolarity, crosshairPosition, showCrosshair, cursorInfo, getPlotDimensions, inlineStart, crosslineStart, timeStart, inlineStep, crosslineStep, sampleInterval]);
  
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
        dataX: coords.dataX,
        dataY: coords.dataY,
        worldX: coords.worldX,
        worldY: coords.worldY,
        value: coords.value,
        plotX: coords.plotX,
        plotY: coords.plotY,
      });
      
      let cursorInline: number, cursorCrossline: number, cursorTime: number;
      
      if (type === 'inline') {
        cursorInline = inlineStart + index * inlineStep;
        cursorCrossline = coords.worldX;
        cursorTime = coords.worldY;
      } else if (type === 'crossline') {
        cursorInline = coords.worldX;
        cursorCrossline = crosslineStart + index * crosslineStep;
        cursorTime = coords.worldY;
      } else {
        cursorInline = coords.worldX;
        cursorCrossline = coords.worldY;
        cursorTime = timeStart + index * sampleInterval;
      }
      
      const pos = { x: cursorInline, y: cursorCrossline, z: cursorTime };
      setCursorPosition({ inline: cursorInline, crossline: cursorCrossline, time: cursorTime, value: coords.value });
      setCrosshairPosition(pos);
    } else {
      setCursorInfo(null);
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && activeTool === 'pan')) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, offsetX: viewTransform.offsetX, offsetY: viewTransform.offsetY });
    }
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };
  
  const handleClick = (e: React.MouseEvent) => {
    if (isPanning) return;
    
    const coords = getDataCoordinates(e.clientX, e.clientY);
    if (!coords || !sliceData || !processedData) return;
    
    if (activeTool === 'horizon' || activeTool === 'fault') {
      if (!isPicking) startPicking();
      
      let dataY = coords.dataY;
      const { width, height } = sliceData;
      
      if (pickMode === 'peak' && isProfile) {
        dataY = findPeak(processedData, width, height, coords.dataX, coords.dataY, 5);
      } else if (pickMode === 'trough' && isProfile) {
        dataY = findTrough(processedData, width, height, coords.dataX, coords.dataY, 5);
      }
      
      let point: Point3D;
      
      if (type === 'timeslice') {
        point = { x: coords.worldX, y: coords.worldY, z: timeStart + index * sampleInterval };
      } else if (type === 'inline') {
        point = {
          x: inlineStart + index * inlineStep,
          y: coords.worldX,
          z: timeStart + dataY * sampleInterval,
        };
      } else {
        point = {
          x: coords.worldX,
          y: crosslineStart + index * crosslineStep,
          z: timeStart + dataY * sampleInterval,
        };
      }
      
      addPickPoint(point);
    }
    
    if (activeTool === 'measure') {
      setMeasurePoints(prev => [...prev, {
        dataX: coords.dataX,
        dataY: coords.dataY,
        worldX: coords.worldX,
        worldY: coords.worldY,
        value: coords.value,
      }]);
    }
  };
  
  const handleDoubleClick = () => {
    if ((activeTool === 'horizon' || activeTool === 'fault') && isPicking) {
      finishPicking();
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((activeTool === 'horizon' || activeTool === 'fault') && isPicking) cancelPicking();
    if (activeTool === 'measure') setMeasurePoints([]);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (e.ctrlKey || e.metaKey || activeTool === 'zoom') {
      const delta = e.deltaY > 0 ? 0.85 : 1.18;
      setViewTransform(prev => {
        const newScale = Math.max(0.5, Math.min(16, prev.scale * delta));
        if (newScale <= 1) return { scale: 1, offsetX: 0, offsetY: 0 };
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
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeLastPickPoint(); }
        if (e.key === 'Enter') { e.preventDefault(); finishPicking(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelPicking(); }
      }

      if (activeTool === 'measure') {
        if (e.key === 'Escape') { e.preventDefault(); setMeasurePoints([]); }
        if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setMeasurePoints(prev => prev.slice(0, -1)); }
      }
      
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      if (e.key === '-') { e.preventDefault(); zoomOut(); }
      if (e.key === '0') { e.preventDefault(); resetView(); }
      
      if (e.key === 'g' || e.key === 'G') {
        if (!showJumpInput) { setShowJumpInput(true); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, isPicking, removeLastPickPoint, finishPicking, cancelPicking, zoomIn, zoomOut, resetView, showJumpInput]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div 
      ref={containerRef} 
      className={cn('relative bg-[#0a0f1a] overflow-hidden select-none', className || '')}
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
      
          <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-900/90 rounded text-[11px] text-slate-300 backdrop-blur-sm border border-slate-700/50">
              <div className={cn('w-2 h-2 rounded-full',
                type === 'inline' ? 'bg-blue-500' : type === 'crossline' ? 'bg-green-500' : 'bg-amber-500'
              )} />
              <span className="font-semibold">{title}</span>
              {showJumpInput ? (
                <input
                  ref={jumpInputRef}
                  type="number"
                  value={jumpInputValue}
                  onChange={(e) => setJumpInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJumpSubmit(); if (e.key === 'Escape') { setShowJumpInput(false); setJumpInputValue(''); } }}
                  onBlur={handleJumpSubmit}
                  className="w-16 px-1 py-0.5 bg-slate-800 border border-cyan-500/50 rounded text-cyan-300 text-[11px] font-mono outline-none"
                  placeholder={Math.round(sliceNumber).toString()}
                />
              ) : (
                <span
                  className="font-mono text-slate-200 font-semibold cursor-pointer hover:text-cyan-400 transition-colors px-1 rounded"
                  onClick={() => setShowJumpInput(true)}
                  title="点击跳转道号 (G)"
                >
                  {Math.round(sliceNumber)}{sliceUnit}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-0.5">
              {DISPLAY_MODES.map(mode => (
                <button
                  key={mode.id}
                  className={cn(
                    'p-1.5 rounded transition-colors text-[10px] flex items-center gap-1',
                    displayMode === mode.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900/90 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    useViewerStore.getState().setDisplayMode(mode.id);
                  }}
                  title={mode.label}
                >
                  {mode.icon}
                  <span className="hidden lg:inline">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.max(0, index - 10)); }}
              title="后退10"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.max(0, index - 1)); }}
              title="上一个"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="px-3 py-1 bg-slate-900/90 rounded text-[10px] text-slate-400 font-mono min-w-[80px] text-center backdrop-blur-sm">
              {index + 1} / {maxIndex + 1}
            </div>
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.min(maxIndex, index + 1)); }}
              title="下一个"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setIndex(Math.min(maxIndex, index + 10)); }}
              title="前进10"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); zoomOut(); }}
              title="缩小 (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); zoomIn(); }}
              title="放大 (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); resetView(); }}
              title="重置 (0)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            
            {(activeTool === 'horizon' || activeTool === 'fault') && (
              <div className="flex items-center gap-0.5 ml-1 px-1 py-0.5 bg-slate-900/90 rounded backdrop-blur-sm">
                <span className="text-[9px] text-slate-500 mr-1">拾取:</span>
                {(['manual', 'peak', 'trough'] as const).map(pm => (
                  <button
                    key={pm}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] transition-colors',
                      pickMode === pm ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    )}
                    onClick={(e) => { e.stopPropagation(); useViewerStore.getState().setPickMode(pm); }}
                    title={pm === 'manual' ? '手动拾取' : pm === 'peak' ? '波峰' : '波谷'}
                  >
                    {pm === 'manual' ? '手' : pm === 'peak' ? '峰' : '谷'}
                  </button>
                ))}
              </div>
            )}
            
            {activeTool === 'measure' && measurePoints.length > 0 && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button
                  className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); setMeasurePoints(prev => prev.slice(0, -1)); }}
                  title="撤销"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); setMeasurePoints([]); }}
                  title="清除"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            
            {(activeTool === 'horizon' || activeTool === 'fault') && isPicking && (
              <>
                <div className="w-px h-4 bg-slate-700 mx-1" />
                <button
                  className="p-1.5 bg-slate-900/90 rounded text-green-400 hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); finishPicking(); }}
                  title="完成 (Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1.5 bg-slate-900/90 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); cancelPicking(); }}
                  title="取消 (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          
          {dataLoaded && sliceData && (
            <div className="absolute right-2 top-14 bottom-14 w-8 flex flex-col z-10">
              <div className="text-[9px] text-slate-500 text-center mb-1 font-mono">
                {(sliceData.maxValue * gain).toFixed(1)}
              </div>
              <canvas
                ref={colorbarCanvasRef}
                className="w-full flex-1 rounded"
                style={{ minHeight: '80px' }}
              />
              <div className="text-[9px] text-slate-500 text-center mt-1 font-mono">
                {(sliceData.minValue * gain).toFixed(1)}
              </div>
            </div>
          )}
          
          {cursorInfo && (
            <div className="absolute bottom-2 left-2 px-3 py-2 bg-slate-900/95 rounded text-[10px] text-slate-300 z-10 font-mono space-y-0.5 min-w-[170px] backdrop-blur-sm border border-slate-700/50">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">
                  {type === 'timeslice' ? 'Inline:' : type === 'inline' ? 'Crossline:' : 'Inline:'}
                </span>
                <span className="text-cyan-400">{Math.round(cursorInfo.worldX)}</span>
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
            滚轮切片 | Ctrl+滚轮缩放 | 中键平移 | G 跳转道号
          </div>
          
          {(activeTool === 'horizon' || activeTool === 'fault') && !isPicking && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/95 rounded text-[10px] text-slate-400 z-10 backdrop-blur-sm border border-amber-500/20">
              单击拾取 | 双击/Enter完成 | 右键/Esc取消 | 拾取模式: {pickMode === 'manual' ? '手动' : pickMode === 'peak' ? '波峰' : '波谷'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

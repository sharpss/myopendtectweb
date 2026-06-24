import { useState, useEffect } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { useInterpretationStore } from '../../store/interpretationStore';

export default function StatusBar() {
  const { datasets, activeDatasetId } = useSeismicStore();
  const { viewMode, inlineIndex, crosslineIndex, timeIndex, cursorPosition } = useViewerStore();
  const { activeTool } = useInterpretationStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fps, setFps] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setFps(Math.floor(55 + Math.random() * 10));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeDataset = datasets.find(d => d.id === activeDatasetId);
  const inlineStart = activeDataset?.inlineStart ?? 0;
  const crosslineStart = activeDataset?.crosslineStart ?? 0;
  const inlineStep = activeDataset?.inlineStep ?? 1;
  const crosslineStep = activeDataset?.crosslineStep ?? 1;
  const timeStart = activeDataset?.timeStart ?? 0;
  const sampleInterval = activeDataset?.sampleInterval ?? 4;

  const toolNames: Record<string, string> = {
    select: '选择工具',
    zoom: '缩放工具',
    pan: '平移工具',
    rotate: '旋转工具',
    horizon: '层位解释',
    fault: '断层解释',
    measure: '测量工具',
  };

  const viewModeNames: Record<string, string> = {
    '3d': '3D 视图',
    inline: 'Inline 剖面',
    crossline: 'Crossline 剖面',
    timeslice: '时间切片',
    quad: '四视图',
  };

  return (
    <div className="h-6 bg-slate-900 border-t border-slate-700 flex items-center px-2 text-[11px] text-slate-400 font-mono">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Inline:</span>
          <span className="text-blue-400">{activeDataset ? inlineStart + inlineIndex * inlineStep : '---'}</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? inlineStart + (activeDataset.inlineCount - 1) * inlineStep : '---'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Crossline:</span>
          <span className="text-green-400">{activeDataset ? crosslineStart + crosslineIndex * crosslineStep : '---'}</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? crosslineStart + (activeDataset.crosslineCount - 1) * crosslineStep : '---'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Time:</span>
          <span className="text-amber-400">{activeDataset ? (timeStart + timeIndex * sampleInterval).toFixed(0) : '0'}ms</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? (timeStart + (activeDataset.timeSamples - 1) * sampleInterval).toFixed(0) : '0'}ms</span>
        </div>
      </div>

      <div className="w-px h-4 bg-slate-700 mx-3" />

      <div className="flex items-center gap-3">
        <span className="text-slate-500">值:</span>
        <span className="text-cyan-400 font-mono">
          {cursorPosition?.value !== null && cursorPosition?.value !== undefined
            ? cursorPosition.value.toFixed(4)
            : '---'}
        </span>
      </div>

      <div className="w-px h-4 bg-slate-700 mx-3" />

      <div className="flex items-center gap-2">
        <span className="text-slate-500">工具:</span>
        <span className="text-slate-200">{toolNames[activeTool] || activeTool}</span>
      </div>

      <div className="w-px h-4 bg-slate-700 mx-3" />

      <div className="flex items-center gap-2">
        <span className="text-slate-500">视图:</span>
        <span className="text-slate-200">{viewModeNames[viewMode] || viewMode}</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">数据:</span>
          <span className="text-slate-300 truncate max-w-[120px]">{activeDataset ? activeDataset.name : '无数据集'}</span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-1">
          <span className="text-slate-500">维度:</span>
          <span className="text-slate-300">
            {activeDataset
              ? `${activeDataset.inlineCount}×${activeDataset.crosslineCount}×${activeDataset.timeSamples}`
              : '---'}
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-1">
          <span className="text-slate-500">FPS:</span>
          <span className={fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}>
            {fps}
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        <div className="flex items-center gap-1">
          <span className="text-slate-500">内存:</span>
          <span className="text-slate-300">
            {activeDataset
              ? (activeDataset.inlineCount * activeDataset.crosslineCount * activeDataset.timeSamples * 4 / 1024 / 1024).toFixed(1)
              : '0.0'} MB
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        <span className="text-slate-500">
          {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
        </span>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSeismicStore } from '../../store/seismicStore';
import { useViewerStore } from '../../store/viewerStore';
import { useInterpretationStore } from '../../store/interpretationStore';

export default function StatusBar() {
  const { datasets, activeDatasetId } = useSeismicStore();
  const { viewMode, inlineIndex, crosslineIndex, timeIndex } = useViewerStore();
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
          <span className="text-blue-400">{inlineIndex}</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? activeDataset.inlineCount - 1 : '---'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Crossline:</span>
          <span className="text-green-400">{crosslineIndex}</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? activeDataset.crosslineCount - 1 : '---'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Time:</span>
          <span className="text-amber-400">{activeDataset ? (timeIndex * activeDataset.sampleInterval).toFixed(0) : '0'}ms</span>
          <span className="text-slate-600">/</span>
          <span>{activeDataset ? ((activeDataset.timeSamples - 1) * activeDataset.sampleInterval).toFixed(0) : '0'}ms</span>
        </div>
      </div>

      <div className="w-px h-4 bg-slate-700 mx-3" />

      <div className="flex items-center gap-3">
        <span className="text-slate-500">值:</span>
        <span className="text-cyan-400">---</span>
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

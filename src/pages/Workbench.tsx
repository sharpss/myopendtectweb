import { useState, useEffect } from 'react';
import MenuBar from '../components/layout/MenuBar';
import ToolBar from '../components/layout/ToolBar';
import StatusBar from '../components/layout/StatusBar';
import LeftPanel from '../components/layout/LeftPanel';
import RightPanel from '../components/layout/RightPanel';
import Viewer3D from '../components/viewer/Viewer3D';
import SliceView from '../components/viewer/SliceView';
import KeyboardShortcutsModal from '../components/common/KeyboardShortcutsModal';
import { useViewerStore } from '../store/viewerStore';
import { useThemeStore } from '../store/themeStore';
import { useKeyboardShortcuts, SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import { useInterpretationStore } from '../store/interpretationStore';
import { useSeismicStore } from '../store/seismicStore';
import { HardDrive, Loader2 } from 'lucide-react';

export default function Workbench() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const { viewMode, setViewMode, setCameraPreset } = useViewerStore();
  const { mode: themeMode, toggleTheme } = useThemeStore();
  const { undo, redo, setActiveTool } = useInterpretationStore();
  const { isLoading, loadProgress, loadDataset, datasets, activeDatasetId } = useSeismicStore();

  useEffect(() => {
    if (datasets.length > 0 && activeDatasetId) {
      loadDataset(activeDatasetId);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [themeMode]);

  useKeyboardShortcuts({
    '1': () => setViewMode('3d'),
    '2': () => setViewMode('inline'),
    '3': () => setViewMode('crossline'),
    '4': () => setViewMode('timeslice'),
    '5': () => setViewMode('quad'),
    'Q': () => setLeftCollapsed(prev => !prev),
    'W': () => setRightCollapsed(prev => !prev),
    'V': () => setActiveTool('select'),
    'M': () => setActiveTool('measure'),
    'T': () => setActiveTool('horizon'),
    'Y': () => setActiveTool('fault'),
    'Ctrl+Z': undo,
    'Ctrl+Y': redo,
    'Ctrl+Shift+L': toggleTheme,
    '?': () => setShortcutsModalOpen(true),
    '/': () => setShortcutsModalOpen(true),
  });

  const renderViewerArea = () => {
    switch (viewMode) {
      case '3d':
        return <Viewer3D className="w-full h-full" />;
      case 'inline':
        return <SliceView type="inline" className="w-full h-full" />;
      case 'crossline':
        return <SliceView type="crossline" className="w-full h-full" />;
      case 'timeslice':
        return <SliceView type="timeslice" className="w-full h-full" />;
      case 'quad':
      default:
        return (
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-slate-700">
            <Viewer3D className="w-full h-full" />
            <SliceView type="inline" className="w-full h-full" />
            <SliceView type="crossline" className="w-full h-full" />
            <SliceView type="timeslice" className="w-full h-full" />
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <MenuBar />
      <ToolBar />
      
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel 
          isCollapsed={leftCollapsed} 
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)} 
        />
        
        <div className="flex-1 relative overflow-hidden">
          {renderViewerArea()}
        </div>
        
        <RightPanel 
          isCollapsed={rightCollapsed} 
          onToggleCollapse={() => setRightCollapsed(!rightCollapsed)} 
        />
      </div>
      
      <StatusBar />

      {isLoading && loadProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 w-96">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">加载地震数据</h3>
                <p className="text-xs text-slate-400">{loadProgress.currentStage}</p>
              </div>
            </div>
            
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>进度</span>
                <span>{loadProgress.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 ease-out"
                  style={{ width: `${loadProgress.percentage}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-slate-500">
              <span>速度: {(loadProgress.speed / (1024 * 1024)).toFixed(2)} MB/s</span>
              <span>预计剩余: {Math.ceil(loadProgress.eta)}s</span>
            </div>
          </div>
        </div>
      )}

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}

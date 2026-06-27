import { useState, useEffect } from 'react';
import MenuBar from '../components/layout/MenuBar';
import ToolBar from '../components/layout/ToolBar';
import StatusBar from '../components/layout/StatusBar';
import LeftPanel from '../components/layout/LeftPanel';
import RightPanel from '../components/layout/RightPanel';
import Viewer3D from '../components/viewer/Viewer3D';
import SliceView from '../components/viewer/SliceView';
import KeyboardShortcutsModal from '../components/common/KeyboardShortcutsModal';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ToastContainer from '../components/common/Toast';
import { useViewerStore } from '../store/viewerStore';
import { useThemeStore } from '../store/themeStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSettingsPersistence } from '../hooks/useSettingsPersistence';
import { useInterpretationStore } from '../store/interpretationStore';
import { useSeismicStore } from '../store/seismicStore';

export default function Workbench() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const { viewMode, setViewMode, setCameraPreset } = useViewerStore();
  const { mode: themeMode, toggleTheme } = useThemeStore();
  const { undo, redo, setActiveTool } = useInterpretationStore();
  const { isLoading, loadProgress, loadDataset, datasets, activeDatasetId } = useSeismicStore();
  
  useSettingsPersistence();

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
      <LoadingOverlay />
      <ToastContainer />

      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}

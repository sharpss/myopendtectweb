import { useState } from 'react';
import MenuBar from '../components/layout/MenuBar';
import ToolBar from '../components/layout/ToolBar';
import StatusBar from '../components/layout/StatusBar';
import LeftPanel from '../components/layout/LeftPanel';
import RightPanel from '../components/layout/RightPanel';
import Viewer3D from '../components/viewer/Viewer3D';
import SliceView from '../components/viewer/SliceView';
import { useViewerStore } from '../store/viewerStore';

export default function Workbench() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const { viewMode } = useViewerStore();

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
    </div>
  );
}

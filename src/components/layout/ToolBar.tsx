import {
  MousePointer2,
  ZoomIn,
  Move,
  RotateCw,
  Layers,
  TrendingUp,
  GitBranch,
  Ruler,
  Grid3X3,
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Save,
  Upload,
} from 'lucide-react';
import { useInterpretationStore } from '../../store/interpretationStore';
import { useViewerStore } from '../../store/viewerStore';
import { ToolType, ViewerMode } from '../../../shared/types';
import { cn } from '../../lib/utils';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolButton({ icon, label, active, onClick, disabled }: ToolButtonProps) {
  return (
    <button
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded transition-all',
        'text-slate-300 hover:bg-slate-700 hover:text-white',
        active && 'bg-blue-600 text-white hover:bg-blue-500',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon}
    </button>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 px-1 border-r border-slate-700 last:border-r-0">
      {children}
    </div>
  );
}

export default function ToolBar() {
  const { activeTool, setActiveTool } = useInterpretationStore();
  const { viewMode, setViewMode } = useViewerStore();

  const tools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
    { type: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: '选择 (V)' },
    { type: 'zoom', icon: <ZoomIn className="w-4 h-4" />, label: '缩放 (Z)' },
    { type: 'pan', icon: <Move className="w-4 h-4" />, label: '平移 (H)' },
    { type: 'rotate', icon: <RotateCw className="w-4 h-4" />, label: '旋转 (R)' },
  ];

  const viewModes: { mode: ViewerMode; icon: React.ReactNode; label: string }[] = [
    { mode: '3d', icon: <Grid3X3 className="w-4 h-4" />, label: '3D 视图' },
    { mode: 'inline', icon: <Layers className="w-4 h-4 rotate-0" />, label: 'Inline 剖面' },
    { mode: 'crossline', icon: <Layers className="w-4 h-4 rotate-90" />, label: 'Crossline 剖面' },
    { mode: 'timeslice', icon: <Layers className="w-4 h-4 -rotate-90" />, label: '时间切片' },
    { mode: 'quad', icon: <Maximize2 className="w-4 h-4" />, label: '四视图' },
  ];

  return (
    <div className="h-9 bg-slate-800 border-b border-slate-700 flex items-center px-2">
      <ToolGroup>
        <ToolButton icon={<Save className="w-4 h-4" />} label="保存 (Ctrl+S)" />
        <ToolButton icon={<Upload className="w-4 h-4" />} label="导入 SEGY" />
        <ToolButton icon={<Undo2 className="w-4 h-4" />} label="撤销 (Ctrl+Z)" />
        <ToolButton icon={<Redo2 className="w-4 h-4" />} label="重做 (Ctrl+Y)" />
      </ToolGroup>

      <ToolGroup>
        {tools.map((tool) => (
          <ToolButton
            key={tool.type}
            icon={tool.icon}
            label={tool.label}
            active={activeTool === tool.type}
            onClick={() => setActiveTool(tool.type)}
          />
        ))}
      </ToolGroup>

      <ToolGroup>
        <ToolButton
          icon={<TrendingUp className="w-4 h-4" />}
          label="层位工具"
          active={activeTool === 'horizon'}
          onClick={() => setActiveTool('horizon')}
        />
        <ToolButton
          icon={<GitBranch className="w-4 h-4" />}
          label="断层工具"
          active={activeTool === 'fault'}
          onClick={() => setActiveTool('fault')}
        />
        <ToolButton icon={<Ruler className="w-4 h-4" />} label="测量 (M)" />
      </ToolGroup>

      <ToolGroup>
        {viewModes.map((vm) => (
          <ToolButton
            key={vm.mode}
            icon={vm.icon}
            label={vm.label}
            active={viewMode === vm.mode}
            onClick={() => setViewMode(vm.mode)}
          />
        ))}
      </ToolGroup>

      <div className="flex-1" />

      <ToolGroup>
        <ToolButton icon={<Minimize2 className="w-4 h-4" />} label="缩小" />
        <ToolButton icon={<Maximize2 className="w-4 h-4" />} label="缩放至全屏 (F)" />
      </ToolGroup>
    </div>
  );
}

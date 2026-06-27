import { useState, useRef, useEffect } from 'react';
import {
  Database,
  Layers,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings,
  GripVertical,
  Check,
  X,
  Download,
} from 'lucide-react';
import { useInterpretationStore } from '../../store/interpretationStore';
import { useSeismicStore } from '../../store/seismicStore';
import { useToastStore } from '../../store/toastStore';
import { cn } from '../../lib/utils';
import {
  downloadTextFile,
  exportHorizonsCSV,
  exportFaultsCSV,
  exportHorizonsJSON,
  exportFaultsJSON,
} from '../../utils/exportUtils';

type TabType = 'data' | 'horizons' | 'faults';

interface LeftPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const presetColors = [
  '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#14b8a6', '#6366f1',
  '#a855f7', '#ec4899', '#f43f5e', '#0ea5e9',
];

function ColorPicker({
  color,
  onChange,
  onClose,
}: {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [customColor, setCustomColor] = useState(color);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 left-6 top-0 bg-slate-700 border border-slate-600 rounded p-2 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-8 gap-1 mb-2">
        {presetColors.map((c) => (
          <button
            key={c}
            className={cn(
              'w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110',
              color === c ? 'border-white' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
            onClick={() => {
              onChange(c);
              onClose();
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-8 h-6 rounded cursor-pointer border-0"
        />
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 w-20"
          placeholder="#RRGGBB"
        />
        <button
          className="p-1 hover:bg-slate-600 rounded text-green-400"
          onClick={() => {
            onChange(customColor);
            onClose();
          }}
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function EditableName({
  name,
  onRename,
}: {
  name: string;
  onRename: (newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') {
            setEditValue(name);
            setIsEditing(false);
          }
        }}
        className="flex-1 bg-slate-600 border border-blue-500 rounded px-1 py-0.5 text-xs text-slate-100 outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="text-xs text-slate-200 flex-1 truncate cursor-text"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {name}
    </span>
  );
}

export default function LeftPanel({ isCollapsed, onToggleCollapse }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['seismic']));
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorPickerType, setColorPickerType] = useState<'horizon' | 'fault' | null>(null);

  const { datasets, activeDatasetId, setActiveDataset, removeDataset } = useSeismicStore();
  const {
    horizons,
    faults,
    activeHorizonId,
    activeFaultId,
    toggleHorizonVisible,
    toggleFaultVisible,
    setActiveHorizon,
    setActiveFault,
    addHorizon,
    addFault,
    deleteHorizon,
    deleteFault,
    updateHorizonColor,
    updateFaultColor,
    renameHorizon,
    renameFault,
  } = useInterpretationStore();
  const { addToast } = useToastStore();

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const tabs: { id: TabType; icon: React.ReactNode; label: string }[] = [
    { id: 'data', icon: <Database className="w-4 h-4" />, label: '数据' },
    { id: 'horizons', icon: <Layers className="w-4 h-4" />, label: '层位' },
    { id: 'faults', icon: <GitBranch className="w-4 h-4" />, label: '断层' },
  ];

  if (isCollapsed) {
    return (
      <div className="w-10 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-2 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded transition-colors',
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            onClick={() => {
              setActiveTab(tab.id);
              onToggleCollapse();
            }}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white rounded"
          onClick={onToggleCollapse}
          title="展开面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'flex-1 py-2 flex flex-col items-center gap-0.5 text-[10px] transition-colors',
              activeTab === tab.id
                ? 'text-blue-400 bg-slate-700/50 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'data' && (
          <div className="p-2 space-y-1">
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-700/50 cursor-pointer"
              onClick={() => toggleExpand('seismic')}
            >
              {expandedItems.has('seismic') ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-200 flex-1">地震数据</span>
            </div>
            
            {expandedItems.has('seismic') && (
              <div className="ml-4 space-y-0.5">
                {datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs group',
                      activeDatasetId === ds.id
                        ? 'bg-blue-600/30 text-blue-300'
                        : 'text-slate-400 hover:bg-slate-700/30'
                    )}
                    onClick={() => setActiveDataset(ds.id)}
                  >
                    <GripVertical className="w-3 h-3 text-slate-600" />
                    <span className="truncate flex-1">{ds.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-0.5 hover:bg-slate-600 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        title="设置"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 hover:bg-red-600/50 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataset(ds.id);
                        }}
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {datasets.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-slate-500 italic">
                    暂无数据集
                  </div>
                )}
              </div>
            )}

            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-700/50 cursor-pointer"
              onClick={() => toggleExpand('wells')}
            >
              {expandedItems.has('wells') ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
              <div className="w-4 h-4 rounded-sm border border-amber-500 border-b-0 flex items-end justify-center">
                <div className="w-1 h-2 bg-amber-500 rounded-full" />
              </div>
              <span className="text-xs text-slate-200 flex-1">井数据</span>
            </div>

            {expandedItems.has('wells') && (
              <div className="ml-4 space-y-0.5">
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 italic">
                  暂无井数据
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'horizons' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-slate-700">
              <span className="text-xs text-slate-400">共 {horizons.length} 个层位</span>
              <div className="flex items-center gap-0.5">
                {horizons.some(h => h.visible && h.points.length > 0) && (
                  <div className="relative group">
                    <button
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      title="导出层位"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block bg-slate-700 border border-slate-600 rounded shadow-lg min-w-[120px]">
                      <button
                        className="w-full px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-slate-600"
                        onClick={() => {
                          try {
                            const visibleCount = horizons.filter(h => h.visible && h.points.length > 0).length;
                            const csv = exportHorizonsCSV(horizons);
                            const timestamp = new Date().toISOString().slice(0, 10);
                            downloadTextFile(csv, `horizons_${timestamp}.csv`, 'text/csv');
                            addToast(`已导出 ${visibleCount} 个层位为 CSV`, 'success');
                          } catch (err) {
                            addToast('导出失败：' + (err as Error).message, 'error');
                          }
                        }}
                      >
                        导出为 CSV
                      </button>
                      <button
                        className="w-full px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-slate-600"
                        onClick={() => {
                          try {
                            const visibleCount = horizons.filter(h => h.visible && h.points.length > 0).length;
                            const json = exportHorizonsJSON(horizons);
                            const timestamp = new Date().toISOString().slice(0, 10);
                            downloadTextFile(json, `horizons_${timestamp}.json`, 'application/json');
                            addToast(`已导出 ${visibleCount} 个层位为 JSON`, 'success');
                          } catch (err) {
                            addToast('导出失败：' + (err as Error).message, 'error');
                          }
                        }}
                      >
                        导出为 JSON
                      </button>
                    </div>
                  </div>
                )}
                <button
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                  onClick={() => addHorizon(`Horizon ${horizons.length + 1}`)}
                  title="新建层位"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {horizons.map((horizon) => (
                <div
                  key={horizon.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group relative',
                    activeHorizonId === horizon.id
                      ? 'bg-blue-600/30 border-l-2 border-blue-500'
                      : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                  )}
                  onClick={() => setActiveHorizon(horizon.id)}
                >
                  <button
                    className="w-3 h-3 rounded-sm flex-shrink-0 relative cursor-pointer hover:ring-2 hover:ring-white/50"
                    style={{ backgroundColor: horizon.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingColorId(horizon.id);
                      setColorPickerType('horizon');
                    }}
                    title="点击修改颜色"
                  />
                  <EditableName
                    name={horizon.name}
                    onRename={(newName) => renameHorizon(horizon.id, newName)}
                  />
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-0.5 hover:bg-slate-600 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHorizonVisible(horizon.id);
                      }}
                      title={horizon.visible ? '隐藏' : '显示'}
                    >
                      {horizon.visible ? (
                        <Eye className="w-3 h-3 text-slate-300" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                    <button
                      className="p-0.5 hover:bg-red-600/50 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHorizon(horizon.id);
                      }}
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  {editingColorId === horizon.id && colorPickerType === 'horizon' && (
                    <ColorPicker
                      color={horizon.color}
                      onChange={(c) => updateHorizonColor(horizon.id, c)}
                      onClose={() => {
                        setEditingColorId(null);
                        setColorPickerType(null);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'faults' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-slate-700">
              <span className="text-xs text-slate-400">共 {faults.length} 个断层</span>
              <div className="flex items-center gap-0.5">
                {faults.some(f => f.visible && f.vertices.length > 0) && (
                  <div className="relative group">
                    <button
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      title="导出断层"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block bg-slate-700 border border-slate-600 rounded shadow-lg min-w-[120px]">
                      <button
                        className="w-full px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-slate-600"
                        onClick={() => {
                          try {
                            const visibleCount = faults.filter(f => f.visible && f.vertices.length > 0).length;
                            const csv = exportFaultsCSV(faults);
                            const timestamp = new Date().toISOString().slice(0, 10);
                            downloadTextFile(csv, `faults_${timestamp}.csv`, 'text/csv');
                            addToast(`已导出 ${visibleCount} 个断层为 CSV`, 'success');
                          } catch (err) {
                            addToast('导出失败：' + (err as Error).message, 'error');
                          }
                        }}
                      >
                        导出为 CSV
                      </button>
                      <button
                        className="w-full px-3 py-1.5 text-xs text-left text-slate-200 hover:bg-slate-600"
                        onClick={() => {
                          try {
                            const visibleCount = faults.filter(f => f.visible && f.vertices.length > 0).length;
                            const json = exportFaultsJSON(faults);
                            const timestamp = new Date().toISOString().slice(0, 10);
                            downloadTextFile(json, `faults_${timestamp}.json`, 'application/json');
                            addToast(`已导出 ${visibleCount} 个断层为 JSON`, 'success');
                          } catch (err) {
                            addToast('导出失败：' + (err as Error).message, 'error');
                          }
                        }}
                      >
                        导出为 JSON
                      </button>
                    </div>
                  </div>
                )}
                <button
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                  onClick={() => addFault(`Fault ${faults.length + 1}`)}
                  title="新建断层"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {faults.map((fault) => (
                <div
                  key={fault.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group relative',
                    activeFaultId === fault.id
                      ? 'bg-red-600/20 border-l-2 border-red-500'
                      : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                  )}
                  onClick={() => setActiveFault(fault.id)}
                >
                  <button
                    className="w-3 h-3 rounded-sm flex-shrink-0 relative cursor-pointer hover:ring-2 hover:ring-white/50"
                    style={{ backgroundColor: fault.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingColorId(fault.id);
                      setColorPickerType('fault');
                    }}
                    title="点击修改颜色"
                  />
                  <EditableName
                    name={fault.name}
                    onRename={(newName) => renameFault(fault.id, newName)}
                  />
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-0.5 hover:bg-slate-600 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFaultVisible(fault.id);
                      }}
                      title={fault.visible ? '隐藏' : '显示'}
                    >
                      {fault.visible ? (
                        <Eye className="w-3 h-3 text-slate-300" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                    <button
                      className="p-0.5 hover:bg-red-600/50 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFault(fault.id);
                      }}
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  {editingColorId === fault.id && colorPickerType === 'fault' && (
                    <ColorPicker
                      color={fault.color}
                      onChange={(c) => updateFaultColor(fault.id, c)}
                      onClose={() => {
                        setEditingColorId(null);
                        setColorPickerType(null);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700">
        <button
          className="w-full py-1.5 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-slate-200 text-xs gap-1"
          onClick={onToggleCollapse}
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          收起
        </button>
      </div>
    </div>
  );
}

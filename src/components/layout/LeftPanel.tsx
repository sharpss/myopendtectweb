import { useState } from 'react';
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
} from 'lucide-react';
import { useInterpretationStore } from '../../store/interpretationStore';
import { useSeismicStore } from '../../store/seismicStore';
import { cn } from '../../lib/utils';

type TabType = 'data' | 'horizons' | 'faults';

interface LeftPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function LeftPanel({ isCollapsed, onToggleCollapse }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['seismic']));

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
  } = useInterpretationStore();

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
              <button
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                onClick={() => addHorizon(`Horizon ${horizons.length + 1}`)}
                title="新建层位"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {horizons.map((horizon) => (
                <div
                  key={horizon.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
                    activeHorizonId === horizon.id
                      ? 'bg-blue-600/30 border-l-2 border-blue-500'
                      : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                  )}
                  onClick={() => setActiveHorizon(horizon.id)}
                >
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: horizon.color }}
                  />
                  <span className="text-xs text-slate-200 flex-1 truncate">
                    {horizon.name}
                  </span>
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
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'faults' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 border-b border-slate-700">
              <span className="text-xs text-slate-400">共 {faults.length} 个断层</span>
              <button
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                onClick={() => addFault(`Fault ${faults.length + 1}`)}
                title="新建断层"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {faults.map((fault) => (
                <div
                  key={fault.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
                    activeFaultId === fault.id
                      ? 'bg-red-600/20 border-l-2 border-red-500'
                      : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                  )}
                  onClick={() => setActiveFault(fault.id)}
                >
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: fault.color }}
                  />
                  <span className="text-xs text-slate-200 flex-1 truncate">
                    {fault.name}
                  </span>
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

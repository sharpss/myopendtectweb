import { useState } from 'react';
import {
  Sliders,
  Palette,
  Settings2,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Sun,
  Contrast,
  Droplets,
  Ruler,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useViewerStore } from '../../store/viewerStore';
import { ColormapType } from '../../../shared/types';
import { cn } from '../../lib/utils';

type TabType = 'display' | 'colormap' | 'attributes' | 'settings';

interface RightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const colormapList: { id: ColormapType; name: string; colors: string[] }[] = [
  { id: 'seismic', name: 'Seismic', colors: ['#0000ff', '#ffffff', '#ff0000'] },
  { id: 'gray', name: 'Gray', colors: ['#000000', '#ffffff'] },
  { id: 'rainbow', name: 'Rainbow', colors: ['#440088', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'] },
  { id: 'hot', name: 'Hot', colors: ['#000000', '#ff0000', '#ffff00', '#ffffff'] },
  { id: 'cool', name: 'Cool', colors: ['#00ffff', '#ff00ff'] },
  { id: 'viridis', name: 'Viridis', colors: ['#440a67', '#21918c', '#fde725'] },
  { id: 'plasma', name: 'Plasma', colors: ['#0d0887', '#cc4678', '#f0f921'] },
];

const attributeList = [
  { id: 'amplitude', name: '振幅属性', desc: '反射强度分析' },
  { id: 'coherence', name: '相干体', desc: '地层不连续性检测' },
  { id: 'curvature', name: '曲率属性', desc: '地层弯曲程度' },
  { id: 'instantaneous_phase', name: '瞬时相位', desc: '相位信息提取' },
  { id: 'instantaneous_frequency', name: '瞬时频率', desc: '频率域分析' },
];

export default function RightPanel({ isCollapsed, onToggleCollapse }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('display');
  const [isAnimating, setIsAnimating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['appearance', 'animation', 'slice-control'])
  );

  const {
    colormap,
    opacity,
    brightness,
    contrast,
    setColormap,
    setOpacity,
    setBrightness,
    setContrast,
    inlineIndex,
    crosslineIndex,
    timeIndex,
    setInlineIndex,
    setCrosslineIndex,
    setTimeIndex,
    viewMode,
  } = useViewerStore();

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
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
    { id: 'display', icon: <Sliders className="w-4 h-4" />, label: '显示' },
    { id: 'colormap', icon: <Palette className="w-4 h-4" />, label: '色带' },
    { id: 'attributes', icon: <BarChart3 className="w-4 h-4" />, label: '属性' },
    { id: 'settings', icon: <Settings2 className="w-4 h-4" />, label: '设置' },
  ];

  if (isCollapsed) {
    return (
      <div className="w-10 bg-slate-800 border-l border-slate-700 flex flex-col items-center py-2 gap-1">
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
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
    );
  }

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-b border-slate-700">
      <button
        className="w-full px-3 py-2 flex items-center gap-2 text-xs text-slate-300 hover:bg-slate-700/30 transition-colors"
        onClick={() => toggleSection(id)}
      >
        {expandedSections.has(id) ? (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-slate-400" />
        )}
        <span className="font-medium">{title}</span>
      </button>
      {expandedSections.has(id) && (
        <div className="px-3 pb-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );

  const SliderControl = ({
    icon,
    label,
    value,
    min,
    max,
    step,
    onChange,
    unit = '',
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    unit?: string;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {icon}
          {label}
        </div>
        <span className="text-xs text-slate-300 font-mono">
          {value.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
      />
    </div>
  );

  return (
    <div className="w-64 bg-slate-800 border-l border-slate-700 flex flex-col">
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
        {activeTab === 'display' && (
          <>
            <Section id="appearance" title="外观">
              <SliderControl
                icon={<Droplets className="w-3 h-3" />}
                label="不透明度"
                value={opacity}
                min={0}
                max={1}
                step={0.01}
                onChange={setOpacity}
              />
              <SliderControl
                icon={<Sun className="w-3 h-3" />}
                label="亮度"
                value={brightness}
                min={-1}
                max={1}
                step={0.01}
                onChange={setBrightness}
              />
              <SliderControl
                icon={<Contrast className="w-3 h-3" />}
                label="对比度"
                value={contrast}
                min={-1}
                max={1}
                step={0.01}
                onChange={setContrast}
              />
            </Section>

            <Section id="slice-control" title="切片控制">
              {(viewMode === 'inline' || viewMode === 'quad') && (
                <SliderControl
                  icon={<Ruler className="w-3 h-3" />}
                  label="Inline"
                  value={inlineIndex}
                  min={0}
                  max={99}
                  step={1}
                  onChange={setInlineIndex}
                />
              )}
              {(viewMode === 'crossline' || viewMode === 'quad') && (
                <SliderControl
                  icon={<Ruler className="w-3 h-3" />}
                  label="Crossline"
                  value={crosslineIndex}
                  min={0}
                  max={119}
                  step={1}
                  onChange={setCrosslineIndex}
                />
              )}
              {(viewMode === 'timeslice' || viewMode === 'quad') && (
                <SliderControl
                  icon={<Ruler className="w-3 h-3" />}
                  label="Time (ms)"
                  value={timeIndex * 4}
                  min={0}
                  max={796}
                  step={4}
                  onChange={(v) => setTimeIndex(Math.floor(v / 4))}
                  unit="ms"
                />
              )}
            </Section>

            <Section id="animation" title="动画">
              <div className="flex items-center justify-center gap-1">
                <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-white bg-blue-600 hover:bg-blue-500 rounded"
                  onClick={() => setIsAnimating(!isAnimating)}
                >
                  {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>速度</span>
                <select className="bg-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs border-none outline-none">
                  <option>0.5x</option>
                  <option>1x</option>
                  <option>2x</option>
                  <option>4x</option>
                </select>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'colormap' && (
          <div className="p-3 space-y-3">
            <div className="text-xs text-slate-400 font-medium">选择色带</div>
            <div className="space-y-1">
              {colormapList.map((cm) => (
                <button
                  key={cm.id}
                  className={cn(
                    'w-full p-2 rounded flex items-center gap-3 transition-all',
                    colormap === cm.id
                      ? 'bg-blue-600/30 border border-blue-500'
                      : 'bg-slate-700/50 border border-transparent hover:bg-slate-700'
                  )}
                  onClick={() => setColormap(cm.id)}
                >
                  <div
                    className="flex-1 h-5 rounded-sm"
                    style={{
                      background: `linear-gradient(to right, ${cm.colors.join(', ')})`,
                    }}
                  />
                  <span className="text-xs text-slate-300 w-16 text-right">{cm.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'attributes' && (
          <div className="p-3 space-y-2">
            <div className="text-xs text-slate-400 font-medium mb-2">地震属性</div>
            {attributeList.map((attr) => (
              <button
                key={attr.id}
                className="w-full p-2.5 rounded bg-slate-700/50 hover:bg-slate-700 text-left transition-colors"
              >
                <div className="text-xs text-slate-200 font-medium">{attr.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{attr.desc}</div>
              </button>
            ))}
            <div className="pt-2 border-t border-slate-700 mt-3">
              <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
                计算选中属性
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium">渲染设置</div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded" />
                显示坐标轴
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded" />
                显示色标
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" className="rounded" />
                显示网格
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded" />
                抗锯齿
              </label>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-400 font-medium">交互设置</div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded" />
                反转滚轮方向
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input type="checkbox" className="rounded" />
                左键旋转/右键选择
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700">
        <button
          className="w-full py-1.5 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-slate-200 text-xs gap-1"
          onClick={onToggleCollapse}
        >
          收起
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

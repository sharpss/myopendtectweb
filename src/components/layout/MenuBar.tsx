import { useState } from 'react';
import { File, Edit, View, Wrench, HelpCircle, ChevronDown } from 'lucide-react';

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: '文件',
    items: [
      { label: '新建项目', shortcut: 'Ctrl+N' },
      { label: '打开项目', shortcut: 'Ctrl+O' },
      { label: '保存项目', shortcut: 'Ctrl+S', divider: true },
      { label: '导入 SEGY...', shortcut: 'Ctrl+I' },
      { label: '导出图像...', divider: true },
      { label: '项目设置', divider: true },
      { label: '退出', shortcut: 'Ctrl+Q' },
    ],
  },
  {
    label: '编辑',
    items: [
      { label: '撤销', shortcut: 'Ctrl+Z' },
      { label: '重做', shortcut: 'Ctrl+Y', divider: true },
      { label: '剪切', shortcut: 'Ctrl+X' },
      { label: '复制', shortcut: 'Ctrl+C' },
      { label: '粘贴', shortcut: 'Ctrl+V', divider: true },
      { label: '全选', shortcut: 'Ctrl+A' },
    ],
  },
  {
    label: '视图',
    items: [
      { label: '3D 视图', submenu: [
        { label: '透视图' },
        { label: '正视图' },
        { label: '俯视图' },
        { label: '侧视图' },
      ]},
      { label: '剖面视图', submenu: [
        { label: 'Inline 剖面' },
        { label: 'Crossline 剖面' },
        { label: '时间切片' },
        { label: '四视图' },
      ], divider: true },
      { label: '显示坐标轴' },
      { label: '显示色标' },
      { label: '显示网格', divider: true },
      { label: '缩放至全屏', shortcut: 'F' },
    ],
  },
  {
    label: '工具',
    items: [
      { label: '选择工具', shortcut: 'V' },
      { label: '缩放工具', shortcut: 'Z' },
      { label: '平移工具', shortcut: 'H' },
      { label: '旋转工具', shortcut: 'R', divider: true },
      { label: '层位解释', submenu: [
        { label: '新建层位' },
        { label: '层位追踪' },
        { label: '层位编辑' },
      ]},
      { label: '断层解释', submenu: [
        { label: '新建断层' },
        { label: '断层拾取' },
        { label: '断距调节' },
      ], divider: true },
      { label: '属性计算', divider: true },
      { label: '测量工具', shortcut: 'M' },
    ],
  },
  {
    label: '数据',
    items: [
      { label: '数据管理器' },
      { label: '井数据' },
      { label: '层位数据' },
      { label: '断层数据', divider: true },
      { label: 'SEGY 导入向导' },
      { label: '数据导出' },
    ],
  },
  {
    label: '帮助',
    items: [
      { label: '文档' },
      { label: '快捷键参考', divider: true },
      { label: '关于 OpendTect Web' },
    ],
  },
];

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  return (
    <div className="h-8 bg-slate-800 border-b border-slate-700 flex items-center px-1 select-none">
      {menuGroups.map((group, groupIndex) => (
        <div
          key={group.label}
          className="relative"
          onMouseEnter={() => setActiveMenu(groupIndex)}
          onMouseLeave={() => setActiveMenu(null)}
        >
          <button
            className={`h-7 px-3 flex items-center gap-1 text-xs rounded-sm transition-colors ${
              activeMenu === groupIndex
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => setActiveMenu(activeMenu === groupIndex ? null : groupIndex)}
          >
            {group.label}
            <ChevronDown className="w-3 h-3" />
          </button>

          {activeMenu === groupIndex && (
            <div className="absolute top-full left-0 mt-0.5 bg-slate-800 border border-slate-600 rounded-sm shadow-xl min-w-48 py-1 z-50">
              {group.items.map((item, itemIndex) => (
                <div key={itemIndex}>
                  {item.divider && itemIndex > 0 && (
                    <div className="border-t border-slate-600 my-1" />
                  )}
                  <button
                    className={`w-full px-3 py-1.5 flex items-center justify-between text-xs text-slate-200 hover:bg-blue-600 transition-colors ${
                      item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={item.disabled}
                    onClick={item.onClick}
                  >
                    <span className="flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.submenu && <ChevronDown className="w-3 h-3 rotate-[-90deg]" />}
                      {item.shortcut && (
                        <span className="text-slate-400 text-[10px] ml-4">{item.shortcut}</span>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex-1" />

      <div className="flex items-center gap-2 pr-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-slate-400">已连接</span>
      </div>
    </div>
  );
}

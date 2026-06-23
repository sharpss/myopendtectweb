import { X, Keyboard } from 'lucide-react';
import Modal from './Modal';

interface ShortcutCategory {
  name: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: '视图切换',
    shortcuts: [
      { keys: ['1'], description: '3D 视图' },
      { keys: ['2'], description: 'Inline 剖面视图' },
      { keys: ['3'], description: 'Crossline 剖面视图' },
      { keys: ['4'], description: '时间切片视图' },
      { keys: ['5'], description: '四视图' },
    ],
  },
  {
    name: '面板控制',
    shortcuts: [
      { keys: ['Q'], description: '切换左侧面板' },
      { keys: ['W'], description: '切换右侧面板' },
      { keys: ['F'], description: '全屏显示' },
    ],
  },
  {
    name: '工具切换',
    shortcuts: [
      { keys: ['V'], description: '选择工具' },
      { keys: ['Z'], description: '缩放工具' },
      { keys: ['H'], description: '平移工具' },
      { keys: ['R'], description: '旋转工具' },
      { keys: ['M'], description: '测量工具' },
      { keys: ['T'], description: '层位工具' },
      { keys: ['Y'], description: '断层工具' },
    ],
  },
  {
    name: '编辑操作',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Y'], description: '重做' },
      { keys: ['Ctrl', 'S'], description: '保存' },
      { keys: ['Ctrl', 'N'], description: '新建项目' },
      { keys: ['Ctrl', 'O'], description: '打开项目' },
    ],
  },
  {
    name: '拾取操作',
    shortcuts: [
      { keys: ['Backspace'], description: '删除最后一个拾取点' },
      { keys: ['Enter'], description: '完成拾取' },
      { keys: ['Esc'], description: '取消拾取/测量' },
    ],
  },
  {
    name: '外观',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'L'], description: '切换深色/浅色主题' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="快捷键参考" width="max-w-3xl">
      <div className="grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2">
        {shortcutCategories.map((category) => (
          <div key={category.name}>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              {category.name}
            </h3>
            <div className="space-y-2">
              {category.shortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIdx) => (
                      <span key={keyIdx} className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-200 font-mono text-[10px] min-w-[24px] text-center">
                          {key}
                        </kbd>
                        {keyIdx < shortcut.keys.length - 1 && (
                          <span className="text-slate-500">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
}

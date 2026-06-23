import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  [key: string]: (e: KeyboardEvent) => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      let key = '';
      if (e.ctrlKey || e.metaKey) key += 'Ctrl+';
      if (e.shiftKey) key += 'Shift+';
      if (e.altKey) key += 'Alt+';
      key += e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();

      const handler = handlers[key] || handlers[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    },
    [handlers, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUTS = {
  SAVE: 'Ctrl+S',
  OPEN: 'Ctrl+O',
  NEW: 'Ctrl+N',
  UNDO: 'Ctrl+Z',
  REDO: 'Ctrl+Y',
  SELECT: 'V',
  ZOOM: 'Z',
  PAN: 'H',
  ROTATE: 'R',
  MEASURE: 'M',
  FULLSCREEN: 'F',
  VIEW_3D: '1',
  VIEW_INLINE: '2',
  VIEW_CROSSLINE: '3',
  VIEW_TIMESLICE: '4',
  VIEW_QUAD: '5',
  TOGGLE_LEFT_PANEL: 'Q',
  TOGGLE_RIGHT_PANEL: 'W',
  HORIZON_TOOL: 'T',
  FAULT_TOOL: 'Y',
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  accentColor: string;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      accentColor: '#3b82f6',
      
      toggleTheme: () => set((state) => ({ 
        mode: state.mode === 'dark' ? 'light' : 'dark' 
      })),
      
      setTheme: (mode) => set({ mode }),
      
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: 'opendtect-theme-storage',
    }
  )
);

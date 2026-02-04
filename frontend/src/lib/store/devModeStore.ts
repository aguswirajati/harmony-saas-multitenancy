/**
 * Dev Mode Store
 * Frontend toggle to show/hide Developer Tools menu and dev toolbar
 * Stored in localStorage for persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DevModeState {
  devMode: boolean;
  toggleDevMode: () => void;
  setDevMode: (value: boolean) => void;
}

export const useDevModeStore = create<DevModeState>()(
  persist(
    (set) => ({
      devMode: false,
      toggleDevMode: () => set((state) => ({ devMode: !state.devMode })),
      setDevMode: (value: boolean) => set({ devMode: value }),
    }),
    {
      name: 'dev-mode-storage',
    }
  )
);

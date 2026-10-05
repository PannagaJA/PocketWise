import { create } from 'zustand';

interface TabStore {
  activeTabIndex: number;
  setActiveTabIndex: (index: number) => void;
  tabScrollRequested: number | null;
  requestScrollToTab: (index: number) => void;
  clearScrollRequest: () => void;
}

export const useTabStore = create<TabStore>((set) => ({
  activeTabIndex: 0,
  setActiveTabIndex: (index: number) => set({ activeTabIndex: index }),
  tabScrollRequested: null,
  requestScrollToTab: (index: number) => set({ tabScrollRequested: index, activeTabIndex: index }),
  clearScrollRequest: () => set({ tabScrollRequested: null }),
}));

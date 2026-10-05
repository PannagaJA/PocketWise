import { create } from 'zustand';

interface ModalStore {
  activeModalCount: number;
  openModal: () => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModalCount: 0,
  openModal: () => set((state) => ({ activeModalCount: state.activeModalCount + 1 })),
  closeModal: () => set((state) => ({ activeModalCount: Math.max(0, state.activeModalCount - 1) })),
}));

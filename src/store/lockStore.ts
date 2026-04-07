import { create } from "zustand";

interface LockState {
  locked: boolean;
  lastActivity: number;
  setLocked: (v: boolean) => void;
  touchActivity: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  lastActivity: Date.now(),
  setLocked: (v) => set({ locked: v }),
  touchActivity: () => set({ lastActivity: Date.now() }),
}));

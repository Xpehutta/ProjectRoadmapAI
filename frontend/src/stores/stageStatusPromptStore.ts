import { create } from 'zustand'
import type { Task } from '../types'

interface StageStatusPromptStore {
  enqueueTask: (task: Task) => void
  setEnqueueTask: (fn: (task: Task) => void) => void
}

export const useStageStatusPromptStore = create<StageStatusPromptStore>((set) => ({
  enqueueTask: () => {},
  setEnqueueTask: (fn) => set({ enqueueTask: fn }),
}))

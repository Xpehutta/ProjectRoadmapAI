import { create } from 'zustand'
import type { GroupingMode, PrioritizationMethod, ViewMode } from '../types'

interface UIState {
  userName: string
  selectedProjectId: number | null
  projectEntered: boolean
  viewMode: ViewMode
  groupingMode: GroupingMode
  prioritizationMethod: PrioritizationMethod
  showIndicative: boolean
  showShiftComments: boolean
  activeShiftCommentKey: string | null
  collapsedGroupKeys: string[]
  selectedTaskId: number | null
  showAuditModal: boolean
  ganttShowPriority: boolean
  ganttPriorityFilter: (number | 'none')[] | null
  setUserName: (name: string) => void
  setSelectedProjectId: (id: number | null) => void
  enterProject: () => void
  exitProject: () => void
  setViewMode: (mode: ViewMode) => void
  setGroupingMode: (mode: GroupingMode) => void
  setPrioritizationMethod: (method: PrioritizationMethod) => void
  setShowIndicative: (show: boolean) => void
  setShowShiftComments: (show: boolean) => void
  setActiveShiftCommentKey: (key: string | null) => void
  toggleGroupCollapsed: (key: string) => void
  isGroupCollapsed: (key: string) => boolean
  setSelectedTaskId: (id: number | null) => void
  setShowAuditModal: (show: boolean) => void
  setGanttShowPriority: (show: boolean) => void
  setGanttPriorityFilter: (filter: (number | 'none')[] | null) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  userName: localStorage.getItem('roadmap-user-name') || '',
  selectedProjectId: (() => {
    const raw = localStorage.getItem('roadmap-selected-project-id')
    if (!raw) return null
    const id = Number(raw)
    return Number.isFinite(id) && id > 0 ? id : null
  })(),
  projectEntered: sessionStorage.getItem('roadmap-project-entered') === '1',
  viewMode: 'gantt',
  groupingMode: 'color',
  prioritizationMethod: 'rice',
  showIndicative: true,
  showShiftComments: true,
  activeShiftCommentKey: null,
  collapsedGroupKeys: [],
  selectedTaskId: null,
  showAuditModal: false,
  ganttShowPriority: true,
  ganttPriorityFilter: null,
  setUserName: (name) => set({ userName: name }),
  setSelectedProjectId: (id) => {
    if (id) localStorage.setItem('roadmap-selected-project-id', String(id))
    else localStorage.removeItem('roadmap-selected-project-id')
    set({ selectedProjectId: id, selectedTaskId: null })
  },
  enterProject: () => {
    sessionStorage.setItem('roadmap-project-entered', '1')
    set({ projectEntered: true })
  },
  exitProject: () => {
    sessionStorage.removeItem('roadmap-project-entered')
    set({ projectEntered: false, selectedTaskId: null })
  },
  setViewMode: (mode) => set({ viewMode: mode, activeShiftCommentKey: null }),
  setGroupingMode: (mode) => set({ groupingMode: mode }),
  setPrioritizationMethod: (method) => set({ prioritizationMethod: method }),
  setShowIndicative: (show) => set({ showIndicative: show }),
  setShowShiftComments: (show) => set({ showShiftComments: show }),
  setActiveShiftCommentKey: (key) => set({ activeShiftCommentKey: key }),
  toggleGroupCollapsed: (key) =>
    set((s) => {
      const next = new Set(s.collapsedGroupKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { collapsedGroupKeys: [...next] }
    }),
  isGroupCollapsed: (key) => get().collapsedGroupKeys.includes(key),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setShowAuditModal: (show) => set({ showAuditModal: show }),
  setGanttShowPriority: (show) => set({ ganttShowPriority: show }),
  setGanttPriorityFilter: (filter) => set({ ganttPriorityFilter: filter }),
}))

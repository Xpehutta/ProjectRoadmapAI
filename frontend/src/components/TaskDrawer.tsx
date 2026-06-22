import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { DeleteStageModal } from './DeleteStageModal'
import { DateShiftIndicator } from './DateShiftIndicator'
import { PendingShiftComment } from './PendingShiftComment'
import { StageCompleteModal } from './StageCompleteModal'
import { StageShiftModal, type StageDateModalMode } from './StageShiftModal'
import { useTaskDateShifts } from '../hooks/useTaskDateShift'
import { useEffectiveTask } from '../hooks/useEffectiveTasks'
import { useEffectiveTasks } from '../hooks/useEffectiveTasks'
import { useDateAutoFillPrompt } from '../hooks/useDateAutoFillPrompt'
import { useDeleteTask } from '../hooks/useProject'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../stores/savedDateShiftsStore'
import { useUIStore } from '../stores/uiStore'
import type { AuditEventType, Moscow, ProjectDetail, StageTemplate, SubStage, Task } from '../types'
import {
  CUSTOM_STAGE_VALUE,
  existingStageNameSet,
  groupStageTemplates,
  stageNameTaken,
} from '../utils/stageTemplates'
import { formatLocaleDateTime, HISTORY_FILTER_OPTIONS, ru } from '../locale/ru'
import { formatScore, MOSCOW_OPTIONS, prioritizationScore } from '../utils/scoring'
import {
  refreshProjectAfterSubStageChange,
  patchSubStageInProjectCache,
  removeSubStageFromProjectCache,
  applyTaskInternalLinksUpdate,
} from '../utils/subStageRefresh'
import {
  sortedSubStages,
  stageEffectiveEndDate,
  stageNeedsFollowingStartFill,
  stageNeedsPrecedingEndFill,
  minStageEndDate,
} from '../utils/subStageDates'
import { stageDisplayNumber } from '../utils/subStageDeps'
import { indicativeRangeChanged, buildStageShiftEntry, stageDatesChanged, stagePlannedDates, isStagePlanned } from '../utils/stageComplete'
import {
  mergeTaskCustomFields,
  readShowcaseDevelopmentRequired,
  SHOWCASE_DEVELOPMENT_KEY,
  tabCustomComment,
  TAB_COMMENT_KEYS,
} from '../utils/drawerTabFields'
import {
  DEFAULT_K_AN,
  DEFAULT_K_DEV,
  DEFAULT_K_DM,
  DEFAULT_K_MA,
  EFFORT_K_AN_KEY,
  EFFORT_K_DEV_KEY,
  EFFORT_K_DM_KEY,
  EFFORT_K_MA_KEY,
} from '../utils/effortCalculator'
import { PlannedEffortCalculator } from './PlannedEffortCalculator'
import { NewStageDependencyFields } from './NewStageDependencyFields'
import { StageEndDateInput } from './StageEndDateInput'
import { StageFocusDependenciesEditor } from './StageFocusDependenciesEditor'
import { TaskFieldCombobox } from './TaskFieldCombobox'
import { TaskDependenciesEditor } from './TaskDependenciesEditor'
import {
  draftsFromPredecessors,
  draftsToPredecessorRefs,
  parsePredecessorRefsText,
  type TaskDependencyDraft,
} from '../utils/taskDependencyRefs'
import {
  stageNeedsDependencyStartFill,
  suggestedStartFromDependencyDraft,
  taskNeedsDependencyStartFill,
} from '../utils/taskDependencyDates'
import {
  adjustDependencyDraftsAfterStageDelete,
  collectStageDeleteWarnings,
  type StageDeleteWarning,
} from '../utils/stageDeleteWarnings'
import {
  effectiveInternalStageLinks,
  mergeDependenciesForNewStage,
  replaceDependenciesForFocusStage,
  suggestedStartFromInternalStagePredIds,
  suggestedStartFromInternalStagePredecessors,
  type StageFocusDependency,
} from '../utils/stageInternalDeps'
import {
  collectGeneralTabFieldSuggestions,
  isoDateInputValue,
} from '../utils/taskFieldSuggestions'

interface Props {
  project: ProjectDetail
  task: Task
}

type TaskDrawerTab = 'general' | 'stages' | 'contractor' | 'effort' | 'other'

const DRAWER_TABS: { id: TaskDrawerTab; labelKey: keyof typeof ru.drawer.tabs }[] = [
  { id: 'general', labelKey: 'general' },
  { id: 'stages', labelKey: 'stages' },
  { id: 'contractor', labelKey: 'contractor' },
  { id: 'effort', labelKey: 'effort' },
  { id: 'other', labelKey: 'other' },
]

export function TaskDrawer({ project, task }: Props) {
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const prioritizationMethod = useUIStore((s) => s.prioritizationMethod)
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const pending = usePendingChangesStore((s) => s.taskChanges[task.id])
  const qc = useQueryClient()
  const [historyFilter, setHistoryFilter] = useState<AuditEventType | 'all'>('all')
  const [comment, setComment] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageStartDate, setNewStageStartDate] = useState('')
  const [newStageEndDate, setNewStageEndDate] = useState('')
  const [newStageDependency, setNewStageDependency] = useState<TaskDependencyDraft | null>(null)
  const [newStageInternalDeps, setNewStageInternalDeps] = useState<StageFocusDependency[]>([])
  const [addingStage, setAddingStage] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [saveTemplateForReuse, setSaveTemplateForReuse] = useState(false)
  const [completingStage, setCompletingStage] = useState<SubStage | null>(null)
  const [completingStageSubmitting, setCompletingStageSubmitting] = useState(false)
  const [shiftingStage, setShiftingStage] = useState<{
    stage: SubStage
    stageIndex: number
    initial?: { start_date: string | null; end_date: string | null }
    mode: StageDateModalMode
  } | null>(null)
  const [shiftingStageSubmitting, setShiftingStageSubmitting] = useState(false)
  const [stageDateInputReset, setStageDateInputReset] = useState(0)
  const [internalLinksBusy, setInternalLinksBusy] = useState<number | null>(null)
  const [internalLinksError, setInternalLinksError] = useState<{
    stageId: number
    message: string
  } | null>(null)
  const [stageToDelete, setStageToDelete] = useState<{
    stage: SubStage
    stageIndex: number
    warnings: StageDeleteWarning[]
  } | null>(null)
  const [deletingStage, setDeletingStage] = useState(false)
  const [activeTab, setActiveTab] = useState<TaskDrawerTab>('general')
  const [plannedEffortInputKey, setPlannedEffortInputKey] = useState(0)
  const recordIndicativeShift = useSavedDateShiftsStore((s) => s.recordIndicativeShift)
  const recordStageShift = useSavedDateShiftsStore((s) => s.recordStageShift)
  const clearStageShift = useSavedDateShiftsStore((s) => s.clearStageShift)
  const pruneStageShiftsForTask = useSavedDateShiftsStore((s) => s.pruneStageShiftsForTask)
  const clearTaskDateShifts = useSavedDateShiftsStore((s) => s.clearTaskDateShifts)
  const { requestDate, dateAutoFillModal } = useDateAutoFillPrompt()

  const { data: stageLibrary } = useQuery({
    queryKey: ['stage-templates', project.id],
    queryFn: () => api.getStageTemplates(project.id),
  })

  const existingStageNames = useMemo(
    () => existingStageNameSet(task.sub_stages.map((s) => s.name)),
    [task.sub_stages]
  )

  const orderedStages = useMemo(() => sortedSubStages(task.sub_stages), [task.sub_stages])

  const effectiveInternalLinks = useMemo(
    () => effectiveInternalStageLinks(task, orderedStages),
    [task, orderedStages]
  )

  const renderTemplateOptions = (templates: StageTemplate[] | undefined, sectionLabel: string) => {
    if (!templates?.length) return null
    const grouped = groupStageTemplates(templates)
    return (
      <optgroup label={sectionLabel}>
        {Array.from(grouped.entries()).flatMap(([group, items]) =>
          items.map((item) => {
            const taken = stageNameTaken(existingStageNames, item.full_label)
            return (
              <option key={`${sectionLabel}-${item.full_label}`} value={item.full_label} disabled={taken}>
                {group !== '—' ? `${group} → ${item.name}` : item.full_label}
                {taken ? ` (${ru.drawer.templateAlreadyOnTask})` : ''}
              </option>
            )
          })
        )}
      </optgroup>
    )
  }

  const effective = useEffectiveTask(project.tasks, task.id)
  const effectiveTasks = useEffectiveTasks(project.tasks)
  const effectiveTasksById = useMemo(
    () => new Map(effectiveTasks.map((t) => [t.id, t])),
    [effectiveTasks]
  )
  const generalFieldSuggestions = useMemo(
    () => collectGeneralTabFieldSuggestions(effectiveTasks, project.components),
    [effectiveTasks, project.components]
  )
  const hasPending = Boolean(pending)
  const dateShifts = useTaskDateShifts(task)
  const linkedComponent = task.component_id
    ? project.components?.find((c) => c.id === task.component_id)
    : undefined
  const otherUsages =
    linkedComponent?.usages.filter((u) => u.id !== task.id) ?? []

  const tasksById = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const tasksByName = useMemo(
    () => new Map(project.tasks.map((t) => [t.name.toLowerCase(), t])),
    [project.tasks]
  )

  const dependencyDrafts = useMemo((): TaskDependencyDraft[] => {
    const pendingRefs = pending?.patch?.predecessor_refs
    if (typeof pendingRefs === 'string') {
      const parsed = parsePredecessorRefsText(
        pendingRefs,
        task.id,
        tasksById,
        tasksByName
      )
      if (parsed !== null) return parsed
    }
    return draftsFromPredecessors(effective.predecessors)
  }, [pending?.patch?.predecessor_refs, effective.predecessors, task.id, tasksById, tasksByName])

  const dependencyDraftsAuthoritative = typeof pending?.patch?.predecessor_refs === 'string'

  const handleDependencyDraftsChange = (drafts: TaskDependencyDraft[]) => {
    const prevCount = dependencyDrafts.length
    const refs = draftsToPredecessorRefs(drafts, tasksById)
    stageTaskChange(task, { predecessor_refs: refs.join(', ') })
    if (drafts.length > prevCount) {
      queueMicrotask(() =>
        void offerAutofillForDependencyDraft(drafts[drafts.length - 1], undefined, { silent: true })
      )
    }
  }

  const unlink = useMutation({
    mutationFn: () => api.unlinkTaskComponent(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
  })

  const deleteTask = useDeleteTask(project.id)

  const handleDeleteTask = () => {
    if (!confirm(ru.drawer.deleteTaskConfirm(task.name))) return
    deleteTask.mutate(task.id)
  }

  const stage = (field: string, value: unknown) => {
    stageTaskChange(task, { [field]: value })
  }

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => api.getComments(task.id),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['history', task.id, historyFilter],
    queryFn: () =>
      api.getHistory(task.id, historyFilter === 'all' ? undefined : historyFilter),
  })

  const addComment = useMutation({
    mutationFn: (body: string) => api.addComment(task.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task.id] })
      qc.invalidateQueries({ queryKey: ['history', task.id] })
      setComment('')
    },
  })

  const toggleStage = async (stage: SubStage) => {
    if (stage.is_done) {
      await api.updateSubStage(task.id, stage.id, { is_done: false })
      await refreshProjectAfterSubStageChange(qc, project.id)
      return
    }
    if (!isStagePlanned(stage)) return
    setCompletingStage(stage)
  }

  const cancelStageShift = () => {
    setShiftingStage(null)
    setStageDateInputReset((n) => n + 1)
  }

  const maybeFillPrecedingEnd = async (stageIndex: number, startDate: string | null) => {
    const fill = stageNeedsPrecedingEndFill(task.sub_stages, stageIndex, startDate)
    if (!fill) return
    const chosen = await requestDate(
      ru.drawer.autoFillPrecedingEndPrompt(fill.proposedEnd, fill.preceding.name),
      fill.proposedEnd,
      ru.drawer.stageEndDate
    )
    if (!chosen) return
    await api.updateSubStage(task.id, fill.preceding.id, { end_date: chosen })
    await refreshProjectAfterSubStageChange(qc, project.id)
  }

  /** Set stage dates on save without shift modal or Gantt shift markers. */
  const applyStageDatesSilently = async (
    stageItem: SubStage,
    dates: { start_date: string | null; end_date: string | null }
  ) => {
    await api.updateSubStage(task.id, stageItem.id, {
      start_date: dates.start_date,
      end_date: dates.end_date,
    })
    patchSubStageInProjectCache(qc, project.id, stageItem.id, dates)
    await refreshProjectAfterSubStageChange(qc, project.id)
    setStageDateInputReset((n) => n + 1)
  }

  const handleStageCompleteConfirm = async (data: {
    start_date: string | null
    end_date: string | null
    comment: string
  }) => {
    if (!completingStage) return
    const stageItem = completingStage
    const stageIndex = orderedStages.findIndex((s) => s.id === stageItem.id)
    const recordShift = stageDatesChanged(stageItem, data)

    setCompletingStageSubmitting(true)
    try {
      await persistStageDates(stageItem, data, {
        stageIndex,
        recordShift: recordShift && isStagePlanned(stageItem),
        markPlanned: !isStagePlanned(stageItem),
        markDone: true,
        comment: data.comment,
      })
      setCompletingStage(null)
    } finally {
      setCompletingStageSubmitting(false)
    }
  }

  const handleStageShiftConfirm = async (data: {
    start_date: string | null
    end_date: string | null
    comment: string
  }) => {
    if (!shiftingStage) return
    setShiftingStageSubmitting(true)
    try {
      if (shiftingStage.mode === 'correct') {
        await applyStageDatesSilently(shiftingStage.stage, data)
        if (data.comment.trim()) {
          await api.addComment(
            task.id,
            `Скорректированы сроки этапа «${shiftingStage.stage.name}»: ${data.comment.trim()}`
          )
          await qc.invalidateQueries({ queryKey: ['comments', task.id] })
          await qc.invalidateQueries({ queryKey: ['history', task.id] })
        }
        setShiftingStage(null)
        return
      }

      await persistStageDates(shiftingStage.stage, data, {
        stageIndex: shiftingStage.stageIndex,
        recordShift: shiftingStage.mode === 'shift',
        markPlanned: shiftingStage.mode === 'plan',
        comment: data.comment,
      })
      setShiftingStage(null)
    } finally {
      setShiftingStageSubmitting(false)
    }
  }

  const persistStageDates = async (
    stageItem: SubStage,
    confirmed: { start_date: string | null; end_date: string | null },
    options: {
      stageIndex: number
      recordShift: boolean
      markDone?: boolean
      markPlanned?: boolean
      comment?: string
    }
  ) => {
    const datesChanged = stageDatesChanged(stageItem, confirmed)
    const markingPlanned = Boolean(options.markPlanned && !isStagePlanned(stageItem))
    if (!datesChanged && !markingPlanned && !options.markDone) return

    const prevIndicative = {
      start: effective.indicative_start,
      end: effective.indicative_end,
    }

    if (confirmed.start_date && options.stageIndex > 0) {
      await maybeFillPrecedingEnd(options.stageIndex, confirmed.start_date)
    }

    await api.updateSubStage(task.id, stageItem.id, {
      ...(options.markDone ? { is_done: true } : {}),
      ...(markingPlanned ? { is_indicative: true } : {}),
      start_date: confirmed.start_date,
      end_date: confirmed.end_date,
    })
    await refreshProjectAfterSubStageChange(qc, project.id)

    const updatedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
    const updatedTask = updatedProject?.tasks.find((t) => t.id === task.id)

    if ((datesChanged || markingPlanned) && options.comment?.trim()) {
      const label =
        markingPlanned && !datesChanged
          ? `Запланирован этап «${stageItem.name}»`
          : `Этап «${stageItem.name}»`
      await api.addComment(task.id, `${label}: ${options.comment!.trim()}`)
      await qc.invalidateQueries({ queryKey: ['comments', task.id] })
      await qc.invalidateQueries({ queryKey: ['history', task.id] })
    }

    if (options.recordShift && !markingPlanned && datesChanged) {
      const stageShift = buildStageShiftEntry(task.id, stageItem, confirmed, options.comment)
      if (stageShift) {
        recordStageShift(stageShift)
      }

      if (updatedTask) {
        const nextIndicative = {
          start: updatedTask.indicative_start,
          end: updatedTask.indicative_end,
        }
        if (
          indicativeRangeChanged(prevIndicative, nextIndicative) &&
          prevIndicative.start &&
          prevIndicative.end &&
          nextIndicative.start &&
          nextIndicative.end
        ) {
          recordIndicativeShift({
            taskId: task.id,
            origStart: prevIndicative.start,
            origEnd: prevIndicative.end,
            curStart: nextIndicative.start,
            curEnd: nextIndicative.end,
            shiftComment: options.comment?.trim(),
          })
        }
      }
    }
  }

  const completeAll = async () => {
    for (const stage of orderedStages) {
      if (isStagePlanned(stage) && !stage.is_done) {
        await api.updateSubStage(task.id, stage.id, { is_done: true })
      }
    }
    await refreshProjectAfterSubStageChange(qc, project.id)
  }

  const offerDependencyStageStart = async (
    stageItem: SubStage
  ): Promise<{ start_date: string | null; end_date: string | null } | null> => {
    const fill = stageNeedsDependencyStartFill(
      project,
      task,
      stageItem,
      effectiveTasksById,
      dependencyDrafts,
      stageItem.start_date,
      dependencyDraftsAuthoritative
    )
    if (!fill) return null
    const chosen = await requestDate(
      ru.drawer.autoFillFromTaskDependencyPrompt(fill.label, fill.date),
      fill.date,
      ru.drawer.stageStartDate
    )
    if (!chosen) return null
    const planned = stagePlannedDates(stageItem)
    return {
      start_date: chosen,
      end_date: planned.end_date,
    }
  }

  const offerStageStartAutofill = async (
    stageItem: SubStage
  ): Promise<{ start_date: string | null; end_date: string | null } | undefined> => {
    if (stageItem.start_date) return undefined
    const fromDep = await offerDependencyStageStart(stageItem)
    if (fromDep) return fromDep
    if (stageItem.predecessor_stage_ids?.length) {
      const suggestion = suggestedStartFromInternalStagePredecessors(orderedStages, stageItem.id)
      if (suggestion) {
        const chosen = await requestDate(
          ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
          suggestion.date,
          ru.drawer.stageStartDate
        )
        if (chosen) {
          return {
            start_date: chosen,
            end_date: stagePlannedDates(stageItem).end_date,
          }
        }
      }
    }
    return undefined
  }

  const openStageShift = (
    stageItem: SubStage,
    stageIndex: number,
    mode: StageDateModalMode,
    initial?: { start_date: string | null; end_date: string | null }
  ) => {
    setShiftingStage({ stage: stageItem, stageIndex, initial, mode })
  }

  const openStageModalWithAutoFill = async (
    stageItem: SubStage,
    stageIndex: number,
    mode: StageDateModalMode
  ) => {
    const initial = await offerStageStartAutofill(stageItem)
    openStageShift(stageItem, stageIndex, mode, initial)
  }

  const openStageShiftWithAutoFill = async (stageItem: SubStage, stageIndex: number) => {
    await openStageModalWithAutoFill(stageItem, stageIndex, 'shift')
  }

  const openStagePlanWithAutoFill = async (stageItem: SubStage, stageIndex: number) => {
    await openStageModalWithAutoFill(stageItem, stageIndex, 'plan')
  }

  const openStageCorrectWithAutoFill = async (stageItem: SubStage, stageIndex: number) => {
    await openStageModalWithAutoFill(stageItem, stageIndex, 'correct')
  }

  const offerAutofillForDependencyDraft = async (
    draft: TaskDependencyDraft,
    stageOverride?: { stageItem: SubStage; stageIndex: number },
    options?: { silent?: boolean }
  ) => {
    if (!draft.predecessorId) return
    const suggestion = suggestedStartFromDependencyDraft(draft, effectiveTasksById)
    if (!suggestion) return

    if (draft.successorStageNumber != null) {
      const stageItem =
        stageOverride?.stageItem ?? orderedStages[draft.successorStageNumber - 1]
      const stageIdx = stageOverride?.stageIndex ?? draft.successorStageNumber - 1
      if (!stageItem || stageItem.start_date) return
      const chosen = await requestDate(
        ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
        suggestion.date,
        ru.drawer.stageStartDate
      )
      if (!chosen) return
      const dates = {
        start_date: chosen,
        end_date: stagePlannedDates(stageItem).end_date,
      }
      if (options?.silent || !isStagePlanned(stageItem)) {
        await applyStageDatesSilently(stageItem, dates)
      } else {
        openStageShift(stageItem, stageIdx, 'shift', dates)
      }
      return
    }

    if (effective.start_date) return
    const chosen = await requestDate(
      ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
      suggestion.date,
      ru.drawer.stageStartDate
    )
    if (chosen) {
      stageTaskChange(task, { start_date: chosen, end_date: effective.end_date })
    }
  }

  const handleNewStageStartChange = (value: string) => {
    setNewStageStartDate(value)
    const minEnd = minStageEndDate(value)
    if (!minEnd) return
    setNewStageEndDate((end) => {
      if (!end) return end
      return end < minEnd ? minEnd : end
    })
  }

  const applyNewStageStartDate = (chosen: string) => {
    setNewStageStartDate(chosen)
    setNewStageEndDate((end) => end || minStageEndDate(chosen) || '')
  }

  const handleNewStageStartBlur = async () => {
    if (newStageStartDate) return

    if (newStageDependency?.predecessorId) {
      const suggestion = suggestedStartFromDependencyDraft(newStageDependency, effectiveTasksById)
      if (suggestion) {
        const chosen = await requestDate(
          ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
          suggestion.date,
          ru.drawer.stageStartDate
        )
        if (chosen) applyNewStageStartDate(chosen)
      }
      return
    }

    const afterPredIds = newStageInternalDeps
      .filter((d) => d.relation === 'after')
      .map((d) => d.refStageId)
    if (afterPredIds.length > 0) {
      const suggestion = suggestedStartFromInternalStagePredIds(orderedStages, afterPredIds)
      if (suggestion) {
        const chosen = await requestDate(
          ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
          suggestion.date,
          ru.drawer.stageStartDate
        )
        if (chosen) applyNewStageStartDate(chosen)
      }
      return
    }

    const fill = stageNeedsFollowingStartFill(task.sub_stages, null)
    if (!fill) return
    const chosen = await requestDate(
      ru.drawer.autoFillFollowingStartPrompt(fill.proposedStart, fill.preceding.name),
      fill.proposedStart,
      ru.drawer.stageStartDate
    )
    if (chosen) applyNewStageStartDate(chosen)
  }

  const handleStageDateBlur = async (
    stageItem: SubStage,
    field: 'start_date' | 'end_date',
    rawValue: string,
    stageIndex: number
  ) => {
    const planned = stagePlannedDates(stageItem)
    const savedValue =
      field === 'start_date' ? (stageItem.start_date ?? '') : (planned.end_date ?? '')
    if (rawValue === savedValue) return

    if (field === 'start_date' && !rawValue && !stageItem.start_date) {
      const fromDep = await offerDependencyStageStart(stageItem)
      if (fromDep) {
        if (isStagePlanned(stageItem)) {
          openStageShift(stageItem, stageIndex, 'shift', fromDep)
        } else {
          await applyStageDatesSilently(stageItem, fromDep)
        }
        return
      }
    }

    const nextDates = {
      start_date: field === 'start_date' ? rawValue || null : planned.start_date,
      end_date: field === 'end_date' ? rawValue || null : planned.end_date,
    }
    if (isStagePlanned(stageItem)) {
      openStageShift(stageItem, stageIndex, 'shift', nextDates)
    } else {
      await applyStageDatesSilently(stageItem, nextDates)
    }
  }

  const saveFocusStageDeps = async (stageItem: SubStage, deps: StageFocusDependency[]) => {
    setInternalLinksBusy(stageItem.id)
    setInternalLinksError(null)
    try {
      const nextLinks = replaceDependenciesForFocusStage(
        effectiveInternalLinks,
        stageItem.id,
        deps
      )
      const updated = await api.updateInternalStageLinks(task.id, nextLinks)
      applyTaskInternalLinksUpdate(qc, project.id, updated)
      await refreshProjectAfterSubStageChange(qc, project.id)

      if (!stageItem.start_date && deps.some((d) => d.relation === 'after')) {
        const refreshedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
        const refreshedTask = refreshedProject?.tasks.find((t) => t.id === task.id)
        const stages = sortedSubStages(refreshedTask?.sub_stages ?? orderedStages)
        const suggestion = suggestedStartFromInternalStagePredecessors(stages, stageItem.id)
        if (suggestion) {
          const chosen = await requestDate(
            ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
            suggestion.date,
            ru.drawer.stageStartDate
          )
          if (chosen) {
            const dates = {
              start_date: chosen,
              end_date: stagePlannedDates(stageItem).end_date,
            }
            const stageIndex = stages.findIndex((s) => s.id === stageItem.id)
            if (isStagePlanned(stageItem)) {
              openStageShift(stageItem, stageIndex, 'shift', dates)
            } else {
              await applyStageDatesSilently(stageItem, dates)
            }
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : ru.drawer.stageInternalLinkSaveError
      setInternalLinksError({ stageId: stageItem.id, message })
      throw err
    } finally {
      setInternalLinksBusy(null)
    }
  }

  const openDeleteStage = (stageItem: SubStage, stageIndex: number) => {
    const warnings = collectStageDeleteWarnings(
      project,
      task,
      stageItem,
      stageIndex,
      orderedStages,
      dependencyDrafts,
      tasksById
    )
    setStageToDelete({ stage: stageItem, stageIndex, warnings })
  }

  const handleDeleteStageConfirm = async (comment: string | null) => {
    if (!stageToDelete) return
    const { stage: stageItem, stageIndex } = stageToDelete
    const deletedNumber = stageDisplayNumber(stageIndex)
    const tasksBefore = new Map(project.tasks.map((t) => [t.id, t]))
    setDeletingStage(true)
    try {
      removeSubStageFromProjectCache(qc, project.id, stageItem.id)
      await api.deleteSubStage(task.id, stageItem.id)
      clearStageShift(task.id, stageItem.id)
      clearTaskDateShifts(task.id)
      const adjusted = adjustDependencyDraftsAfterStageDelete(dependencyDrafts, deletedNumber)
      if (adjusted.length !== dependencyDrafts.length || dependencyDrafts.some((d, i) => d !== adjusted[i])) {
        stageTaskChange(task, {
          predecessor_refs: draftsToPredecessorRefs(adjusted, tasksById).join(', '),
        })
      }
      setStageToDelete(null)
      await refreshProjectAfterSubStageChange(qc, project.id, { beforeById: tasksBefore })

      const updatedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
      const updatedTask = updatedProject?.tasks.find((t) => t.id === task.id)
      if (updatedTask) {
        pruneStageShiftsForTask(
          task.id,
          updatedTask.sub_stages.map((s) => s.id)
        )
        if (task.component_id) {
          for (const usage of otherUsages) {
            pruneStageShiftsForTask(
              usage.id,
              updatedTask.sub_stages.map((s) => s.id)
            )
          }
        }
      }

      if (comment?.trim()) {
        await api.addComment(task.id, `Удалён этап «${stageItem.name}»: ${comment.trim()}`)
        await qc.invalidateQueries({ queryKey: ['comments', task.id] })
        await qc.invalidateQueries({ queryKey: ['history', task.id] })
      }
    } finally {
      setDeletingStage(false)
    }
  }

  const addStage = async (e: FormEvent) => {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    setAddingStage(true)
    try {
      const startDate = newStageStartDate || null
      const successorNumber = stageDisplayNumber(task.sub_stages.length)
      const stageDepDraft = newStageDependency?.predecessorId
        ? { ...newStageDependency, successorStageNumber: successorNumber }
        : null
      const createdStage = await api.createSubStage(task.id, {
        name,
        sort_order: task.sub_stages.length,
        start_date: startDate,
        end_date: newStageEndDate || null,
        is_indicative: false,
      })
      patchSubStageInProjectCache(qc, project.id, createdStage.id, { is_indicative: false })
      if (newStageInternalDeps.length > 0) {
        const nextLinks = mergeDependenciesForNewStage(
          effectiveInternalLinks,
          createdStage.id,
          newStageInternalDeps
        )
        const updated = await api.updateInternalStageLinks(task.id, nextLinks)
        applyTaskInternalLinksUpdate(qc, project.id, updated)
      }
      if (stageDepDraft) {
        stageTaskChange(task, {
          predecessor_refs: draftsToPredecessorRefs(
            [...dependencyDrafts, stageDepDraft],
            tasksById
          ).join(', '),
        })
      }
      if (saveTemplateForReuse && selectedTemplate === CUSTOM_STAGE_VALUE) {
        await api.addStageTemplate(project.id, { name, full_label: name })
        await qc.invalidateQueries({ queryKey: ['stage-templates', project.id] })
      }
      setNewStageName('')
      setNewStageStartDate('')
      setNewStageEndDate('')
      setNewStageDependency(null)
      setNewStageInternalDeps([])
      setSelectedTemplate('')
      setSaveTemplateForReuse(false)
      await refreshProjectAfterSubStageChange(qc, project.id)

      const newStageIndex = successorNumber - 1
      const refreshedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
      const refreshedTask = refreshedProject?.tasks.find((t) => t.id === task.id)
      const newStageItem =
        refreshedTask?.sub_stages.find((s) => s.id === createdStage.id) ??
        sortedSubStages(refreshedTask?.sub_stages ?? [])[newStageIndex]

      if (stageDepDraft && !startDate && newStageItem) {
        await offerAutofillForDependencyDraft(
          stageDepDraft,
          { stageItem: newStageItem, stageIndex: newStageIndex },
          { silent: true }
        )
      } else if (newStageInternalDeps.some((d) => d.relation === 'after') && !startDate && newStageItem) {
        const afterPredIds = newStageInternalDeps
          .filter((d) => d.relation === 'after')
          .map((d) => d.refStageId)
        const nextStages = [
          ...orderedStages,
          {
            ...newStageItem,
            predecessor_stage_ids: afterPredIds,
          },
        ]
        const suggestion = suggestedStartFromInternalStagePredIds(nextStages, afterPredIds)
        if (suggestion) {
          const chosen = await requestDate(
            ru.drawer.autoFillFromTaskDependencyPrompt(suggestion.label, suggestion.date),
            suggestion.date,
            ru.drawer.stageStartDate
          )
          if (chosen) {
            await applyStageDatesSilently(newStageItem, {
              start_date: chosen,
              end_date: stagePlannedDates(newStageItem).end_date,
            })
          }
        }
      }
    } finally {
      setAddingStage(false)
    }
  }

  const handleTemplateSelect = (value: string) => {
    setSelectedTemplate(value)
    if (value === CUSTOM_STAGE_VALUE) {
      setNewStageName('')
      return
    }
    if (value) {
      setNewStageName(value)
      setSaveTemplateForReuse(false)
    }
  }

  const patch = async (field: string, value: unknown) => {
    stage(field, value)
  }

  const patchCustomField = (key: string, value: string) => {
    const latestPending = usePendingChangesStore.getState().taskChanges[task.id]?.patch
    const merged = mergeTaskCustomFields(task, latestPending)
    stageTaskChange(task, { custom_fields: { ...merged, [key]: value } })
  }

  const renderTabComment = (
    tab: 'general' | 'stages' | 'contractor' | 'effort' | 'other'
  ) => {
    if (tab === 'other') {
      return (
        <label className="drawer-tab-comment">
          {ru.drawer.tabComment}
          <textarea
            key={`notes-${effective.notes}`}
            defaultValue={effective.notes ?? ''}
            rows={2}
            onBlur={(e) => patch('notes', e.target.value || null)}
          />
        </label>
      )
    }
    const key = TAB_COMMENT_KEYS[tab]
    const value = tabCustomComment(effective, key)
    return (
      <label className="drawer-tab-comment">
        {ru.drawer.tabComment}
        <textarea
          key={`${key}-${value}`}
          defaultValue={value}
          rows={2}
          onBlur={(e) => patchCustomField(key, e.target.value)}
        />
      </label>
    )
  }

  const indicativeFromStages = task.sub_stages.some(isStagePlanned)
  const hasPlannedStages = indicativeFromStages
  const effortKAn = effective.custom_fields?.[EFFORT_K_AN_KEY] ?? String(DEFAULT_K_AN)
  const effortKDev = effective.custom_fields?.[EFFORT_K_DEV_KEY] ?? String(DEFAULT_K_DEV)
  const effortKMa = effective.custom_fields?.[EFFORT_K_MA_KEY] ?? String(DEFAULT_K_MA)
  const effortKDm = effective.custom_fields?.[EFFORT_K_DM_KEY] ?? String(DEFAULT_K_DM)
  const showcaseFromEffective = readShowcaseDevelopmentRequired(
    effective.custom_fields as Record<string, unknown> | null | undefined
  )
  const [showcaseDevRequired, setShowcaseDevRequired] = useState(showcaseFromEffective)

  useEffect(() => {
    setShowcaseDevRequired(showcaseFromEffective)
  }, [task.id, showcaseFromEffective])

  return (
    <>
    <aside className="task-drawer">
      <header>
        <h2>
          {effective.name}
          {hasPending && <span className="pending-badge drawer-title-badge">{ru.drawer.unsaved}</span>}
        </h2>
        <button className="close-btn" onClick={() => setSelectedTaskId(null)}>
          ×
        </button>
      </header>

      {task.component_id && task.component_name && (
        <section className="shared-component-banner">
          <div className="shared-component-banner-title">
            <span className="badge shared-badge">{ru.components.sharedBadge}</span>
            {ru.components.bannerTitle}: <strong>{task.component_name}</strong>
          </div>
          <p className="muted">
            {ru.components.bannerHint(task.component_usage_count)}
          </p>
          {otherUsages.length > 0 && (
            <div className="shared-component-usages">
              <span className="muted">{ru.components.otherUsages}:</span>
              <ul>
                {otherUsages.map((usage) => (
                  <li key={usage.id}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setSelectedTaskId(usage.id)}
                    >
                      {usage.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            {unlink.isPending ? ru.components.unlinking : ru.components.unlink}
          </button>
        </section>
      )}

      <nav className="task-drawer-tabs" aria-label="Разделы задачи">
        {DRAWER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {ru.drawer.tabs[tab.labelKey]}
          </button>
        ))}
      </nav>

      <div className="task-drawer-tab-panel">
        {activeTab === 'general' && (
          <section>
            <label>
              {ru.drawer.taskDescription}
              <input
                key={`name-${effective.name}`}
                defaultValue={effective.name}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value && value !== task.name) patch('name', value)
                }}
              />
            </label>
            <label>
              Приоритет
              <input
                type="number"
                key={`pri-${effective.priority}`}
                defaultValue={effective.priority ?? ''}
                onBlur={(e) => patch('priority', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <TaskFieldCombobox
              listId={`task-${task.id}-subproduct`}
              label={ru.drawer.showcase}
              value={effective.subproduct ?? ''}
              suggestions={generalFieldSuggestions.subproduct}
              onCommit={(value) => patch('subproduct', value)}
            />
            <TaskFieldCombobox
              listId={`task-${task.id}-data-source`}
              label="Источник"
              value={effective.component_name ?? effective.data_source ?? ''}
              suggestions={generalFieldSuggestions.data_source}
              readOnly={Boolean(task.component_id)}
              onCommit={(value) => {
                if (!task.component_id) patch('data_source', value)
              }}
            />
            <TaskFieldCombobox
              listId={`task-${task.id}-forms`}
              label="Формы"
              value={effective.forms ?? ''}
              suggestions={generalFieldSuggestions.forms}
              onCommit={(value) => patch('forms', value)}
            />
            <TaskFieldCombobox
              listId={`task-${task.id}-customer`}
              label="Заказчик"
              value={effective.customer ?? ''}
              suggestions={generalFieldSuggestions.customer}
              onCommit={(value) => patch('customer', value)}
            />
            <TaskFieldCombobox
              listId={`task-${task.id}-platform`}
              label="Площадка"
              value={effective.platform ?? ''}
              suggestions={generalFieldSuggestions.platform}
              onCommit={(value) => patch('platform', value)}
            />
            <TaskFieldCombobox
              listId={`task-${task.id}-area`}
              label="Область"
              value={effective.area ?? ''}
              suggestions={generalFieldSuggestions.area}
              onCommit={(value) => patch('area', value)}
            />
            <label>
              Желаемый срок
              <input
                type="date"
                key={`dq-${effective.desired_quarter}`}
                defaultValue={isoDateInputValue(effective.desired_quarter)}
                onChange={(e) => patch('desired_quarter', e.target.value || null)}
              />
            </label>
            {renderTabComment('general')}
          </section>
        )}

        {activeTab === 'stages' && (
          <section>
            <div className="completion-display drawer-tab-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${effective.completion_pct}%` }} />
              </div>
              <span>{ru.drawer.complete(effective.completion_pct)}</span>
            </div>
            <label>
              Индикативное начало
              <input
                type="date"
                key={`is-${effective.indicative_start}`}
                defaultValue={effective.indicative_start ?? ''}
                readOnly={indicativeFromStages}
                className={indicativeFromStages ? 'readonly-field' : undefined}
                onBlur={(e) => {
                  if (!indicativeFromStages) patch('indicative_start', e.target.value || null)
                }}
              />
            </label>
            <label>
              Индикативное окончание
              <input
                type="date"
                key={`ie-${effective.indicative_end}`}
                defaultValue={effective.indicative_end ?? ''}
                readOnly={indicativeFromStages}
                className={indicativeFromStages ? 'readonly-field' : undefined}
                onBlur={(e) => {
                  if (!indicativeFromStages) patch('indicative_end', e.target.value || null)
                }}
              />
            </label>
            {indicativeFromStages && (
              <p className="muted stage-indicative-hint">{ru.drawer.indicativeFromStages}</p>
            )}
            <h3>
              Этапы
              {hasPlannedStages && (
                <button className="btn-small" onClick={completeAll}>
                  {ru.drawer.markAllDone}
                </button>
              )}
            </h3>
            <ul className="checklist phase-checklist">
              {orderedStages.map((s, stageIndex) => (
                <li key={s.id} className={isStagePlanned(s) ? 'indicative-phase' : 'unplanned-phase'}>
                  <div className="phase-row-header">
                    <span className={`phase-title ${s.is_done ? 'done' : ''}`}>
                      <span className="phase-number">{stageDisplayNumber(stageIndex)}.</span>
                      {s.is_done ? '✓ ' : ''}
                      {s.name}
                    </span>
                    <div className="phase-actions">
                      {s.is_done ? (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => void toggleStage(s)}
                        >
                          {ru.drawer.unmarkStage}
                        </button>
                      ) : !isStagePlanned(s) ? (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => void openStagePlanWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stagePlan}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-save-quiet"
                            onClick={() => void openStageCorrectWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stageCorrect}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => openDeleteStage(s, stageIndex)}
                          >
                            {ru.deleteStage.deleteStage}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => setCompletingStage(s)}
                          >
                            {ru.drawer.stageDone}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-save-quiet"
                            onClick={() => void openStageShiftWithAutoFill(s, stageIndex)}
                          >
                            {ru.drawer.stageShift}
                          </button>
                          <button
                            type="button"
                            className="btn-small btn-danger"
                            onClick={() => openDeleteStage(s, stageIndex)}
                          >
                            {ru.deleteStage.deleteStage}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {!s.is_done && (
                  <div className="phase-meta">
                    <label className="phase-date-field">
                      <span>{ru.drawer.stageStartDate}</span>
                      <input
                        key={`${s.id}-start-${s.start_date}-${stageDateInputReset}`}
                        type="date"
                        defaultValue={s.start_date ?? ''}
                        onBlur={(e) => handleStageDateBlur(s, 'start_date', e.target.value, stageIndex)}
                      />
                      {(() => {
                        const hint = stageNeedsDependencyStartFill(
                          project,
                          task,
                          s,
                          effectiveTasksById,
                          dependencyDrafts,
                          s.start_date,
                          dependencyDraftsAuthoritative
                        )
                        return hint ? (
                          <span className="dependency-start-hint muted">
                            {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                          </span>
                        ) : null
                      })()}
                    </label>
                    <label className="phase-date-field">
                      <span>{ru.drawer.stageEndDate}</span>
                      <StageEndDateInput
                        startDate={s.start_date}
                        inputKey={`${s.id}-end-${s.end_date ?? s.due_date}-${stageDateInputReset}`}
                        defaultValue={s.end_date ?? s.due_date ?? ''}
                        onBlur={(value) => void handleStageDateBlur(s, 'end_date', value, stageIndex)}
                      />
                    </label>
                    {s.note && s.note !== stageEffectiveEndDate(s) && (
                      <span className="phase-note">{s.note}</span>
                    )}
                    <StageFocusDependenciesEditor
                      focusStageId={s.id}
                      stages={orderedStages}
                      links={effectiveInternalLinks}
                      busy={internalLinksBusy === s.id}
                      saveError={
                        internalLinksError?.stageId === s.id
                          ? internalLinksError.message
                          : null
                      }
                      onSave={(deps) => saveFocusStageDeps(s, deps)}
                    />
                  </div>
                  )}
                </li>
              ))}
              {!task.sub_stages.length && <li className="muted">{ru.drawer.noStages}</li>}
            </ul>
            <form className="add-stage-form" onSubmit={addStage}>
              <label>
                {ru.drawer.pickFromTemplate}
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                >
                  <option value="">—</option>
                  {renderTemplateOptions(stageLibrary?.predefined, ru.drawer.templatePredefined)}
                  {renderTemplateOptions(stageLibrary?.custom, ru.drawer.templateCustom)}
                  {renderTemplateOptions(stageLibrary?.used, ru.drawer.templateUsed)}
                  <option value={CUSTOM_STAGE_VALUE}>{ru.drawer.customStageOption}</option>
                </select>
              </label>
              {(selectedTemplate === CUSTOM_STAGE_VALUE || !selectedTemplate) && (
                <label>
                  {ru.drawer.stageName}
                  <input
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder={ru.drawer.stageNamePlaceholder}
                  />
                </label>
              )}
              {selectedTemplate === CUSTOM_STAGE_VALUE && (
                <label className="toggle inline-toggle">
                  <input
                    type="checkbox"
                    checked={saveTemplateForReuse}
                    onChange={(e) => setSaveTemplateForReuse(e.target.checked)}
                  />
                  {ru.drawer.saveForReuse}
                </label>
              )}
              <NewStageDependencyFields
                stageName={newStageName}
                stageNumber={stageDisplayNumber(task.sub_stages.length)}
                existingStages={orderedStages}
                tasks={project.tasks}
                currentTaskId={task.id}
                crossTaskValue={newStageDependency}
                onCrossTaskChange={setNewStageDependency}
                internalDeps={newStageInternalDeps}
                onInternalDepsChange={setNewStageInternalDeps}
              />
              <label>
                {ru.drawer.stageStartDate}
                <input
                  type="date"
                  value={newStageStartDate}
                  onChange={(e) => handleNewStageStartChange(e.target.value)}
                  onBlur={() => void handleNewStageStartBlur()}
                />
                {(() => {
                  if (newStageStartDate) return null
                  if (newStageDependency?.predecessorId) {
                    const hint = suggestedStartFromDependencyDraft(
                      newStageDependency,
                      effectiveTasksById
                    )
                    return hint ? (
                      <span className="dependency-start-hint muted">
                        {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                      </span>
                    ) : null
                  }
                  if (newStageInternalDeps.some((d) => d.relation === 'after')) {
                    const hint = suggestedStartFromInternalStagePredIds(
                      orderedStages,
                      newStageInternalDeps
                        .filter((d) => d.relation === 'after')
                        .map((d) => d.refStageId)
                    )
                    return hint ? (
                      <span className="dependency-start-hint muted">
                        {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                      </span>
                    ) : null
                  }
                  return null
                })()}
              </label>
              <label>
                {ru.drawer.stageEndDate}
                <StageEndDateInput
                  key={`new-stage-end-${newStageStartDate}`}
                  startDate={newStageStartDate}
                  value={newStageEndDate}
                  onChange={setNewStageEndDate}
                />
              </label>
              <button type="submit" className="btn-small" disabled={addingStage || !newStageName.trim()}>
                {addingStage ? ru.drawer.addingStage : ru.drawer.addStage}
              </button>
            </form>
            <TaskDependenciesEditor
              task={effective}
              tasks={project.tasks}
              drafts={dependencyDrafts}
              onChange={handleDependencyDraftsChange}
              onDraftConfigured={(draft) => void offerAutofillForDependencyDraft(draft)}
            />
            {renderTabComment('stages')}
          </section>
        )}

        {activeTab === 'contractor' && (
          <section>
            <h3>{ru.drawer.contractorInfo}</h3>
            <label>
              Подрядчик
              <input
                key={`con-${effective.contractor}`}
                defaultValue={effective.contractor ?? ''}
                onBlur={(e) => patch('contractor', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.plannedCost}
              <input
                key={`pc-${effective.planned_cost}`}
                defaultValue={effective.planned_cost ?? ''}
                onBlur={(e) => patch('planned_cost', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.actualCost}
              <input
                key={`ac-${effective.actual_cost}`}
                defaultValue={effective.actual_cost ?? ''}
                onBlur={(e) => patch('actual_cost', e.target.value || null)}
              />
            </label>
            {renderTabComment('contractor')}
          </section>
        )}

        {activeTab === 'effort' && (
          <section>
            <label>
              {ru.drawer.attributeCount}
              <input
                key={`attr-${effective.attribute_count}`}
                defaultValue={effective.attribute_count ?? ''}
                onBlur={(e) => patch('attribute_count', e.target.value || null)}
              />
            </label>
            <label className="toggle inline-toggle drawer-checkbox-field">
              <input
                type="checkbox"
                checked={showcaseDevRequired}
                onChange={(e) => {
                  const checked = e.target.checked
                  setShowcaseDevRequired(checked)
                  patchCustomField(SHOWCASE_DEVELOPMENT_KEY, checked ? 'true' : 'false')
                }}
              />
              {ru.drawer.showcaseDevelopmentRequired}
            </label>
            <PlannedEffortCalculator
              key={`effort-calc-${task.id}-${effortKAn}-${effortKDev}-${effortKMa}-${effortKDm}-${showcaseDevRequired}-${effective.attribute_count}`}
              attributeCount={effective.attribute_count}
              plannedEffort={effective.planned_effort}
              showcaseDevelopmentRequired={showcaseDevRequired}
              kAn={effortKAn}
              kDev={effortKDev}
              kMa={effortKMa}
              kDm={effortKDm}
              onKAnBlur={(value) => patchCustomField(EFFORT_K_AN_KEY, value)}
              onKDevBlur={(value) => patchCustomField(EFFORT_K_DEV_KEY, value)}
              onKMaBlur={(value) => patchCustomField(EFFORT_K_MA_KEY, value)}
              onKDmBlur={(value) => patchCustomField(EFFORT_K_DM_KEY, value)}
              onApply={(effort) => {
                patch('planned_effort', effort)
                setPlannedEffortInputKey((n) => n + 1)
              }}
            />
            <label>
              {ru.drawer.plannedEffort}
              <input
                key={`pe-${effective.planned_effort}-${plannedEffortInputKey}`}
                defaultValue={effective.planned_effort ?? ''}
                onBlur={(e) => patch('planned_effort', e.target.value || null)}
              />
            </label>
            <label>
              {ru.drawer.actualEffort}
              <input
                key={`ae-${effective.actual_effort}`}
                defaultValue={effective.actual_effort ?? ''}
                onBlur={(e) => patch('actual_effort', e.target.value || null)}
              />
            </label>
            {renderTabComment('effort')}
          </section>
        )}

        {activeTab === 'other' && (
          <>
            <section>
              <h3>
                {ru.drawer.planning}
                <span className="score-badge has-score">
                  {formatScore(prioritizationScore(effective, prioritizationMethod), prioritizationMethod)}
                </span>
              </h3>
              <label>
                {ru.backlog.release}
                <select
                  key={`rel-${effective.release_id}`}
                  defaultValue={effective.release_id ?? ''}
                  onChange={(e) => patch('release_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{ru.releases.unassigned}</option>
                  {(project.releases ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {ru.backlog.goal}
                <select
                  key={`goal-${effective.goal_id}`}
                  defaultValue={effective.goal_id ?? ''}
                  onChange={(e) => patch('goal_id', e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{ru.goals.none}</option>
                  {(project.goals ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                MoSCoW
                <select
                  key={`moscow-${effective.moscow}`}
                  defaultValue={effective.moscow ?? ''}
                  onChange={(e) => patch('moscow', (e.target.value || null) as Moscow | null)}
                >
                  <option value="">—</option>
                  {MOSCOW_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {ru.backlog.moscowLabels[m]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="drawer-scoring-grid">
                <label>
                  RICE {ru.backlog.reach}
                  <input
                    type="number"
                    key={`reach-${effective.rice_reach}`}
                    defaultValue={effective.rice_reach ?? ''}
                    onBlur={(e) => patch('rice_reach', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.impact}
                  <input
                    type="number"
                    key={`impact-${effective.rice_impact}`}
                    defaultValue={effective.rice_impact ?? ''}
                    onBlur={(e) => patch('rice_impact', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.confidence}
                  <input
                    type="number"
                    key={`conf-${effective.rice_confidence}`}
                    defaultValue={effective.rice_confidence ?? ''}
                    onBlur={(e) => patch('rice_confidence', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  RICE {ru.backlog.effort}
                  <input
                    type="number"
                    key={`eff-${effective.rice_effort}`}
                    defaultValue={effective.rice_effort ?? ''}
                    onBlur={(e) => patch('rice_effort', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  {ru.backlog.value}
                  <input
                    type="number"
                    key={`val-${effective.value_score}`}
                    defaultValue={effective.value_score ?? ''}
                    onBlur={(e) => patch('value_score', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
                <label>
                  {ru.backlog.effort}
                  <input
                    type="number"
                    key={`ves-${effective.effort_score}`}
                    defaultValue={effective.effort_score ?? ''}
                    onBlur={(e) => patch('effort_score', e.target.value ? Number(e.target.value) : null)}
                  />
                </label>
              </div>
            </section>

            <section>
              <h3>{ru.drawer.factDates}</h3>
              <label>
                Начало (факт)
                <input
                  type="date"
                  key={`start-${effective.start_date}`}
                  defaultValue={effective.start_date ?? ''}
                  onBlur={async (e) => {
                    let start = e.target.value || null
                    if (!start && !effective.start_date) {
                      const fill = taskNeedsDependencyStartFill(
                        project,
                        task,
                        effectiveTasksById,
                        dependencyDrafts,
                        effective.start_date,
                        dependencyDraftsAuthoritative
                      )
                      if (fill) {
                        start = await requestDate(
                          ru.drawer.autoFillFromTaskDependencyPrompt(fill.label, fill.date),
                          fill.date,
                          ru.drawer.stageStartDate
                        )
                      }
                    }
                    stageTaskChange(task, {
                      start_date: start,
                      end_date: effective.end_date,
                    })
                  }}
                />
                {(() => {
                  const hint = taskNeedsDependencyStartFill(
                    project,
                    task,
                    effectiveTasksById,
                    dependencyDrafts,
                    effective.start_date,
                    dependencyDraftsAuthoritative
                  )
                  return hint ? (
                    <span className="dependency-start-hint muted">
                      {ru.drawer.dependencyStartHint(hint.label, hint.date)}
                    </span>
                  ) : null
                })()}
              </label>
              <label>
                Окончание (факт)
                <input
                  type="date"
                  key={`end-${effective.end_date}`}
                  defaultValue={effective.end_date ?? ''}
                  onBlur={(e) =>
                    stageTaskChange(task, {
                      start_date: effective.start_date,
                      end_date: e.target.value || null,
                    })
                  }
                />
              </label>
              {dateShifts.length > 0 && (
                <div className="drawer-date-shift">
                  <DateShiftIndicator
                    shifts={dateShifts}
                    entityKey={`task-${task.id}`}
                    entityLabel={task.name}
                  />
                </div>
              )}
              <PendingShiftComment taskId={task.id} taskName={task.name} />
            </section>

            <section>
              <label>
                Риски
                <textarea
                  key={`risks-${effective.risks}`}
                  defaultValue={effective.risks ?? ''}
                  rows={2}
                  onBlur={(e) => patch('risks', e.target.value || null)}
                />
              </label>
            </section>

            <section>
              <h3>{ru.drawer.comments}</h3>
              <div className="comment-list">
                {comments.map((c) => (
                  <div key={c.id} className="comment">
                    <div className="comment-meta">
                      <strong>{c.user_name}</strong> · {formatLocaleDateTime(c.created_at)}
                    </div>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (comment.trim()) addComment.mutate(comment.trim())
                }}
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={ru.drawer.commentPlaceholder}
                  rows={3}
                />
                <button type="submit">{ru.drawer.post}</button>
              </form>
            </section>

            <section>
              <h3>{ru.drawer.history}</h3>
              <div className="filter-chips">
                {HISTORY_FILTER_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    className={historyFilter === f.id ? 'active' : ''}
                    onClick={() => setHistoryFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="history-list">
                {history.map((h) => (
                  <div key={h.id} className="history-item">
                    <div className="history-meta">
                      <span className="badge">{ru.audit.eventType[h.event_type]}</span>
                      <strong>{h.user_name}</strong> · {formatLocaleDateTime(h.created_at)}
                    </div>
                    {h.field && (
                      <p>
                        <code>{h.field}</code>: {h.old_value ?? '—'} → {h.new_value ?? '—'}
                      </p>
                    )}
                  </div>
                ))}
                {!history.length && <p className="muted">{ru.drawer.noHistory}</p>}
              </div>
            </section>

            <section>{renderTabComment('other')}</section>

            <section className="task-drawer-danger">
              <button
                type="button"
                className="btn-danger btn-danger-block"
                disabled={deleteTask.isPending}
                onClick={handleDeleteTask}
              >
                {deleteTask.isPending ? ru.drawer.deletingTask : ru.drawer.deleteTask}
              </button>
            </section>
          </>
        )}
      </div>
    </aside>
    {completingStage && (
      <StageCompleteModal
        stage={completingStage}
        onCancel={() => setCompletingStage(null)}
        onConfirm={handleStageCompleteConfirm}
        submitting={completingStageSubmitting}
      />
    )}
    {shiftingStage && (
      <StageShiftModal
        stage={shiftingStage.stage}
        initial={shiftingStage.initial}
        mode={shiftingStage.mode}
        onCancel={cancelStageShift}
        onConfirm={handleStageShiftConfirm}
        submitting={shiftingStageSubmitting}
      />
    )}
    {dateAutoFillModal}
    {stageToDelete && (
      <DeleteStageModal
        stageName={stageToDelete.stage.name}
        isDone={stageToDelete.stage.is_done}
        warnings={stageToDelete.warnings}
        onCancel={() => setStageToDelete(null)}
        onConfirm={handleDeleteStageConfirm}
        deleting={deletingStage}
      />
    )}
  </>
  )
}

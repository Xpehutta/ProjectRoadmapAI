import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { type StageDateModalMode } from '../StageShiftModal'
import { useTaskDateShifts } from '../../hooks/useTaskDateShift'
import { useEffectiveTask } from '../../hooks/useEffectiveTasks'
import { useEffectiveTasks } from '../../hooks/useEffectiveTasks'
import { useDateAutoFillPrompt } from '../../hooks/useDateAutoFillPrompt'
import { useDeleteTask } from '../../hooks/useProject'
import { usePendingChangesStore } from '../../stores/pendingChangesStore'
import { useSavedDateShiftsStore } from '../../stores/savedDateShiftsStore'
import { useStageStatusPromptStore } from '../../stores/stageStatusPromptStore'
import { useUIStore } from '../../stores/uiStore'
import type { AuditEventType, ProjectDetail, StageTemplate, SubStage, Task } from '../../types'
import {
  CUSTOM_STAGE_VALUE,
  existingStageNameSet,
  groupStageTemplates,
  stageNameTaken,
} from '../../utils/stageTemplates'
import {
  bundleStagesToAdd,
  findStageBundle,
  isStageBundleValue,
} from '../../utils/stageBundles'
import { ru } from '../../locale/ru'
import {
  refreshProjectAfterSubStageChange,
  patchSubStageInProjectCache,
  removeSubStageFromProjectCache,
  applyTaskInternalLinksUpdate,
} from '../../utils/subStageRefresh'
import {
  sortedSubStages,
  stageNeedsFollowingStartFill,
  stageNeedsPrecedingEndFill,
  minStageEndDate,
} from '../../utils/subStageDates'
import { stageDisplayNumber } from '../../utils/subStageDeps'
import {
  indicativeRangeChanged,
  buildStageShiftEntry,
  stageDatesChanged,
  stagePlannedDates,
  isStagePlanned,
} from '../../utils/stageComplete'
import {
  mergeTaskCustomFields,
  readShowcaseDevelopmentRequired,
  tabCustomComment,
  TAB_COMMENT_KEYS,
} from '../../utils/drawerTabFields'
import {
  DEFAULT_K_AN,
  DEFAULT_K_DEV,
  DEFAULT_K_DM,
  DEFAULT_K_MA,
  EFFORT_K_AN_KEY,
  EFFORT_K_DEV_KEY,
  EFFORT_K_DM_KEY,
  EFFORT_K_MA_KEY,
} from '../../utils/effortCalculator'
import {
  draftsFromPredecessors,
  draftsToPredecessorRefs,
  parsePredecessorRefsText,
  type TaskDependencyDraft,
} from '../../utils/taskDependencyRefs'
import {
  stageNeedsDependencyStartFill,
  suggestedStartFromDependencyDraft,
} from '../../utils/taskDependencyDates'
import {
  adjustDependencyDraftsAfterStageDelete,
  collectStageDeleteWarnings,
  type StageDeleteWarning,
} from '../../utils/stageDeleteWarnings'
import {
  effectiveInternalStageLinks,
  mergeDependenciesForNewStage,
  replaceDependenciesForFocusStage,
  suggestedStartFromInternalStagePredIds,
  suggestedStartFromInternalStagePredecessors,
  type StageFocusDependency,
} from '../../utils/stageInternalDeps'
import { collectGeneralTabFieldSuggestions } from '../../utils/taskFieldSuggestions'
import type { TaskDrawerTab } from './types'

export function useTaskDrawer(project: ProjectDetail, task: Task) {
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
    const enqueueStageStatusPrompt = useStageStatusPromptStore((s) => s.enqueueTask)

    const maybePromptStageStatus = (updatedTask?: Task) => {
      if (updatedTask) enqueueStageStatusPrompt(updatedTask)
    }

    const { data: stageLibrary } = useQuery({
      queryKey: ['stage-templates', project.id],
      queryFn: () => api.getStageTemplates(project.id),
    })

    const existingStageNames = useMemo(
      () => existingStageNameSet(task.sub_stages.map((s) => s.name)),
      [task.sub_stages]
    )

    const selectedBundle = isStageBundleValue(selectedTemplate)
      ? findStageBundle(selectedTemplate)
      : undefined
    const bundleStageNamesToAdd = useMemo(() => {
      if (!selectedBundle || !stageLibrary?.predefined) return []
      return bundleStagesToAdd(selectedBundle, stageLibrary.predefined, existingStageNames)
    }, [selectedBundle, stageLibrary?.predefined, existingStageNames])

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

    const dataSourceValue = (effective.data_source ?? '').trim()
    const matchingComponent = !task.component_id
      ? project.components?.find(
          (c) => c.data_source.trim().toLowerCase() === dataSourceValue.toLowerCase()
        )
      : undefined

    const linkableComponents = (project.components ?? []).filter((c) => c.id !== task.component_id)
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

    const linkComponent = useMutation({
      mutationFn: (componentId: number) => api.linkTaskComponent(task.id, componentId),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['project', project.id] })
      },
    })

    const promoteToComponent = useMutation({
      mutationFn: (dataSource?: string) => api.promoteTaskToComponent(task.id, dataSource),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['project', project.id] })
      },
    })

    const [linkComponentId, setLinkComponentId] = useState<number | ''>('')

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
      const updatedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
      maybePromptStageStatus(updatedProject?.tasks.find((t) => t.id === task.id))
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

      if (updatedTask) maybePromptStageStatus(updatedTask)
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

    const addBundleStages = async (bundleId: string) => {
      const bundle = findStageBundle(bundleId)
      const predefined = stageLibrary?.predefined ?? []
      if (!bundle) return
      const names = bundleStagesToAdd(bundle, predefined, existingStageNames)
      if (!names.length) return

      setAddingStage(true)
      try {
        let sortOrder = task.sub_stages.length
        let links = [...effectiveInternalLinks]
        let prevStageId: number | null =
          orderedStages.length > 0 ? orderedStages[orderedStages.length - 1]!.id : null
        const createdIds: number[] = []

        for (const name of names) {
          const createdStage = await api.createSubStage(task.id, {
            name,
            sort_order: sortOrder,
            start_date: null,
            end_date: null,
            is_indicative: false,
          })
          patchSubStageInProjectCache(qc, project.id, createdStage.id, { is_indicative: false })

          const internalDeps: StageFocusDependency[] = []
          if (prevStageId !== null) {
            internalDeps.push({ refStageId: prevStageId, relation: 'after' })
          }
          if (internalDeps.length) {
            links = mergeDependenciesForNewStage(links, createdStage.id, internalDeps)
          }

          createdIds.push(createdStage.id)
          prevStageId = createdStage.id
          sortOrder += 1
        }

        if (createdIds.length) {
          const updated = await api.updateInternalStageLinks(task.id, links)
          applyTaskInternalLinksUpdate(qc, project.id, updated)
        }

        setNewStageName('')
        setNewStageStartDate('')
        setNewStageEndDate('')
        setNewStageDependency(null)
        setNewStageInternalDeps([])
        setSelectedTemplate('')
        setSaveTemplateForReuse(false)
        await refreshProjectAfterSubStageChange(qc, project.id)

        const refreshedProject = qc.getQueryData<ProjectDetail>(['project', project.id])
        const refreshedTask = refreshedProject?.tasks.find((t) => t.id === task.id)
        if (refreshedTask) maybePromptStageStatus(refreshedTask)
      } finally {
        setAddingStage(false)
      }
    }

    const addStage = async (e: FormEvent) => {
      e.preventDefault()
      if (isStageBundleValue(selectedTemplate)) {
        await addBundleStages(selectedTemplate)
        return
      }
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
      if (isStageBundleValue(value)) {
        setNewStageName('')
        setNewStageStartDate('')
        setNewStageEndDate('')
        setNewStageDependency(null)
        setNewStageInternalDeps([])
        setSaveTemplateForReuse(false)
        return
      }
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
  return {
    project,
    task,
    setSelectedTaskId,
    prioritizationMethod,
    pending,
    qc,
    historyFilter,
    setHistoryFilter,
    comment,
    setComment,
    newStageName,
    setNewStageName,
    newStageStartDate,
    setNewStageStartDate,
    newStageEndDate,
    setNewStageEndDate,
    newStageDependency,
    setNewStageDependency,
    newStageInternalDeps,
    setNewStageInternalDeps,
    addingStage,
    selectedTemplate,
    setSelectedTemplate,
    saveTemplateForReuse,
    setSaveTemplateForReuse,
    completingStage,
    setCompletingStage,
    completingStageSubmitting,
    shiftingStage,
    shiftingStageSubmitting,
    stageDateInputReset,
    internalLinksBusy,
    internalLinksError,
    stageToDelete,
    setStageToDelete,
    deletingStage,
    activeTab,
    setActiveTab,
    plannedEffortInputKey,
    setPlannedEffortInputKey,
    stageLibrary,
    existingStageNames,
    selectedBundle,
    bundleStageNamesToAdd,
    orderedStages,
    effectiveInternalLinks,
    renderTemplateOptions,
    effective,
    effectiveTasks,
    effectiveTasksById,
    generalFieldSuggestions,
    hasPending,
    dateShifts,
    linkedComponent,
    dataSourceValue,
    matchingComponent,
    linkableComponents,
    otherUsages,
    tasksById,
    dependencyDrafts,
    dependencyDraftsAuthoritative,
    handleDependencyDraftsChange,
    unlink,
    linkComponent,
    promoteToComponent,
    linkComponentId,
    setLinkComponentId,
    deleteTask,
    handleDeleteTask,
    stage,
    comments,
    history,
    addComment,
    toggleStage,
    cancelStageShift,
    handleStageCompleteConfirm,
    handleStageShiftConfirm,
    completeAll,
    openStageShiftWithAutoFill,
    openStagePlanWithAutoFill,
    openStageCorrectWithAutoFill,
    offerAutofillForDependencyDraft,
    handleNewStageStartChange,
    handleNewStageStartBlur,
    handleStageDateBlur,
    saveFocusStageDeps,
    openDeleteStage,
    handleDeleteStageConfirm,
    addStage,
    handleTemplateSelect,
    patch,
    patchCustomField,
    renderTabComment,
    indicativeFromStages,
    hasPlannedStages,
    effortKAn,
    effortKDev,
    effortKMa,
    effortKDm,
    showcaseDevRequired,
    setShowcaseDevRequired,
    dateAutoFillModal,
    stageTaskChange,
    requestDate,
  }
}

export type TaskDrawerState = ReturnType<typeof useTaskDrawer>

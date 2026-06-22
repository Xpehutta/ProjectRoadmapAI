import { useCallback, useEffect, useRef, useState } from 'react'
import { StageStatusPromptModal } from '../components/StageStatusPromptModal'
import { usePendingChangesStore } from '../stores/pendingChangesStore'
import { useStageStatusPromptStore } from '../stores/stageStatusPromptStore'
import { ru } from '../locale/ru'
import type { ProjectDetail, Task, TaskStatus } from '../types'
import { activeStagesToday } from '../utils/stageActiveToday'
import {
  dismissStageStatusPrompt,
  isStageStatusPromptDismissed,
} from '../utils/stageStatusPromptDismiss'

interface PromptItem {
  projectId: number
  task: Task
  stageNames: string[]
  currentStatus: TaskStatus
}

export function useStageStatusPrompt(project: ProjectDetail | undefined) {
  const stageTaskChange = usePendingChangesStore((s) => s.stageTaskChange)
  const setTaskStatusComment = usePendingChangesStore((s) => s.setTaskStatusComment)
  const taskChanges = usePendingChangesStore((s) => s.taskChanges)
  const [queue, setQueue] = useState<PromptItem[]>([])
  const scannedProjectRef = useRef<number | null>(null)

  const enqueue = useCallback((item: PromptItem) => {
    setQueue((prev) => {
      if (prev.some((p) => p.task.id === item.task.id)) return prev
      return [...prev, item]
    })
  }, [])

  const buildPromptItem = useCallback(
    (task: Task): PromptItem | null => {
      if (!project) return null
      const stages = activeStagesToday(task.sub_stages ?? [])
      if (!stages.length) return null
      const patch = taskChanges[task.id]?.patch
      const currentStatus = (patch?.status as TaskStatus | undefined) ?? task.status
      if (currentStatus === 'in_progress') return null
      if (isStageStatusPromptDismissed(project.id, task.id)) return null
      return {
        projectId: project.id,
        task,
        stageNames: stages.map((s) => s.name),
        currentStatus,
      }
    },
    [project, taskChanges]
  )

  const maybePromptForTask = useCallback(
    (task: Task) => {
      const item = buildPromptItem(task)
      if (item) enqueue(item)
    },
    [buildPromptItem, enqueue]
  )

  const setEnqueueTask = useStageStatusPromptStore((s) => s.setEnqueueTask)

  useEffect(() => {
    setEnqueueTask(maybePromptForTask)
    return () => setEnqueueTask(() => {})
  }, [maybePromptForTask, setEnqueueTask])

  useEffect(() => {
    if (!project) {
      scannedProjectRef.current = null
      setQueue([])
      return
    }
    if (scannedProjectRef.current === project.id) return
    scannedProjectRef.current = project.id
    setQueue([])
    for (const task of project.tasks) {
      const item = buildPromptItem(task)
      if (item) enqueue(item)
    }
  }, [project, buildPromptItem, enqueue])

  const current = queue[0] ?? null

  const finishCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1))
  }, [])

  const handleDismiss = useCallback(() => {
    if (!current) return
    dismissStageStatusPrompt(current.projectId, current.task.id)
    finishCurrent()
  }, [current, finishCurrent])

  const handleConfirm = useCallback(
    (status: TaskStatus, comment: string | null) => {
      if (!current) return
      const { task, projectId, currentStatus, stageNames } = current
      dismissStageStatusPrompt(projectId, task.id)
      if (status !== currentStatus) {
        stageTaskChange(task, { status })
        if (comment) {
          const prefix = ru.stageStatusPrompt.commentPrefix(stageNames.join(', '))
          setTaskStatusComment(task.id, `${prefix}: ${comment}`)
        }
      }
      finishCurrent()
    },
    [current, finishCurrent, setTaskStatusComment, stageTaskChange]
  )

  const modal = current ? (
    <StageStatusPromptModal
      taskName={current.task.name}
      stageNames={current.stageNames}
      currentStatus={current.currentStatus}
      onConfirm={(status, comment) => void handleConfirm(status, comment)}
      onDismiss={handleDismiss}
    />
  ) : null

  return { stageStatusPromptModal: modal }
}

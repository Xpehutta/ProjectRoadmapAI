import { todayIso } from './stageActiveToday'

const STORAGE_PREFIX = 'roadmap-status-prompt-dismiss'

function dismissKey(projectId: number, taskId: number, day: string): string {
  return `${STORAGE_PREFIX}-${projectId}-${taskId}-${day}`
}

export function isStageStatusPromptDismissed(
  projectId: number,
  taskId: number,
  day = todayIso()
): boolean {
  return localStorage.getItem(dismissKey(projectId, taskId, day)) === '1'
}

export function dismissStageStatusPrompt(
  projectId: number,
  taskId: number,
  day = todayIso()
): void {
  localStorage.setItem(dismissKey(projectId, taskId, day), '1')
}

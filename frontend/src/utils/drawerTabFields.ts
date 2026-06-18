import type { Task } from '../types'

export const TAB_COMMENT_KEYS = {
  general: 'drawer_comment_general',
  stages: 'drawer_comment_stages',
  contractor: 'drawer_comment_contractor',
  effort: 'drawer_comment_effort',
} as const

export const SHOWCASE_DEVELOPMENT_KEY = 'showcase_development_required'

export function mergeTaskCustomFields(
  task: Task,
  patch?: Record<string, unknown>
): Record<string, string> {
  return {
    ...(task.custom_fields ?? {}),
    ...((patch?.custom_fields as Record<string, string> | undefined) ?? {}),
  }
}

export function tabCustomComment(task: Task, key: string): string {
  return task.custom_fields?.[key] ?? ''
}

export function isShowcaseDevelopmentRequired(task: Task): boolean {
  const value = task.custom_fields?.[SHOWCASE_DEVELOPMENT_KEY]
  return value === 'true' || value === '1'
}

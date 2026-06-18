import type { Task } from '../types'

export const TAB_COMMENT_KEYS = {
  general: 'drawer_comment_general',
  stages: 'drawer_comment_stages',
  contractor: 'drawer_comment_contractor',
  effort: 'drawer_comment_effort',
} as const

export const SHOWCASE_DEVELOPMENT_KEY = 'showcase_development_required'

export function normalizeCustomFields(
  fields: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!fields) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === true) out[key] = 'true'
    else if (value === false) out[key] = 'false'
    else if (value != null && value !== '') out[key] = String(value)
  }
  return out
}

export function mergeTaskCustomFields(
  task: Task,
  patch?: Record<string, unknown>
): Record<string, string> {
  return {
    ...normalizeCustomFields(task.custom_fields as Record<string, unknown> | null | undefined),
    ...normalizeCustomFields(
      (patch?.custom_fields as Record<string, unknown> | undefined) ?? undefined
    ),
  }
}

export function customFieldsEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(normalizeCustomFields(a as Record<string, unknown> | null | undefined)) ===
    JSON.stringify(normalizeCustomFields(b as Record<string, unknown> | null | undefined))
  )
}

export function tabCustomComment(task: Task, key: string): string {
  return normalizeCustomFields(task.custom_fields as Record<string, unknown> | null | undefined)[
    key
  ] ?? ''
}

export function readShowcaseDevelopmentRequired(
  fields: Record<string, unknown> | null | undefined
): boolean {
  const value = normalizeCustomFields(fields)[SHOWCASE_DEVELOPMENT_KEY]
  return value === 'true' || value === '1'
}

export function isShowcaseDevelopmentRequired(task: Task): boolean {
  return readShowcaseDevelopmentRequired(
    task.custom_fields as Record<string, unknown> | null | undefined
  )
}

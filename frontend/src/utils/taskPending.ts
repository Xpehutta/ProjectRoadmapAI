import type { Task } from '../types'

/** Fields stored on shared components — kept in sync with backend SHARED_TASK_FIELDS */
export const COMPONENT_SHARED_FIELDS = [
  'assignee',
  'status',
  'completion_pct',
  'start_date',
  'end_date',
  'duration_days',
  'indicative_start',
  'indicative_end',
  'contractor',
  'platform',
] as const satisfies readonly (keyof Task)[]

export function taskEditSnapshot(task: Task): Record<string, unknown> {
  return {
    name: task.name,
    category_id: task.category_id,
    start_date: task.start_date,
    end_date: task.end_date,
    indicative_start: task.indicative_start,
    indicative_end: task.indicative_end,
    duration_days: task.duration_days,
    assignee: task.assignee,
    planned_cost: task.planned_cost,
    actual_cost: task.actual_cost,
    planned_effort: task.planned_effort,
    actual_effort: task.actual_effort,
    status: task.status,
    priority: task.priority,
    release_id: task.release_id,
    goal_id: task.goal_id,
    moscow: task.moscow,
    rice_reach: task.rice_reach,
    rice_impact: task.rice_impact,
    rice_confidence: task.rice_confidence,
    rice_effort: task.rice_effort,
    value_score: task.value_score,
    effort_score: task.effort_score,
    subproduct: task.subproduct,
    forms: task.forms,
    customer: task.customer,
    data_source: task.data_source,
    platform: task.platform,
    area: task.area,
    contractor: task.contractor,
    desired_quarter: task.desired_quarter,
    attribute_count: task.attribute_count,
    risks: task.risks,
    notes: task.notes,
    extra_info: task.extra_info,
    custom_fields: task.custom_fields ?? {},
    predecessor_refs: task.predecessors.map((p) => p.name).join(', '),
  }
}

export function normValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return normValue(a) === normValue(b)
}

export function applyPendingToTask(
  task: Task,
  patch: Record<string, unknown> | undefined
): Task {
  if (!patch || Object.keys(patch).length === 0) return task
  const merged = { ...task, ...patch } as Task
  if (patch.custom_fields && typeof patch.custom_fields === 'object') {
    merged.custom_fields = {
      ...(task.custom_fields ?? {}),
      ...(patch.custom_fields as Record<string, string>),
    }
  }
  if (typeof patch.predecessor_refs === 'string') {
    // display only; predecessors array stays until save
    return merged
  }
  return merged
}

export function buildComponentPendingPatches(
  tasks: Task[],
  taskChanges: Record<number, { taskId: number; patch: Record<string, unknown> }>
): Map<number, Record<string, unknown>> {
  const tasksById = new Map(tasks.map((t) => [t.id, t]))
  const byComponent = new Map<number, Record<string, unknown>>()
  for (const change of Object.values(taskChanges)) {
    const task = tasksById.get(change.taskId)
    if (!task?.component_id) continue
    const merged = { ...(byComponent.get(task.component_id) ?? {}) }
    for (const field of COMPONENT_SHARED_FIELDS) {
      if (field in change.patch) merged[field] = change.patch[field]
    }
    byComponent.set(task.component_id, merged)
  }
  return byComponent
}

export function resolveEffectivePatch(
  task: Task,
  taskChanges: Record<number, { patch: Record<string, unknown> }>,
  componentPatches: Map<number, Record<string, unknown>>
): Record<string, unknown> | undefined {
  const own = taskChanges[task.id]?.patch
  const shared = task.component_id ? componentPatches.get(task.component_id) : undefined
  if (!own && !shared) return undefined
  return { ...shared, ...own }
}

export function isTaskDisplayPending(
  taskId: number,
  base: Task,
  effective: Task,
  taskChanges: Record<number, unknown>
): boolean {
  if (taskChanges[taskId]) return true
  if (!base.component_id) return false
  return COMPONENT_SHARED_FIELDS.some((field) => base[field] !== effective[field])
}

export function getPendingField<T>(
  task: Task,
  patch: Record<string, unknown> | undefined,
  field: keyof Task
): T | undefined {
  if (patch && field in patch) return patch[field as string] as T
  return task[field] as T
}

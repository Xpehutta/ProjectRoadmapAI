import type {
  AuditEvent,
  Category,
  Comment,
  Goal,
  Milestone,
  Project,
  ProjectComponent,
  ProjectDetail,
  Release,
  SubStage,
  StageTemplate,
  StageTemplateLibrary,
  TableColumnLibrary,
  TableColumnSchema,
  Task,
  TaskPatchResponse,
} from '../types'
import { ru } from '../locale/ru'

const USER_KEY = 'roadmap-user-name'

export function getUserName(): string {
  return localStorage.getItem(USER_KEY) || ''
}

export function setUserName(name: string): void {
  localStorage.setItem(USER_KEY, name)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const userName = getUserName()
  if (userName) headers['X-User-Name'] = userName

  const res = await fetch(path, { ...options, headers })
  if (res.status === 409) {
    const body = await res.json()
    throw new ConflictError(body.detail?.message || ru.errors.versionConflict, body.detail?.current)
  }
  if (!res.ok) {
    const text = await res.text()
    let message = text || res.statusText
    try {
      const body = JSON.parse(text) as { detail?: unknown }
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      /* plain-text error */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export class ConflictError extends Error {
  current: unknown
  constructor(message: string, current: unknown) {
    super(message)
    this.name = 'ConflictError'
    this.current = current
  }
}

export const api = {
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (body: { name: string; description?: string | null }) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importProject: (file: File, name?: string, description?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (name?.trim()) form.append('name', name.trim())
    if (description?.trim()) form.append('description', description.trim())
    return request<Project>('/api/projects/import', {
      method: 'POST',
      body: form,
    })
  },
  getProject: (id: number) => request<ProjectDetail>(`/api/projects/${id}`),
  updateTask: (id: number, body: Record<string, unknown>) =>
    request<TaskPatchResponse>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createTask: (projectId: number, body: Record<string, unknown>) =>
    request<Task>(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  createCategory: (projectId: number, body: Record<string, unknown>) =>
    request<Category>(`/api/projects/${projectId}/categories`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCategory: (projectId: number, id: number, body: Record<string, unknown>) =>
    request<Category>(`/api/projects/${projectId}/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCategory: (projectId: number, id: number) =>
    request<void>(`/api/projects/${projectId}/categories/${id}`, { method: 'DELETE' }),
  createRelease: (projectId: number, body: Record<string, unknown>) =>
    request<Release>(`/api/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateRelease: (projectId: number, id: number, body: Record<string, unknown>) =>
    request<Release>(`/api/projects/${projectId}/releases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteRelease: (projectId: number, id: number) =>
    request<void>(`/api/projects/${projectId}/releases/${id}`, { method: 'DELETE' }),
  createGoal: (projectId: number, body: Record<string, unknown>) =>
    request<Goal>(`/api/projects/${projectId}/goals`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateGoal: (projectId: number, id: number, body: Record<string, unknown>) =>
    request<Goal>(`/api/projects/${projectId}/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteGoal: (projectId: number, id: number) =>
    request<void>(`/api/projects/${projectId}/goals/${id}`, { method: 'DELETE' }),
  createMilestone: (projectId: number, body: Record<string, unknown>) =>
    request<Milestone>(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMilestone: (projectId: number, id: number, body: Record<string, unknown>) =>
    request<Milestone>(`/api/projects/${projectId}/milestones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMilestone: (projectId: number, id: number) =>
    request<void>(`/api/projects/${projectId}/milestones/${id}`, { method: 'DELETE' }),
  getComments: (taskId: number) => request<Comment[]>(`/api/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) =>
    request<Comment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  getHistory: (taskId: number, eventType?: string) => {
    const q = eventType ? `?event_type=${eventType}` : ''
    return request<AuditEvent[]>(`/api/tasks/${taskId}/history${q}`)
  },
  getProjectAudit: (projectId: number, eventType?: string) => {
    const q = eventType ? `?event_type=${eventType}` : ''
    return request<AuditEvent[]>(`/api/projects/${projectId}/audit${q}`)
  },
  updateSubStage: (taskId: number, stageId: number, body: Record<string, unknown>) =>
    request<SubStage>(`/api/tasks/${taskId}/sub-stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  completeAllSubStages: (taskId: number) =>
    request<SubStage[]>(`/api/tasks/${taskId}/sub-stages/complete-all`, {
      method: 'POST',
    }),
  createSubStage: (taskId: number, body: Record<string, unknown>) =>
    request<SubStage>(`/api/tasks/${taskId}/sub-stages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listComponents: (projectId: number) =>
    request<ProjectComponent[]>(`/api/projects/${projectId}/components`),
  unlinkTaskComponent: (taskId: number) =>
    request<Task>(`/api/tasks/${taskId}/unlink-component`, { method: 'POST' }),
  linkTaskComponent: (taskId: number, componentId: number) =>
    request<ProjectComponent>(`/api/tasks/${taskId}/link-component/${componentId}`, {
      method: 'POST',
    }),
  getStageTemplates: (projectId: number) =>
    request<StageTemplateLibrary>(`/api/projects/${projectId}/stage-templates`),
  addStageTemplate: (projectId: number, body: { name: string; group?: string | null; full_label?: string }) =>
    request<StageTemplate>(`/api/projects/${projectId}/stage-templates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getTableColumns: (projectId: number) =>
    request<TableColumnLibrary>(`/api/projects/${projectId}/table-columns`),
  addTableColumn: (
    projectId: number,
    body: { label?: string; builtin_key?: string }
  ) =>
    request<TableColumnSchema>(`/api/projects/${projectId}/table-columns`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteTableColumn: (projectId: number, columnKey: string) =>
    request<void>(`/api/projects/${projectId}/table-columns/${encodeURIComponent(columnKey)}`, {
      method: 'DELETE',
    }),
}

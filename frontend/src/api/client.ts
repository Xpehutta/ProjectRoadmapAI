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
  StageInternalLink,
  StageTemplate,
  StageTemplateLibrary,
  TableColumnLibrary,
  TableColumnSchema,
  Task,
  TaskPatchResponse,
} from '../types'
import { ru } from '../locale/ru'

const USER_KEY = 'roadmap-user-name'
const NOTIFICATION_EMAIL_KEY = 'roadmap-notification-email'

export function getUserName(): string {
  return localStorage.getItem(USER_KEY) || ''
}

export function setUserName(name: string): void {
  localStorage.setItem(USER_KEY, name)
}

export function getNotificationEmail(): string {
  return localStorage.getItem(NOTIFICATION_EMAIL_KEY) || ''
}

export function setNotificationEmail(email: string): void {
  localStorage.setItem(NOTIFICATION_EMAIL_KEY, email)
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
  createProject: (body: {
    name: string
    description?: string | null
    create_jira_epic?: boolean
  }) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getJiraStatus: () =>
    request<{ configured: boolean; project_key: string | null }>('/api/jira/status'),
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
  deleteProject: (id: number) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
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
  deleteSubStage: (taskId: number, stageId: number) =>
    request<void>(`/api/tasks/${taskId}/sub-stages/${stageId}`, { method: 'DELETE' }),
  completeAllSubStages: (taskId: number) =>
    request<SubStage[]>(`/api/tasks/${taskId}/sub-stages/complete-all`, {
      method: 'POST',
    }),
  createSubStage: (taskId: number, body: Record<string, unknown>) =>
    request<SubStage>(`/api/tasks/${taskId}/sub-stages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateInternalStageLinks: (taskId: number, links: StageInternalLink[]) =>
    request<Task>(`/api/tasks/${taskId}/sub-stages/internal-links`, {
      method: 'PUT',
      body: JSON.stringify({ links }),
    }),
  listComponents: (projectId: number) =>
    request<ProjectComponent[]>(`/api/projects/${projectId}/components`),
  createComponent: (
    projectId: number,
    body: { name: string; data_source: string }
  ) =>
    request<ProjectComponent>(`/api/projects/${projectId}/components`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  unlinkTaskComponent: (taskId: number) =>
    request<Task>(`/api/tasks/${taskId}/unlink-component`, { method: 'POST' }),
  linkTaskComponent: (taskId: number, componentId: number) =>
    request<ProjectComponent>(`/api/tasks/${taskId}/link-component/${componentId}`, {
      method: 'POST',
    }),
  promoteTaskToComponent: (taskId: number, dataSource?: string) =>
    request<ProjectComponent>(`/api/tasks/${taskId}/promote-to-component`, {
      method: 'POST',
      body: JSON.stringify({ data_source: dataSource ?? null }),
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
  getChatStatus: (projectId: number) =>
    request<{ configured: boolean; model: string | null }>(`/api/projects/${projectId}/chat/status`),
  sendChatMessage: (projectId: number, messages: { role: 'user' | 'assistant'; content: string }[]) =>
    request<{ reply: string; model: string }>(`/api/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  getNotificationStatus: (projectId: number, email: string) =>
    request<{ subscribed: boolean; email: string | null; notifications_configured: boolean }>(
      `/api/projects/${projectId}/notifications/status?email=${encodeURIComponent(email)}`
    ),
  subscribeNotifications: (projectId: number, email: string) =>
    request<{ subscribed: boolean; email: string | null; notifications_configured: boolean }>(
      `/api/projects/${projectId}/notifications/subscribe`,
      { method: 'POST', body: JSON.stringify({ email }) }
    ),
  unsubscribeNotifications: (projectId: number, email: string) =>
    request<{ subscribed: boolean; email: string | null; notifications_configured: boolean }>(
      `/api/projects/${projectId}/notifications/subscribe?email=${encodeURIComponent(email)}`,
      { method: 'DELETE' }
    ),
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export type AuditEventType = 'dates' | 'cost' | 'effort' | 'comment' | 'status' | 'other'
export type ViewMode = 'gantt' | 'timeline' | 'kanban' | 'table' | 'backlog' | 'release_board'
export type GroupingMode = 'color' | 'swimlane'
export type ReleaseStatus = 'planned' | 'in_progress' | 'released'
export type Moscow = 'must' | 'should' | 'could' | 'wont'
export type PrioritizationMethod = 'rice' | 'value_effort' | 'moscow'

export interface Category {
  id: number
  project_id: number
  name: string
  color: string
  sort_order: number
}

export interface Release {
  id: number
  project_id: number
  name: string
  target_date: string | null
  status: ReleaseStatus
  color: string
  sort_order: number
  description: string | null
}

export interface Goal {
  id: number
  project_id: number
  name: string
  description: string | null
  color: string
  sort_order: number
}

export interface SubStage {
  id: number
  task_id: number
  name: string
  sort_order: number
  is_done: boolean
  due_date: string | null
  start_date: string | null
  end_date: string | null
  note: string | null
  is_indicative: boolean
  predecessor_stage_ids: number[]
}

export type StageInternalLinkRelation = 'after' | 'before'

export interface StageInternalLink {
  first_stage_id: number
  second_stage_id: number
  relation: StageInternalLinkRelation
}

export interface PredecessorRef {
  id: number
  name: string
  type: DependencyType
  predecessor_stage_id?: number | null
  predecessor_stage_name?: string | null
  predecessor_stage_number?: number | null
  successor_stage_id?: number | null
  successor_stage_name?: string | null
  successor_stage_number?: number | null
}

export interface ProjectComponent {
  id: number
  project_id: number
  name: string
  data_source: string
  assignee: string | null
  status: TaskStatus
  completion_pct: number
  version: number
  start_date: string | null
  end_date: string | null
  duration_days: number | null
  indicative_start: string | null
  indicative_end: string | null
  contractor: string | null
  platform: string | null
  notes: string | null
  usage_count: number
  usages: ComponentUsage[]
  sub_stages: SubStage[]
}

export interface ComponentUsage {
  id: number
  name: string
  category_id: number | null
}

export interface Task {
  id: number
  project_id: number
  category_id: number | null
  name: string
  assignee: string | null
  status: TaskStatus
  completion_pct: number
  version: number
  start_date: string | null
  end_date: string | null
  duration_days: number | null
  indicative_start: string | null
  indicative_end: string | null
  planned_cost: string | null
  actual_cost: string | null
  planned_effort: string | null
  actual_effort: string | null
  priority: number | null
  release_id: number | null
  goal_id: number | null
  moscow: Moscow | null
  rice_reach: number | null
  rice_impact: number | null
  rice_confidence: number | null
  rice_effort: number | null
  value_score: number | null
  effort_score: number | null
  subproduct: string | null
  forms: string | null
  customer: string | null
  data_source: string | null
  platform: string | null
  area: string | null
  contractor: string | null
  desired_quarter: string | null
  attribute_count: string | null
  risks: string | null
  notes: string | null
  extra_info: string | null
  custom_fields?: Record<string, string> | null
  component_id: number | null
  component_name: string | null
  component_version: number | null
  component_usage_count: number
  sub_stages: SubStage[]
  predecessors: PredecessorRef[]
  internal_stage_links: StageInternalLink[]
}

export interface Milestone {
  id: number
  project_id: number
  name: string
  date: string
  description: string | null
}

export interface Dependency {
  id: number
  project_id: number
  predecessor_id: number
  successor_id: number
  predecessor_stage_id?: number | null
  successor_stage_id?: number | null
  type: DependencyType
  lag_days: number
}

export interface Project {
  id: number
  name: string
  description: string | null
  table_schema: TableColumnSchema[] | null
  created_at: string
}

export interface TableColumnSchema {
  key: string
  label: string
  type: string
  source: 'builtin' | 'custom'
}

export interface TableColumnLibrary {
  columns: TableColumnSchema[]
  hidden_builtin: TableColumnSchema[]
}

export interface StageTemplate {
  name: string
  group: string | null
  full_label: string
  source?: 'predefined' | 'custom' | 'used'
}

export interface StageTemplateLibrary {
  predefined: StageTemplate[]
  custom: StageTemplate[]
  used: StageTemplate[]
  all: StageTemplate[]
}

export interface ProjectDetail extends Project {
  categories: Category[]
  components: ProjectComponent[]
  releases: Release[]
  goals: Goal[]
  tasks: Task[]
  milestones: Milestone[]
  dependencies: Dependency[]
}

export interface Comment {
  id: number
  task_id: number
  user_name: string
  body: string
  created_at: string
}

export interface AuditEvent {
  id: number
  task_id: number
  user_name: string
  event_type: AuditEventType
  field: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface TaskPatchResponse {
  task: Task
  affected_tasks: Task[]
}

from datetime import date as Date
from datetime import datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import AuditEventType, DependencyType, Moscow, ReleaseStatus, TaskStatus


class CategoryBase(BaseModel):
    name: str
    color: str = "#3b82f6"
    sort_order: int = 0


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    sort_order: int | None = None


class CategoryOut(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class SubStageBase(BaseModel):
    name: str
    sort_order: int = 0
    is_done: bool = False
    due_date: Date | None = None
    start_date: Date | None = None
    end_date: Date | None = None
    note: str | None = None
    is_indicative: bool = False
    predecessor_stage_ids: list[int] = Field(default_factory=list)

    @field_validator("predecessor_stage_ids", mode="before")
    @classmethod
    def _default_predecessors(cls, value: list[int] | None) -> list[int]:
        return value or []


class SubStageCreate(SubStageBase):
    pass


class SubStageUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    is_done: bool | None = None
    due_date: Date | None = None
    start_date: Date | None = None
    end_date: Date | None = None
    note: str | None = None
    is_indicative: bool | None = None
    predecessor_stage_ids: list[int] | None = None


class SubStageOut(SubStageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int


class StageInternalLinkOut(BaseModel):
    first_stage_id: int
    second_stage_id: int
    relation: Literal["after", "before"]


class StageInternalLinksUpdate(BaseModel):
    links: list[StageInternalLinkOut] = Field(default_factory=list)


class DependencyBase(BaseModel):
    predecessor_id: int
    successor_id: int
    predecessor_stage_id: int | None = None
    successor_stage_id: int | None = None
    type: DependencyType = DependencyType.FS
    lag_days: int = 0


class DependencyCreate(DependencyBase):
    pass


class DependencyOut(DependencyBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class TaskBase(BaseModel):
    name: str
    category_id: int | None = None
    assignee: str | None = None
    status: TaskStatus = TaskStatus.todo
    start_date: Date | None = None
    end_date: Date | None = None
    duration_days: int | None = None
    indicative_start: Date | None = None
    indicative_end: Date | None = None
    planned_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    planned_effort: Decimal | None = None
    actual_effort: Decimal | None = None
    priority: int | None = None
    release_id: int | None = None
    goal_id: int | None = None
    moscow: Moscow | None = None
    rice_reach: int | None = None
    rice_impact: int | None = None
    rice_confidence: int | None = None
    rice_effort: int | None = None
    value_score: int | None = None
    effort_score: int | None = None
    subproduct: str | None = None
    forms: str | None = None
    customer: str | None = None
    data_source: str | None = None
    platform: str | None = None
    area: str | None = None
    contractor: str | None = None
    desired_quarter: str | None = None
    attribute_count: str | None = None
    risks: str | None = None
    notes: str | None = None
    extra_info: str | None = None
    custom_fields: dict | None = None


class TaskCreate(TaskBase):
    predecessor_refs: list[str] | None = None


class TaskUpdate(BaseModel):
    version: int
    name: str | None = None
    category_id: int | None = None
    assignee: str | None = None
    status: TaskStatus | None = None
    start_date: Date | None = None
    end_date: Date | None = None
    duration_days: int | None = None
    indicative_start: Date | None = None
    indicative_end: Date | None = None
    planned_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    planned_effort: Decimal | None = None
    actual_effort: Decimal | None = None
    priority: int | None = None
    release_id: int | None = None
    goal_id: int | None = None
    moscow: Moscow | None = None
    rice_reach: int | None = None
    rice_impact: int | None = None
    rice_confidence: int | None = None
    rice_effort: int | None = None
    value_score: int | None = None
    effort_score: int | None = None
    subproduct: str | None = None
    forms: str | None = None
    customer: str | None = None
    data_source: str | None = None
    platform: str | None = None
    area: str | None = None
    contractor: str | None = None
    desired_quarter: str | None = None
    attribute_count: str | None = None
    risks: str | None = None
    notes: str | None = None
    extra_info: str | None = None
    custom_fields: dict | None = None
    predecessor_refs: list[str] | None = None


class PredecessorRef(BaseModel):
    id: int
    name: str
    type: DependencyType
    predecessor_stage_id: int | None = None
    predecessor_stage_name: str | None = None
    predecessor_stage_number: int | None = None
    successor_stage_id: int | None = None
    successor_stage_name: str | None = None
    successor_stage_number: int | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    completion_pct: int
    version: int
    component_id: int | None = None
    component_name: str | None = None
    component_version: int | None = None
    component_usage_count: int = 0
    sub_stages: list[SubStageOut] = []
    predecessors: list[PredecessorRef] = []
    internal_stage_links: list[StageInternalLinkOut] = Field(default_factory=list)


class TaskPatchResponse(BaseModel):
    task: TaskOut
    affected_tasks: list[TaskOut] = []


class MilestoneBase(BaseModel):
    name: str
    date: Date
    description: str | None = None


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    name: str | None = None
    date: Date | None = None
    description: str | None = None


class MilestoneOut(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class ReleaseBase(BaseModel):
    name: str
    target_date: Date | None = None
    status: ReleaseStatus = ReleaseStatus.planned
    color: str = "#6366f1"
    sort_order: int = 0
    description: str | None = None


class ReleaseCreate(ReleaseBase):
    pass


class ReleaseUpdate(BaseModel):
    name: str | None = None
    target_date: Date | None = None
    status: ReleaseStatus | None = None
    color: str | None = None
    sort_order: int | None = None
    description: str | None = None


class ReleaseOut(ReleaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class GoalBase(BaseModel):
    name: str
    description: str | None = None
    color: str = "#059669"
    sort_order: int = 0


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    sort_order: int | None = None


class GoalOut(GoalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class ComponentBase(BaseModel):
    name: str
    data_source: str
    assignee: str | None = None
    status: TaskStatus = TaskStatus.todo
    start_date: Date | None = None
    end_date: Date | None = None
    duration_days: int | None = None
    indicative_start: Date | None = None
    indicative_end: Date | None = None
    contractor: str | None = None
    platform: str | None = None
    notes: str | None = None


class ComponentCreate(ComponentBase):
    pass


class ComponentUpdate(BaseModel):
    version: int
    name: str | None = None
    data_source: str | None = None
    assignee: str | None = None
    status: TaskStatus | None = None
    start_date: Date | None = None
    end_date: Date | None = None
    duration_days: int | None = None
    indicative_start: Date | None = None
    indicative_end: Date | None = None
    contractor: str | None = None
    platform: str | None = None
    notes: str | None = None


class PromoteToComponentBody(BaseModel):
    data_source: str | None = None


class ComponentUsageOut(BaseModel):
    id: int
    name: str
    category_id: int | None = None


class ComponentOut(ComponentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    completion_pct: int
    version: int
    usage_count: int = 0
    usages: list[ComponentUsageOut] = []
    sub_stages: list[SubStageOut] = []


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    user_name: str
    body: str
    created_at: datetime


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    user_name: str
    event_type: AuditEventType
    field: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    table_schema: list[dict] | None = None
    stage_templates: list[dict] | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class ProjectDetail(ProjectOut):
    categories: list[CategoryOut] = []
    components: list[ComponentOut] = []
    releases: list[ReleaseOut] = []
    goals: list[GoalOut] = []
    tasks: list[TaskOut] = []
    milestones: list[MilestoneOut] = []
    dependencies: list[DependencyOut] = []


class ConflictError(BaseModel):
    detail: str
    current: TaskOut


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class ChatResponse(BaseModel):
    reply: str
    model: str


class ChatStatusResponse(BaseModel):
    configured: bool
    model: str | None = None

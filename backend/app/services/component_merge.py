"""Merge reusable project components into task API responses."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ComponentSubStage, ProjectComponent, Task, TaskSubStage
from app.schemas import SubStageOut

SHARED_TASK_FIELDS = frozenset(
    {
        "assignee",
        "status",
        "completion_pct",
        "start_date",
        "end_date",
        "duration_days",
        "indicative_start",
        "indicative_end",
        "contractor",
        "platform",
    }
)


def component_stage_to_out(stage: ComponentSubStage) -> SubStageOut:
    return SubStageOut(
        id=stage.id,
        task_id=0,
        name=stage.name,
        sort_order=stage.sort_order,
        is_done=stage.is_done,
        due_date=stage.due_date,
        note=stage.note,
        is_indicative=stage.is_indicative,
    )


def split_task_changes(changes: dict) -> tuple[dict, dict]:
    component_changes = {k: v for k, v in changes.items() if k in SHARED_TASK_FIELDS}
    task_changes = {k: v for k, v in changes.items() if k not in SHARED_TASK_FIELDS}
    return component_changes, task_changes


def effective_sub_stages(task: Task) -> list[SubStageOut]:
    if task.component and task.component.sub_stages:
        return [component_stage_to_out(s) for s in task.component.sub_stages]
    return [SubStageOut.model_validate(s) for s in task.sub_stages]


def merge_task_fields(task: Task) -> dict:
    data = {
        "assignee": task.assignee,
        "status": task.status,
        "completion_pct": task.completion_pct,
        "start_date": task.start_date,
        "end_date": task.end_date,
        "duration_days": task.duration_days,
        "indicative_start": task.indicative_start,
        "indicative_end": task.indicative_end,
        "contractor": task.contractor,
        "platform": task.platform,
        "component_id": task.component_id,
        "component_name": None,
        "component_version": None,
        "component_usage_count": 0,
    }
    if task.component:
        comp = task.component
        for field in SHARED_TASK_FIELDS:
            data[field] = getattr(comp, field)
        data["component_name"] = comp.name
        data["component_version"] = comp.version
        data["component_usage_count"] = len(comp.tasks) if comp.tasks else 0
    return data


def copy_component_to_task(task: Task, component: ProjectComponent) -> None:
    for field in SHARED_TASK_FIELDS:
        setattr(task, field, getattr(component, field))
    task.data_source = component.data_source


def copy_component_stages_to_task(db: Session, task: Task, component: ProjectComponent) -> None:
    db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).delete()
    for stage in component.sub_stages:
        db.add(
            TaskSubStage(
                task_id=task.id,
                name=stage.name,
                sort_order=stage.sort_order,
                is_done=stage.is_done,
                due_date=stage.due_date,
                note=stage.note,
                is_indicative=stage.is_indicative,
            )
        )

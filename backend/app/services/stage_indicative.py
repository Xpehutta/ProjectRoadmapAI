"""Derive task/component dates from sub-stage planned and completed dates."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models import ComponentSubStage, ProjectComponent, Task, TaskSubStage


def _stage_start(stage: TaskSubStage | ComponentSubStage) -> date | None:
    return stage.start_date or stage.end_date or stage.due_date


def _stage_end(stage: TaskSubStage | ComponentSubStage) -> date | None:
    return stage.end_date or stage.due_date or stage.start_date


def indicative_dates_from_stages(
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> tuple[date | None, date | None]:
    starts = [start for s in stages if (start := _stage_start(s))]
    ends = [end for s in stages if (end := _stage_end(s))]
    return (
        min(starts) if starts else None,
        max(ends) if ends else None,
    )


def indicative_dates_from_stage_outs(stages) -> tuple[date | None, date | None]:
    """Compute indicative range from API sub-stage objects (SubStageOut)."""
    starts = [s.start_date or s.end_date or s.due_date for s in stages]
    starts = [d for d in starts if d]
    ends = [s.end_date or s.due_date or s.start_date for s in stages]
    ends = [d for d in ends if d]
    return (
        min(starts) if starts else None,
        max(ends) if ends else None,
    )


def actual_dates_from_completed_stages(
    stages: list[TaskSubStage] | list[ComponentSubStage],
) -> tuple[date | None, date | None]:
    done = [s for s in stages if s.is_done]
    if not done:
        return None, None
    starts = [start for s in done if (start := _stage_start(s))]
    ends = [end for s in done if (end := _stage_end(s))]
    return (
        min(starts) if starts else None,
        max(ends) if ends else None,
    )


def _apply_actual_dates(target: Task | ProjectComponent, start: date | None, end: date | None) -> None:
    target.start_date = start
    target.end_date = end
    if start and end:
        target.duration_days = (end - start).days + 1
    else:
        target.duration_days = None


def recompute_component_indicative_dates(db: Session, component: ProjectComponent) -> None:
    stages = (
        db.query(ComponentSubStage)
        .filter(ComponentSubStage.component_id == component.id)
        .all()
    )
    ind_start, ind_end = indicative_dates_from_stages(stages)
    component.indicative_start = ind_start
    component.indicative_end = ind_end


def recompute_component_actual_dates(db: Session, component: ProjectComponent) -> None:
    stages = (
        db.query(ComponentSubStage)
        .filter(ComponentSubStage.component_id == component.id)
        .all()
    )
    start, end = actual_dates_from_completed_stages(stages)
    _apply_actual_dates(component, start, end)


def recompute_indicative_dates(db: Session, task: Task) -> None:
    if task.component_id and task.component:
        recompute_component_indicative_dates(db, task.component)
        return
    stages = db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).all()
    ind_start, ind_end = indicative_dates_from_stages(stages)
    task.indicative_start = ind_start
    task.indicative_end = ind_end


def recompute_actual_dates(db: Session, task: Task) -> None:
    if task.component_id and task.component:
        recompute_component_actual_dates(db, task.component)
        return
    stages = db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).all()
    start, end = actual_dates_from_completed_stages(stages)
    _apply_actual_dates(task, start, end)

"""Delete a sub-stage and clean up related dependency references."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import ComponentSubStage, Dependency, Task, TaskSubStage
from app.services.component_merge import effective_sub_stages
from app.services.stage_internal_links import (
    effective_internal_stage_links,
    set_internal_stage_links,
    strip_links_for_stage,
)


def _stage_rows(db: Session, task: Task) -> list[ComponentSubStage | TaskSubStage]:
    if task.component_id and task.component:
        return list(task.component.sub_stages or [])
    return db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).all()


def delete_sub_stage(db: Session, task: Task, stage_id: int) -> None:
    stages = effective_sub_stages(task)
    if not any(s.id == stage_id for s in stages):
        raise HTTPException(404, "Sub-stage not found")

    stage_rows = _stage_rows(db, task)
    links = strip_links_for_stage(effective_internal_stage_links(task, stage_rows), stage_id)

    deps = (
        db.query(Dependency)
        .filter(
            Dependency.project_id == task.project_id,
            or_(
                Dependency.predecessor_stage_id == stage_id,
                Dependency.successor_stage_id == stage_id,
            ),
        )
        .all()
    )
    for dep in deps:
        db.delete(dep)

    if task.component_id and task.component:
        stage = (
            db.query(ComponentSubStage)
            .filter(
                ComponentSubStage.id == stage_id,
                ComponentSubStage.component_id == task.component_id,
            )
            .first()
        )
        if not stage:
            raise HTTPException(404, "Sub-stage not found")
        db.delete(stage)
    else:
        stage = (
            db.query(TaskSubStage)
            .filter(TaskSubStage.id == stage_id, TaskSubStage.task_id == task.id)
            .first()
        )
        if not stage:
            raise HTTPException(404, "Sub-stage not found")
        db.delete(stage)

    db.flush()
    remaining = _stage_rows(db, task)
    set_internal_stage_links(task, links, remaining)

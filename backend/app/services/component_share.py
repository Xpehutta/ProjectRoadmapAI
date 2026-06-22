"""Create shared components and link task usages (витрины)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ComponentSubStage, ProjectComponent, Task, TaskSubStage
from app.services.component_merge import SHARED_TASK_FIELDS, bump_linked_task_versions
from app.services.stage_indicative import (
    recompute_actual_dates,
    recompute_component_indicative_dates,
    recompute_indicative_dates,
)


def _remap_stage_links(links: list | None, id_map: dict[int, int]) -> list | None:
    if not links:
        return None
    remapped: list[dict] = []
    for link in links:
        if not isinstance(link, dict):
            continue
        first = link.get("first_stage_id")
        second = link.get("second_stage_id")
        if first is None or second is None:
            continue
        remapped.append(
            {
                "first_stage_id": id_map.get(int(first), int(first)),
                "second_stage_id": id_map.get(int(second), int(second)),
                "relation": link.get("relation", "after"),
            }
        )
    return remapped or None


def copy_task_stages_to_component(db: Session, task: Task, component: ProjectComponent) -> dict[int, int]:
    """Copy task sub-stages to component; return old task stage id → new component stage id."""
    id_map: dict[int, int] = {}
    stages = sorted(task.sub_stages or [], key=lambda s: s.sort_order)
    for stage in stages:
        pred_ids = [
            id_map[int(pid)]
            for pid in (stage.predecessor_stage_ids or [])
            if int(pid) in id_map
        ]
        created = ComponentSubStage(
            component_id=component.id,
            name=stage.name,
            sort_order=stage.sort_order,
            is_done=stage.is_done,
            due_date=stage.due_date,
            start_date=stage.start_date,
            end_date=stage.end_date,
            note=stage.note,
            is_indicative=stage.is_indicative,
            predecessor_stage_ids=pred_ids or None,
        )
        db.add(created)
        db.flush()
        id_map[stage.id] = created.id

    if task.internal_stage_links and not component.internal_stage_links:
        component.internal_stage_links = _remap_stage_links(task.internal_stage_links, id_map)

    recompute_component_indicative_dates(db, component)
    return id_map


def clear_task_stages(db: Session, task: Task) -> None:
    db.query(TaskSubStage).filter(TaskSubStage.task_id == task.id).delete()
    task.internal_stage_links = None


def _apply_shared_fields_to_component(task: Task, component: ProjectComponent) -> None:
    for field in SHARED_TASK_FIELDS:
        setattr(component, field, getattr(task, field))


def link_task_to_component(db: Session, task: Task, component: ProjectComponent) -> None:
    if task.project_id != component.project_id:
        raise ValueError("Component belongs to another project")
    if task.component_id == component.id:
        return

    component_stages = list(component.sub_stages or [])
    task_stages = list(task.sub_stages or [])

    if not component_stages and task_stages:
        copy_task_stages_to_component(db, task, component)
        clear_task_stages(db, task)
        _apply_shared_fields_to_component(task, component)
    elif component_stages and task_stages:
        clear_task_stages(db, task)

    task.component_id = component.id
    task.data_source = component.data_source
    bump_linked_task_versions(task)
    recompute_indicative_dates(db, task)
    recompute_actual_dates(db, task)


def promote_task_to_component(db: Session, task: Task, *, data_source: str | None = None) -> ProjectComponent:
    if task.component_id:
        raise ValueError("Task is already linked to a shared component")

    ds = (data_source or task.data_source or "").strip()
    if not ds:
        raise ValueError("data_source is required")

    existing = (
        db.query(ProjectComponent)
        .filter(
            ProjectComponent.project_id == task.project_id,
            ProjectComponent.data_source == ds,
        )
        .first()
    )
    if existing:
        link_task_to_component(db, task, existing)
        db.commit()
        db.refresh(existing)
        return existing

    component = ProjectComponent(
        project_id=task.project_id,
        name=ds,
        data_source=ds,
    )
    _apply_shared_fields_to_component(task, component)
    db.add(component)
    db.flush()

    if task.sub_stages:
        copy_task_stages_to_component(db, task, component)
        clear_task_stages(db, task)

    task.component_id = component.id
    task.data_source = ds
    bump_linked_task_versions(task)
    db.commit()
    db.refresh(component)
    return component

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ComponentSubStage, Task, TaskSubStage
from app.schemas import (
    StageInternalLinksUpdate,
    SubStageCreate,
    SubStageOut,
    SubStageUpdate,
    TaskOut,
)
from app.services.completion import complete_all_sub_stages, recompute_completion
from app.services.component_merge import bump_linked_task_versions, component_stage_to_out, effective_sub_stages
from app.services.stage_internal_links import (
    effective_internal_stage_links,
    replace_successor_after_links,
    set_internal_stage_links,
)
from app.services.sub_stage_delete import delete_sub_stage as remove_sub_stage
from app.services.sub_stage_deps import validate_predecessor_stage_ids
from app.services.stage_audit import log_stage_date_changes
from app.services.stage_indicative import recompute_actual_dates, recompute_indicative_dates
from app.services.tasks import load_task, task_to_out

router = APIRouter(prefix="/tasks/{task_id}/sub-stages", tags=["sub-stages"])


def _sync_stage_due_date(updates: dict) -> None:
    if updates.get("end_date") is not None and updates.get("due_date") is None:
        updates["due_date"] = updates["end_date"]


def _apply_predecessor_validation(
    updates: dict,
    stage_id: int | None,
    stages: list,
) -> None:
    if "predecessor_stage_ids" in updates:
        updates["predecessor_stage_ids"] = validate_predecessor_stage_ids(
            stage_id, updates.get("predecessor_stage_ids"), stages
        )


def _stage_rows(db: Session, task: Task) -> list[ComponentSubStage | TaskSubStage]:
    if task.component_id and task.component:
        return list(task.component.sub_stages or [])
    return (
        db.query(TaskSubStage)
        .filter(TaskSubStage.task_id == task.id)
        .order_by(TaskSubStage.sort_order)
        .all()
    )


def _sync_links_for_predecessor_patch(
    db: Session,
    task: Task,
    stage_id: int,
    predecessor_stage_ids: list[int],
) -> None:
    stages = _stage_rows(db, task)
    existing = effective_internal_stage_links(task, stages)
    links = replace_successor_after_links(existing, stage_id, predecessor_stage_ids)
    set_internal_stage_links(task, links, stages)


@router.get("", response_model=list[SubStageOut])
def list_sub_stages(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return effective_sub_stages(task)


@router.put("/internal-links", response_model=TaskOut)
def update_internal_stage_links(
    task_id: int,
    payload: StageInternalLinksUpdate,
    db: Session = Depends(get_db),
):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    stages = _stage_rows(db, task)
    links = [link.model_dump() for link in payload.links]
    set_internal_stage_links(task, links, stages)
    bump_linked_task_versions(task)
    db.commit()
    db.refresh(task)
    return task_to_out(task)


@router.post("", response_model=SubStageOut, status_code=201)
def create_sub_stage(task_id: int, payload: SubStageCreate, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    data = payload.model_dump()
    _sync_stage_due_date(data)
    pred_ids = data.pop("predecessor_stage_ids", None)
    if task.component_id and task.component:
        existing = task.component.sub_stages or []
        if data.get("sort_order", 0) == 0 and existing:
            data["sort_order"] = max(s.sort_order for s in existing) + 1
        stage = ComponentSubStage(component_id=task.component_id, **data)
        db.add(stage)
        db.flush()
        if pred_ids:
            _sync_links_for_predecessor_patch(db, task, stage.id, pred_ids)
        recompute_completion(db, task)
        recompute_indicative_dates(db, task)
        recompute_actual_dates(db, task)
        bump_linked_task_versions(task)
        db.commit()
        db.refresh(stage)
        return component_stage_to_out(stage)
    existing = (
        db.query(TaskSubStage)
        .filter(TaskSubStage.task_id == task_id)
        .order_by(TaskSubStage.sort_order)
        .all()
    )
    if data.get("sort_order", 0) == 0 and existing:
        data["sort_order"] = max(s.sort_order for s in existing) + 1
    stage = TaskSubStage(task_id=task_id, **data)
    db.add(stage)
    db.flush()
    if pred_ids:
        _sync_links_for_predecessor_patch(db, task, stage.id, pred_ids)
    recompute_completion(db, task)
    recompute_indicative_dates(db, task)
    recompute_actual_dates(db, task)
    bump_linked_task_versions(task)
    db.commit()
    db.refresh(stage)
    return stage


@router.patch("/{stage_id}", response_model=SubStageOut)
def update_sub_stage(
    task_id: int, stage_id: int, payload: SubStageUpdate, db: Session = Depends(get_db)
):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.component_id:
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
        updates = payload.model_dump(exclude_unset=True)
        _sync_stage_due_date(updates)
        pred_patch = updates.pop("predecessor_stage_ids", None)
        if pred_patch is not None:
            pred_patch = validate_predecessor_stage_ids(stage_id, pred_patch, task.component.sub_stages or [])
        log_stage_date_changes(db, task, stage, updates)
        for k, v in updates.items():
            setattr(stage, k, v)
        if pred_patch is not None:
            _sync_links_for_predecessor_patch(db, task, stage_id, pred_patch)
        recompute_completion(db, task)
        recompute_indicative_dates(db, task)
        recompute_actual_dates(db, task)
        bump_linked_task_versions(task)
        db.commit()
        db.refresh(stage)
        return component_stage_to_out(stage)
    stage = (
        db.query(TaskSubStage)
        .filter(TaskSubStage.id == stage_id, TaskSubStage.task_id == task_id)
        .first()
    )
    if not stage:
        raise HTTPException(404, "Sub-stage not found")
    updates = payload.model_dump(exclude_unset=True)
    _sync_stage_due_date(updates)
    all_stages = (
        db.query(TaskSubStage)
        .filter(TaskSubStage.task_id == task_id)
        .order_by(TaskSubStage.sort_order)
        .all()
    )
    pred_patch = updates.pop("predecessor_stage_ids", None)
    if pred_patch is not None:
        pred_patch = validate_predecessor_stage_ids(stage_id, pred_patch, all_stages)
    log_stage_date_changes(db, task, stage, updates)
    for k, v in updates.items():
        setattr(stage, k, v)
    if pred_patch is not None:
        _sync_links_for_predecessor_patch(db, task, stage_id, pred_patch)
    recompute_completion(db, task)
    recompute_indicative_dates(db, task)
    recompute_actual_dates(db, task)
    bump_linked_task_versions(task)
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204)
def delete_sub_stage(task_id: int, stage_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    remove_sub_stage(db, task, stage_id)
    recompute_completion(db, task)
    recompute_indicative_dates(db, task)
    recompute_actual_dates(db, task)
    bump_linked_task_versions(task)
    db.commit()


@router.post("/complete-all", response_model=list[SubStageOut])
def complete_all(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    complete_all_sub_stages(db, task)
    recompute_indicative_dates(db, task)
    recompute_actual_dates(db, task)
    if not (task.component_id and task.component):
        bump_linked_task_versions(task)
    db.commit()
    return effective_sub_stages(task)

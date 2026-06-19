from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ComponentSubStage, Task, TaskSubStage
from app.schemas import SubStageCreate, SubStageOut, SubStageUpdate
from app.services.completion import complete_all_sub_stages, recompute_completion
from app.services.component_merge import bump_linked_task_versions, component_stage_to_out, effective_sub_stages
from app.services.sub_stage_delete import delete_sub_stage as remove_sub_stage
from app.services.sub_stage_deps import validate_predecessor_stage_ids
from app.services.stage_indicative import recompute_actual_dates, recompute_indicative_dates
from app.services.tasks import load_task

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


@router.get("", response_model=list[SubStageOut])
def list_sub_stages(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return effective_sub_stages(task)


@router.post("", response_model=SubStageOut, status_code=201)
def create_sub_stage(task_id: int, payload: SubStageCreate, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    data = payload.model_dump()
    _sync_stage_due_date(data)
    if task.component_id and task.component:
        existing = task.component.sub_stages or []
        if data.get("sort_order", 0) == 0 and existing:
            data["sort_order"] = max(s.sort_order for s in existing) + 1
        _apply_predecessor_validation(data, None, existing)
        stage = ComponentSubStage(component_id=task.component_id, **data)
        db.add(stage)
        db.flush()
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
    _apply_predecessor_validation(data, None, existing)
    stage = TaskSubStage(task_id=task_id, **data)
    db.add(stage)
    db.flush()
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
        _apply_predecessor_validation(updates, stage_id, task.component.sub_stages or [])
        for k, v in updates.items():
            setattr(stage, k, v)
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
    _apply_predecessor_validation(updates, stage_id, all_stages)
    for k, v in updates.items():
        setattr(stage, k, v)
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

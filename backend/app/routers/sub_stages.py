from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ComponentSubStage, Task, TaskSubStage
from app.schemas import SubStageCreate, SubStageOut, SubStageUpdate
from app.services.completion import complete_all_sub_stages, recompute_completion
from app.services.component_merge import component_stage_to_out, effective_sub_stages
from app.services.tasks import load_task

router = APIRouter(prefix="/tasks/{task_id}/sub-stages", tags=["sub-stages"])


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
    if task.component_id and task.component:
        existing = task.component.sub_stages or []
        if data.get("sort_order", 0) == 0 and existing:
            data["sort_order"] = max(s.sort_order for s in existing) + 1
        stage = ComponentSubStage(component_id=task.component_id, **data)
        db.add(stage)
        db.flush()
        recompute_completion(db, task)
        task.component.version += 1
        task.version += 1
        db.commit()
        db.refresh(stage)
        return component_stage_to_out(stage)
    if data.get("sort_order", 0) == 0:
        existing = (
            db.query(TaskSubStage)
            .filter(TaskSubStage.task_id == task_id)
            .order_by(TaskSubStage.sort_order)
            .all()
        )
        if existing:
            data["sort_order"] = max(s.sort_order for s in existing) + 1
    stage = TaskSubStage(task_id=task_id, **data)
    db.add(stage)
    db.flush()
    recompute_completion(db, task)
    task.version += 1
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
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(stage, k, v)
        recompute_completion(db, task)
        task.component.version += 1
        task.version += 1
        db.commit()
        db.refresh(stage)
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
    stage = (
        db.query(TaskSubStage)
        .filter(TaskSubStage.id == stage_id, TaskSubStage.task_id == task_id)
        .first()
    )
    if not stage:
        raise HTTPException(404, "Sub-stage not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(stage, k, v)
    recompute_completion(db, task)
    task.version += 1
    db.commit()
    db.refresh(stage)
    return stage


@router.post("/complete-all", response_model=list[SubStageOut])
def complete_all(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    complete_all_sub_stages(db, task)
    task.version += 1
    db.commit()
    return effective_sub_stages(task)

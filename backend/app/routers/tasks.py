from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dependency, Project, Task
from app.schemas import TaskCreate, TaskOut, TaskPatchResponse, TaskUpdate
from app.services.component_merge import split_task_changes
from app.services.scheduling import apply_field_changes, cascade_from_task, detect_cycle
from app.services.tasks import load_task, resolve_predecessor_refs, task_to_out

router = APIRouter(tags=["tasks"])


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    return [task_to_out(load_task(db, t.id) or t) for t in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: int, payload: TaskCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    data = payload.model_dump(exclude={"predecessor_refs"})
    task = Task(project_id=project_id, **data)
    if task.start_date and task.end_date and not task.duration_days:
        task.duration_days = (task.end_date - task.start_date).days + 1
    db.add(task)
    db.flush()
    if payload.predecessor_refs:
        try:
            preds = resolve_predecessor_refs(db, project_id, payload.predecessor_refs)
        except ValueError as e:
            raise HTTPException(400, str(e))
        for pred in preds:
            if detect_cycle(db, project_id, pred.id, task.id):
                raise HTTPException(400, "Dependency would create a cycle")
            db.add(
                Dependency(
                    project_id=project_id,
                    predecessor_id=pred.id,
                    successor_id=task.id,
                )
            )
    db.commit()
    return task_to_out(load_task(db, task.id))


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task_to_out(task)


@router.patch("/tasks/{task_id}", response_model=TaskPatchResponse)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.version != payload.version:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=409,
            content={
                "detail": {
                    "message": "Version conflict",
                    "current": task_to_out(task).model_dump(mode="json"),
                }
            },
        )

    changes = payload.model_dump(exclude_unset=True, exclude={"version", "predecessor_refs"})
    if "custom_fields" in changes and changes["custom_fields"] is not None:
        merged_custom = dict(task.custom_fields or {})
        merged_custom.update(changes["custom_fields"])
        changes["custom_fields"] = merged_custom
    date_fields = {"start_date", "end_date", "duration_days"}

    ref = task.component if task.component_id and task.component else task

    if "duration_days" in changes and changes["duration_days"] is not None:
        if ref.start_date:
            changes["end_date"] = ref.start_date + timedelta(days=changes["duration_days"] - 1)
        elif ref.end_date:
            changes["start_date"] = ref.end_date - timedelta(days=changes["duration_days"] - 1)

    if "start_date" in changes and "end_date" in changes and changes.get("start_date") and changes.get("end_date"):
        changes["duration_days"] = (changes["end_date"] - changes["start_date"]).days + 1
    elif "start_date" in changes and changes.get("start_date") and ref.end_date and "end_date" not in changes:
        changes["duration_days"] = (ref.end_date - changes["start_date"]).days + 1
    elif "end_date" in changes and changes.get("end_date") and ref.start_date and "start_date" not in changes:
        changes["duration_days"] = (changes["end_date"] - ref.start_date).days + 1

    component_changes, task_changes = split_task_changes(changes)
    if component_changes and task.component:
        apply_field_changes(db, task.component, component_changes, audit_task=task)
        task.component.version += 1
    if task_changes:
        apply_field_changes(db, task, task_changes)
    task.version += 1

    affected: list[Task] = []
    if date_fields & set(changes.keys()):
        cascade_target = task.component if task.component_id and task.component else task
        if cascade_target is task:
            affected = cascade_from_task(db, task)
            for t in affected:
                t.version += 1

    if payload.predecessor_refs is not None:
        db.query(Dependency).filter(Dependency.successor_id == task.id).delete()
        try:
            preds = resolve_predecessor_refs(db, task.project_id, payload.predecessor_refs)
        except ValueError as e:
            raise HTTPException(400, str(e))
        for pred in preds:
            if detect_cycle(db, task.project_id, pred.id, task.id):
                raise HTTPException(400, "Dependency would create a cycle")
            db.add(
                Dependency(
                    project_id=task.project_id,
                    predecessor_id=pred.id,
                    successor_id=task.id,
                )
            )

    db.commit()
    refreshed = load_task(db, task.id)
    affected_out = [task_to_out(load_task(db, t.id) or t) for t in affected]
    return TaskPatchResponse(task=task_to_out(refreshed), affected_tasks=affected_out)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()

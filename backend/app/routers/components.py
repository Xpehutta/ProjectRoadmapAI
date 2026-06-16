from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, ProjectComponent, Task
from app.schemas import ComponentCreate, ComponentOut, ComponentUpdate
from app.services.components import component_to_out, load_component
from app.services.component_merge import copy_component_stages_to_task, copy_component_to_task
from app.services.tasks import load_task, task_to_out

router = APIRouter(tags=["components"])


@router.get("/projects/{project_id}/components", response_model=list[ComponentOut])
def list_components(project_id: int, db: Session = Depends(get_db)):
    components = (
        db.query(ProjectComponent)
        .filter(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.name)
        .all()
    )
    return [component_to_out(load_component(db, c.id) or c) for c in components]


@router.post("/projects/{project_id}/components", response_model=ComponentOut, status_code=201)
def create_component(project_id: int, payload: ComponentCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    existing = (
        db.query(ProjectComponent)
        .filter(
            ProjectComponent.project_id == project_id,
            ProjectComponent.data_source == payload.data_source,
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "Component with this data source already exists")
    component = ProjectComponent(project_id=project_id, **payload.model_dump())
    if component.start_date and component.end_date and not component.duration_days:
        component.duration_days = (component.end_date - component.start_date).days + 1
    db.add(component)
    db.commit()
    return component_to_out(load_component(db, component.id))


@router.patch("/components/{component_id}", response_model=ComponentOut)
def update_component(component_id: int, payload: ComponentUpdate, db: Session = Depends(get_db)):
    component = load_component(db, component_id)
    if not component:
        raise HTTPException(404, "Component not found")
    if component.version != payload.version:
        raise HTTPException(409, "Version conflict")
    changes = payload.model_dump(exclude_unset=True, exclude={"version"})
    if "duration_days" in changes and changes["duration_days"] is not None and component.start_date:
        changes["end_date"] = component.start_date + timedelta(days=changes["duration_days"] - 1)
    for k, v in changes.items():
        setattr(component, k, v)
    component.version += 1
    db.commit()
    return component_to_out(load_component(db, component.id))


@router.post("/tasks/{task_id}/link-component/{component_id}", response_model=ComponentOut)
def link_task_to_component(task_id: int, component_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    component = load_component(db, component_id)
    if not task or not component:
        raise HTTPException(404, "Task or component not found")
    if task.project_id != component.project_id:
        raise HTTPException(400, "Component belongs to another project")
    task.component_id = component.id
    task.data_source = component.data_source
    task.version += 1
    db.commit()
    return component_to_out(component)


@router.post("/tasks/{task_id}/unlink-component")
def unlink_task_from_component(task_id: int, db: Session = Depends(get_db)):
    task = load_task(db, task_id)
    if not task or not task.component_id:
        raise HTTPException(404, "Task not found or not linked")
    component = load_component(db, task.component_id)
    if component:
        copy_component_to_task(task, component)
        copy_component_stages_to_task(db, task, component)
    task.component_id = None
    task.version += 1
    db.commit()
    return task_to_out(load_task(db, task.id))

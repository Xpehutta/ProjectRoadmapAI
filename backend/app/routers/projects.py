from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Dependency, Goal, Milestone, Project, ProjectComponent, Release, Task
from app.schemas import CategoryOut, DependencyOut, GoalOut, MilestoneOut, ProjectCreate, ProjectDetail, ProjectOut, ReleaseOut
from app.services.components import component_to_out, load_component
from app.services.tasks import load_task, task_to_out
from sqlalchemy.orm import joinedload
from app.models import Dependency as DepModel

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.id).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    categories = db.query(Category).filter(Category.project_id == project_id).order_by(Category.sort_order).all()
    components = (
        db.query(ProjectComponent)
        .filter(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.name)
        .all()
    )
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.tasks),
            joinedload(Task.predecessors).joinedload(DepModel.predecessor),
        )
        .filter(Task.project_id == project_id)
        .all()
    )
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.date).all()
    releases = db.query(Release).filter(Release.project_id == project_id).order_by(Release.sort_order).all()
    goals = db.query(Goal).filter(Goal.project_id == project_id).order_by(Goal.sort_order).all()
    dependencies = db.query(Dependency).filter(Dependency.project_id == project_id).all()
    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        categories=[CategoryOut.model_validate(c) for c in categories],
        components=[component_to_out(load_component(db, c.id) or c) for c in components],
        releases=[ReleaseOut.model_validate(r) for r in releases],
        goals=[GoalOut.model_validate(g) for g in goals],
        tasks=[task_to_out(t) for t in tasks],
        milestones=[MilestoneOut.model_validate(m) for m in milestones],
        dependencies=[DependencyOut.model_validate(d) for d in dependencies],
    )

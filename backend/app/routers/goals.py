from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Goal, Project
from app.schemas import GoalCreate, GoalOut, GoalUpdate

router = APIRouter(prefix="/projects/{project_id}/goals", tags=["goals"])


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("", response_model=list[GoalOut])
def list_goals(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return (
        db.query(Goal)
        .filter(Goal.project_id == project_id)
        .order_by(Goal.sort_order, Goal.id)
        .all()
    )


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(project_id: int, payload: GoalCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    goal = Goal(project_id=project_id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    project_id: int, goal_id: int, payload: GoalUpdate, db: Session = Depends(get_db)
):
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.project_id == project_id)
        .first()
    )
    if not goal:
        raise HTTPException(404, "Goal not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(project_id: int, goal_id: int, db: Session = Depends(get_db)):
    goal = (
        db.query(Goal)
        .filter(Goal.id == goal_id, Goal.project_id == project_id)
        .first()
    )
    if not goal:
        raise HTTPException(404, "Goal not found")
    db.delete(goal)
    db.commit()

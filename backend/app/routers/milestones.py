from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Milestone, Project
from app.schemas import MilestoneCreate, MilestoneOut, MilestoneUpdate

router = APIRouter(prefix="/projects/{project_id}/milestones", tags=["milestones"])


@router.get("", response_model=list[MilestoneOut])
def list_milestones(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.date)
        .all()
    )


@router.post("", response_model=MilestoneOut, status_code=201)
def create_milestone(project_id: int, payload: MilestoneCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    ms = Milestone(project_id=project_id, **payload.model_dump())
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return ms


@router.patch("/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    project_id: int, milestone_id: int, payload: MilestoneUpdate, db: Session = Depends(get_db)
):
    ms = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.project_id == project_id)
        .first()
    )
    if not ms:
        raise HTTPException(404, "Milestone not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(ms, k, v)
    db.commit()
    db.refresh(ms)
    return ms


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(project_id: int, milestone_id: int, db: Session = Depends(get_db)):
    ms = (
        db.query(Milestone)
        .filter(Milestone.id == milestone_id, Milestone.project_id == project_id)
        .first()
    )
    if not ms:
        raise HTTPException(404, "Milestone not found")
    db.delete(ms)
    db.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Release
from app.schemas import ReleaseCreate, ReleaseOut, ReleaseUpdate

router = APIRouter(prefix="/projects/{project_id}/releases", tags=["releases"])


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("", response_model=list[ReleaseOut])
def list_releases(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return (
        db.query(Release)
        .filter(Release.project_id == project_id)
        .order_by(Release.sort_order, Release.id)
        .all()
    )


@router.post("", response_model=ReleaseOut, status_code=201)
def create_release(project_id: int, payload: ReleaseCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    release = Release(project_id=project_id, **payload.model_dump())
    db.add(release)
    db.commit()
    db.refresh(release)
    return release


@router.patch("/{release_id}", response_model=ReleaseOut)
def update_release(
    project_id: int, release_id: int, payload: ReleaseUpdate, db: Session = Depends(get_db)
):
    release = (
        db.query(Release)
        .filter(Release.id == release_id, Release.project_id == project_id)
        .first()
    )
    if not release:
        raise HTTPException(404, "Release not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(release, k, v)
    db.commit()
    db.refresh(release)
    return release


@router.delete("/{release_id}", status_code=204)
def delete_release(project_id: int, release_id: int, db: Session = Depends(get_db)):
    release = (
        db.query(Release)
        .filter(Release.id == release_id, Release.project_id == project_id)
        .first()
    )
    if not release:
        raise HTTPException(404, "Release not found")
    db.delete(release)
    db.commit()

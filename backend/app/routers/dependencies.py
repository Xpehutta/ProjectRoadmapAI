from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dependency, Project
from app.schemas import DependencyCreate, DependencyOut
from app.services.scheduling import detect_cycle

router = APIRouter(prefix="/projects/{project_id}/dependencies", tags=["dependencies"])


@router.get("", response_model=list[DependencyOut])
def list_dependencies(project_id: int, db: Session = Depends(get_db)):
    return db.query(Dependency).filter(Dependency.project_id == project_id).all()


@router.post("", response_model=DependencyOut, status_code=201)
def create_dependency(project_id: int, payload: DependencyCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if detect_cycle(db, project_id, payload.predecessor_id, payload.successor_id):
        raise HTTPException(400, "Dependency would create a cycle")
    dep = Dependency(project_id=project_id, **payload.model_dump())
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.delete("/{dependency_id}", status_code=204)
def delete_dependency(project_id: int, dependency_id: int, db: Session = Depends(get_db)):
    dep = (
        db.query(Dependency)
        .filter(Dependency.id == dependency_id, Dependency.project_id == project_id)
        .first()
    )
    if not dep:
        raise HTTPException(404, "Dependency not found")
    db.delete(dep)
    db.commit()

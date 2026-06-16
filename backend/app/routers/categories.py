from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Project
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/projects/{project_id}/categories", tags=["categories"])


def _get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("", response_model=list[CategoryOut])
def list_categories(project_id: int, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    return (
        db.query(Category)
        .filter(Category.project_id == project_id)
        .order_by(Category.sort_order)
        .all()
    )


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(project_id: int, payload: CategoryCreate, db: Session = Depends(get_db)):
    _get_project(db, project_id)
    cat = Category(project_id=project_id, **payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    project_id: int, category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db)
):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.project_id == project_id)
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(project_id: int, category_id: int, db: Session = Depends(get_db)):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.project_id == project_id)
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()

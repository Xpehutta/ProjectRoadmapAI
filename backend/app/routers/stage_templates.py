from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project
from app.services.stage_templates import add_project_stage_template, list_project_stage_templates, load_predefined_templates

router = APIRouter(tags=["stage-templates"])


class StageTemplateCreate(BaseModel):
    name: str
    group: str | None = None
    full_label: str | None = None


@router.get("/stage-templates/predefined")
def get_predefined_templates():
    return load_predefined_templates()


@router.get("/projects/{project_id}/stage-templates")
def get_project_stage_templates(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return list_project_stage_templates(db, project)


@router.post("/projects/{project_id}/stage-templates", status_code=201)
def create_project_stage_template(
    project_id: int,
    payload: StageTemplateCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        return add_project_stage_template(db, project, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

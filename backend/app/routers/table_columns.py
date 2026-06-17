from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Dependency as DepModel
from app.models import Project, Task
from app.services.table_schema import (
    add_builtin_column,
    add_custom_column,
    get_effective_schema,
    list_hidden_builtin_columns,
    remove_column,
)

router = APIRouter(tags=["table-columns"])


class TableColumnCreate(BaseModel):
    label: str | None = None
    builtin_key: str | None = None


class TableColumnSchemaOut(BaseModel):
    key: str
    label: str
    type: str
    source: str


class TableColumnLibrary(BaseModel):
    columns: list[TableColumnSchemaOut]
    hidden_builtin: list[TableColumnSchemaOut]


def _load_project_tasks(db: Session, project_id: int) -> tuple[Project, list[Task]]:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    tasks = (
        db.query(Task)
        .options(
            joinedload(Task.predecessors).joinedload(DepModel.predecessor),
        )
        .filter(Task.project_id == project_id)
        .all()
    )
    return project, tasks


@router.get("/projects/{project_id}/table-columns", response_model=TableColumnLibrary)
def get_table_columns(project_id: int, db: Session = Depends(get_db)):
    project, tasks = _load_project_tasks(db, project_id)
    columns = get_effective_schema(project, tasks)
    hidden = list_hidden_builtin_columns(project, tasks)
    return TableColumnLibrary(
        columns=[TableColumnSchemaOut.model_validate(c) for c in columns],
        hidden_builtin=[TableColumnSchemaOut.model_validate(c) for c in hidden],
    )


@router.post("/projects/{project_id}/table-columns", response_model=TableColumnSchemaOut, status_code=201)
def create_table_column(
    project_id: int,
    payload: TableColumnCreate,
    db: Session = Depends(get_db),
):
    project, tasks = _load_project_tasks(db, project_id)
    try:
        if payload.builtin_key:
            column = add_builtin_column(db, project, tasks, payload.builtin_key)
        elif payload.label:
            column = add_custom_column(db, project, tasks, payload.label)
        else:
            raise ValueError("Provide label or builtin_key")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return TableColumnSchemaOut.model_validate(column)


@router.delete("/projects/{project_id}/table-columns/{column_key}", status_code=204)
def delete_table_column(project_id: int, column_key: str, db: Session = Depends(get_db)):
    project, tasks = _load_project_tasks(db, project_id)
    try:
        remove_column(db, project, tasks, column_key)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

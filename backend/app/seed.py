"""Seed project from DataMarts.xlsx."""

import os

from app.database import SessionLocal
from app.datamarts_import import PROJECT_NAME, import_datamarts, resolve_xlsx_path


def seed() -> None:
    db = SessionLocal()
    try:
        replace = os.getenv("SEED_REPLACE", "").lower() in ("1", "true", "yes")
        from app.models import Project

        existing = db.query(Project).filter(Project.name == PROJECT_NAME).first()
        legacy = db.query(Project).filter(Project.name == "Data Marts Roadmap").first()

        if existing and not replace:
            print(f"Project '{PROJECT_NAME}' already exists, skipping import.")
            return

        if legacy and not existing:
            print("Removing legacy demo project…")
            db.delete(legacy)
            db.commit()

        path = resolve_xlsx_path()
        print(f"Importing Data Marts from {path}…")
        project = import_datamarts(db, path)
        from app.models import Task

        task_count = db.query(Task).filter(Task.project_id == project.id).count()
        print(f"Imported '{project.name}' with {task_count} tasks.")
    except FileNotFoundError as exc:
        print(f"Seed skipped: {exc}")
    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

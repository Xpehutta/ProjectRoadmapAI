"""Predefined and project-specific reusable sub-stage templates."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Project, Task

StageTemplateDict = dict[str, str | None]


def _template_paths() -> list[Path]:
    here = Path(__file__).resolve()
    root = here.parents[3]
    return [
        Path("/app/import-data/stage_templates.json"),
        root / "data" / "stage_templates.json",
    ]


def load_predefined_templates() -> list[StageTemplateDict]:
    for path in _template_paths():
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return [t for t in data if isinstance(t, dict) and t.get("full_label")]
    return []


def _normalize_template(raw: dict, *, source: str) -> StageTemplateDict | None:
    name = str(raw.get("name") or raw.get("full_label") or "").strip()
    if not name:
        return None
    group = raw.get("group")
    full_label = str(raw.get("full_label") or name).strip()
    return {
        "name": name,
        "group": str(group).strip() if group else None,
        "full_label": full_label,
        "source": source,
    }


def _dedupe_templates(items: list[StageTemplateDict]) -> list[StageTemplateDict]:
    seen: set[str] = set()
    result: list[StageTemplateDict] = []
    for item in items:
        key = str(item.get("full_label") or item.get("name") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def collect_used_templates(db: Session, project: Project) -> list[StageTemplateDict]:
    names: set[str] = set()
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    for task in tasks:
        for stage in task.sub_stages or []:
            if stage.name:
                names.add(stage.name.strip())
        if task.component and task.component.sub_stages:
            for stage in task.component.sub_stages:
                if stage.name:
                    names.add(stage.name.strip())

    predefined_keys = {
        str(t.get("full_label", "")).strip().lower() for t in load_predefined_templates()
    }
    custom_keys = {
        str(t.get("full_label", "")).strip().lower()
        for t in (project.stage_templates or [])
        if isinstance(t, dict)
    }

    used: list[StageTemplateDict] = []
    for name in sorted(names):
        key = name.lower()
        if key in predefined_keys or key in custom_keys:
            continue
        used.append(
            {
                "name": name,
                "group": None,
                "full_label": name,
                "source": "used",
            }
        )
    return used


def list_project_stage_templates(db: Session, project: Project) -> dict[str, list[StageTemplateDict]]:
    predefined = [
        {**t, "source": "predefined"} for t in load_predefined_templates()
    ]
    custom_raw = project.stage_templates or []
    custom = [
        tpl
        for item in custom_raw
        if isinstance(item, dict)
        for tpl in [_normalize_template(item, source="custom")]
        if tpl
    ]
    used = collect_used_templates(db, project)
    return {
        "predefined": predefined,
        "custom": _dedupe_templates(custom),
        "used": used,
        "all": _dedupe_templates([*predefined, *custom, *used]),
    }


def add_project_stage_template(db: Session, project: Project, payload: dict) -> StageTemplateDict:
    template = _normalize_template(payload, source="custom")
    if not template:
        raise ValueError("Template name is required")

    key = template["full_label"].lower()
    for item in project.stage_templates or []:
        if not isinstance(item, dict):
            continue
        existing_key = str(item.get("full_label") or item.get("name") or "").strip().lower()
        if existing_key == key:
            return template

    existing = list(project.stage_templates or [])
    existing.append(
        {
            "name": template["name"],
            "group": template.get("group"),
            "full_label": template["full_label"],
        }
    )
    project.stage_templates = existing
    db.commit()
    db.refresh(project)
    return template

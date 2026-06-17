"""Import projects from uploaded files (xlsx, xls, json)."""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.datamarts_import import (
    CATEGORY_COLORS,
    ParsedPhase,
    ParsedRow,
    import_parsed_rows,
    map_status,
    parse_spreadsheet,
)
from app.services.flexible_import import (
    import_flexible_json,
    import_flexible_spreadsheet,
    is_datamarts_headers,
    normalize_header_key,
    peek_spreadsheet_headers,
)
from app.models import Category, Milestone, Project, Task, TaskStatus

SUPPORTED_EXTENSIONS = {".xlsx", ".xls", ".json"}


def name_from_filename(filename: str) -> str:
    stem = Path(filename).stem.strip()
    return stem or "Новый проект"


def _parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    return date.fromisoformat(text[:10])


def _parse_status(value) -> TaskStatus:
    if isinstance(value, TaskStatus):
        return value
    if not value:
        return TaskStatus.todo
    text = str(value).strip().lower()
    if text in TaskStatus.__members__:
        return TaskStatus(text)
    return map_status(str(value))


def parsed_row_from_dict(data: dict, row_idx: int) -> ParsedRow:
    phases: list[ParsedPhase] = []
    for phase in data.get("phases") or []:
        if not isinstance(phase, dict):
            continue
        phases.append(
            ParsedPhase(
                name=str(phase.get("name") or ""),
                due_date=_parse_date(phase.get("due_date")),
                is_done=bool(phase.get("is_done")),
                is_indicative=bool(phase.get("is_indicative")),
                note=str(phase.get("note") or ""),
            )
        )

    start = _parse_date(data.get("start_date"))
    end = _parse_date(data.get("end_date"))
    ind_start = _parse_date(data.get("indicative_start"))
    ind_end = _parse_date(data.get("indicative_end"))
    pct = data.get("completion_pct")
    completion_pct = int(pct) if pct is not None else 0
    status = _parse_status(data.get("status"))
    if completion_pct >= 100 and status != TaskStatus.blocked:
        status = TaskStatus.done

    category = str(data.get("category") or data.get("БВ") or "Без категории")
    data_source = data.get("data_source") or data.get("Источник")
    subproduct = data.get("subproduct") or data.get("Субпродукт")

    return ParsedRow(
        priority=int(data["priority"]) if data.get("priority") not in (None, "") else None,
        status=status,
        category=category,
        subproduct=str(subproduct) if subproduct else None,
        forms=str(data["forms"]) if data.get("forms") else None,
        customer=str(data["customer"]) if data.get("customer") else None,
        data_source=str(data_source) if data_source else None,
        platform=str(data["platform"]) if data.get("platform") else None,
        area=str(data["area"]) if data.get("area") else None,
        contractor=str(data["contractor"]) if data.get("contractor") else None,
        desired_quarter=str(data["desired_quarter"]) if data.get("desired_quarter") else None,
        attribute_count=str(data["attribute_count"]) if data.get("attribute_count") else None,
        assignee=str(data["assignee"]) if data.get("assignee") else None,
        risks=str(data["risks"]) if data.get("risks") else None,
        notes=str(data["notes"]) if data.get("notes") else None,
        extra_info=str(data["extra_info"]) if data.get("extra_info") else None,
        phases=phases,
        start_date=start,
        end_date=end,
        indicative_start=ind_start,
        indicative_end=ind_end,
        completion_pct=completion_pct,
        name=str(data.get("name") or data.get("usage") or f"Строка {row_idx}"),
    )


def parse_json_rows(payload) -> tuple[str | None, str | None, list[ParsedRow]]:
    if isinstance(payload, list):
        rows = [parsed_row_from_dict(item, idx) for idx, item in enumerate(payload, start=1) if isinstance(item, dict)]
        return None, None, rows

    if not isinstance(payload, dict):
        raise ValueError("JSON must be an object or an array of row objects")

    name = payload.get("name")
    description = payload.get("description")
    raw_rows = payload.get("rows") or payload.get("tasks")
    if raw_rows is None:
        raise ValueError("JSON object must contain a 'rows' or 'tasks' array")

    rows = [parsed_row_from_dict(item, idx) for idx, item in enumerate(raw_rows, start=1) if isinstance(item, dict)]
    return (
        str(name) if name else None,
        str(description) if description else None,
        rows,
    )


def import_roadmap_json(
    db: Session,
    payload: dict,
    project_name: str,
    project_description: str | None = None,
) -> Project:
    tasks_data = payload.get("tasks") or []
    if not tasks_data:
        raise ValueError("JSON roadmap must contain at least one task")

    project = Project(
        name=project_name,
        description=project_description,
        created_at=datetime.utcnow(),
    )
    db.add(project)
    db.flush()

    categories_by_name: dict[str, Category] = {}
    category_colors = {
        str(item.get("name")): str(item.get("color"))
        for item in (payload.get("categories") or [])
        if isinstance(item, dict) and item.get("name")
    }

    def ensure_category(cat_name: str) -> Category:
        if cat_name in categories_by_name:
            return categories_by_name[cat_name]
        idx = len(categories_by_name)
        cat = Category(
            project_id=project.id,
            name=cat_name,
            color=category_colors.get(cat_name) or CATEGORY_COLORS[idx % len(CATEGORY_COLORS)],
            sort_order=idx,
        )
        db.add(cat)
        db.flush()
        categories_by_name[cat_name] = cat
        return cat

    for item in payload.get("categories") or []:
        if isinstance(item, dict) and item.get("name"):
            ensure_category(str(item["name"]))

    for idx, item in enumerate(tasks_data):
        if not isinstance(item, dict):
            continue
        cat_name = str(item.get("category") or "Без категории")
        category = ensure_category(cat_name)
        start = _parse_date(item.get("start_date"))
        end = _parse_date(item.get("end_date"))
        duration = None
        if start and end:
            duration = (end - start).days + 1
        elif item.get("duration_days") is not None:
            duration = int(item["duration_days"])

        task = Task(
            project_id=project.id,
            category_id=category.id,
            name=str(item.get("name") or f"Задача {idx + 1}"),
            assignee=str(item["assignee"]) if item.get("assignee") else None,
            status=_parse_status(item.get("status")),
            completion_pct=int(item.get("completion_pct") or 0),
            start_date=start,
            end_date=end,
            duration_days=duration,
            indicative_start=_parse_date(item.get("indicative_start")),
            indicative_end=_parse_date(item.get("indicative_end")),
            priority=int(item["priority"]) if item.get("priority") not in (None, "") else None,
            data_source=str(item["data_source"]) if item.get("data_source") else None,
            subproduct=str(item["subproduct"]) if item.get("subproduct") else None,
            notes=str(item["notes"]) if item.get("notes") else None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(task)

    for item in payload.get("milestones") or []:
        if not isinstance(item, dict):
            continue
        milestone_date = _parse_date(item.get("date"))
        if not milestone_date:
            continue
        db.add(
            Milestone(
                project_id=project.id,
                name=str(item.get("name") or "Веха"),
                date=milestone_date,
                description=str(item["description"]) if item.get("description") else None,
            )
        )

    db.commit()
    db.refresh(project)
    return project


def _row_looks_like_datamarts(row: dict) -> bool:
    keys = {normalize_header_key(k) for k in row}
    return "бв" in keys or ("источник" in keys and "субпродукт" in keys)


def import_project_from_upload(
    db: Session,
    *,
    content: bytes,
    filename: str,
    project_name: str | None = None,
    project_description: str | None = None,
) -> Project:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext or '(no extension)'}")

    default_name = project_name or name_from_filename(filename)
    default_description = project_description or f"Импорт из {Path(filename).name}"

    if ext in (".xlsx", ".xls"):
        headers = peek_spreadsheet_headers(content, filename)
        if is_datamarts_headers(headers):
            parsed_rows = parse_spreadsheet(content, filename)
            return import_parsed_rows(db, parsed_rows, default_name, default_description)
        return import_flexible_spreadsheet(
            db, content, filename, default_name, default_description
        )

    payload = json.loads(content.decode("utf-8"))
    if isinstance(payload, dict) and payload.get("format") == "roadmap" and not payload.get("columns"):
        name = project_name or payload.get("name") or default_name
        description = project_description or payload.get("description") or default_description
        return import_roadmap_json(db, payload, str(name), str(description) if description else None)

    if isinstance(payload, dict) and payload.get("format") == "flexible":
        name = project_name or payload.get("name") or default_name
        description = project_description or payload.get("description") or default_description
        return import_flexible_json(db, payload, str(name), str(description) if description else None)

    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict) and _row_looks_like_datamarts(payload[0]):
            rows = [parsed_row_from_dict(item, idx) for idx, item in enumerate(payload, start=1) if isinstance(item, dict)]
            return import_parsed_rows(db, rows, default_name, default_description)
        return import_flexible_json(db, payload, default_name, default_description)

    if isinstance(payload, dict):
        raw_rows = payload.get("rows") or payload.get("tasks")
        if isinstance(raw_rows, list) and raw_rows and isinstance(raw_rows[0], dict) and _row_looks_like_datamarts(raw_rows[0]):
            json_name, json_description, parsed_rows = parse_json_rows(payload)
            name = project_name or json_name or default_name
            description = project_description or json_description or default_description
            return import_parsed_rows(db, parsed_rows, name, description)
        name = project_name or payload.get("name") or default_name
        description = project_description or payload.get("description") or default_description
        return import_flexible_json(db, payload, str(name), str(description) if description else None)

    raise ValueError("Unsupported JSON structure")

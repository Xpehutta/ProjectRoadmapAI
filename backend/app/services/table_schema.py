"""Project table column schema: materialize, add custom columns, remove columns."""

from __future__ import annotations

import re
import unicodedata

from sqlalchemy.orm import Session

from app.models import Project, Task

CORE_KEYS = frozenset({"status", "name"})

PINNED_KEYS_GENERIC = frozenset(
    {
        "status",
        "name",
        "assignee",
        "start_date",
        "end_date",
        "indicative_start",
        "indicative_end",
        "completion_pct",
    }
)

PINNED_KEYS_DATAMARTS = frozenset(
    {
        "status",
        "category_id",
        "name",
        "data_source",
        "subproduct",
        "assignee",
        "start_date",
        "end_date",
        "indicative_start",
        "indicative_end",
        "completion_pct",
    }
)

BUILTIN_COLUMNS: list[dict[str, str]] = [
    {"key": "priority", "label": "Приоритет", "type": "number", "source": "builtin"},
    {"key": "status", "label": "Статус", "type": "status", "source": "builtin"},
    {"key": "category_id", "label": "Область", "type": "category", "source": "builtin"},
    {"key": "name", "label": "Использование", "type": "text", "source": "builtin"},
    {"key": "data_source", "label": "Источник", "type": "readonly", "source": "builtin"},
    {"key": "subproduct", "label": "Витрина", "type": "text", "source": "builtin"},
    {"key": "forms", "label": "Формы", "type": "text", "source": "builtin"},
    {"key": "customer", "label": "Заказчик", "type": "text", "source": "builtin"},
    {"key": "platform", "label": "Площадка", "type": "text", "source": "builtin"},
    {"key": "area", "label": "Область", "type": "text", "source": "builtin"},
    {"key": "assignee", "label": "Команда", "type": "text", "source": "builtin"},
    {"key": "contractor", "label": "Подрядчик", "type": "text", "source": "builtin"},
    {"key": "desired_quarter", "label": "Срок", "type": "text", "source": "builtin"},
    {"key": "attribute_count", "label": "Атрибуты", "type": "text", "source": "builtin"},
    {"key": "start_date", "label": "Начало", "type": "date", "source": "builtin"},
    {"key": "end_date", "label": "Окончание", "type": "date", "source": "builtin"},
    {"key": "indicative_start", "label": "Инд. начало", "type": "date", "source": "builtin"},
    {"key": "indicative_end", "label": "Инд. окончание", "type": "date", "source": "builtin"},
    {"key": "duration_days", "label": "Длительность", "type": "number", "source": "builtin"},
    {"key": "completion_pct", "label": "%", "type": "readonly", "source": "builtin"},
    {"key": "risks", "label": "Риски", "type": "textarea", "source": "builtin"},
    {"key": "notes", "label": "Комментарий", "type": "textarea", "source": "builtin"},
    {"key": "planned_cost", "label": "План. стоимость", "type": "text", "source": "builtin"},
    {"key": "actual_cost", "label": "Факт. стоимость", "type": "text", "source": "builtin"},
    {"key": "planned_effort", "label": "План. трудозатраты", "type": "text", "source": "builtin"},
    {"key": "actual_effort", "label": "Факт. трудозатраты", "type": "text", "source": "builtin"},
    {"key": "predecessors", "label": "Предшественники", "type": "text", "source": "builtin"},
]

BUILTIN_BY_KEY = {col["key"]: col for col in BUILTIN_COLUMNS}


def is_datamarts_project(project: Project, tasks: list[Task]) -> bool:
    if "витрин" in (project.name or "").lower():
        return True
    return any(task.data_source or task.component_id or task.subproduct for task in tasks)


def pinned_keys_for_project(project: Project, tasks: list[Task]) -> frozenset[str]:
    return PINNED_KEYS_DATAMARTS if is_datamarts_project(project, tasks) else PINNED_KEYS_GENERIC


def default_table_schema(kind: str = "generic") -> list[dict]:
    pinned = PINNED_KEYS_DATAMARTS if kind == "datamarts" else PINNED_KEYS_GENERIC
    return [dict(col) for col in BUILTIN_COLUMNS if col["key"] in pinned]


def _is_empty(value) -> bool:
    return value is None or value == ""


def _task_has_builtin_value(task: Task, key: str) -> bool:
    if key == "predecessors":
        return len(task.predecessors) > 0
    if key == "data_source":
        return bool(task.data_source or task.component_id)
    if key == "completion_pct":
        return (task.completion_pct or 0) > 0
    if key == "category_id":
        return task.category_id is not None
    value = getattr(task, key, None)
    return not _is_empty(value)


def _collect_custom_keys(tasks: list[Task]) -> list[str]:
    keys: set[str] = set()
    for task in tasks:
        for key, value in (task.custom_fields or {}).items():
            if not _is_empty(value):
                keys.add(key)
    return sorted(keys)


def _label_for_custom_key(key: str, schema: list[dict] | None) -> str:
    if schema:
        for col in schema:
            if col.get("key") == key:
                return col.get("label") or key
    return key.replace("custom_", "Столбец ")


def _normalize_column_label(col: dict) -> dict:
    out = dict(col)
    if out.get("key") == "category_id" and out.get("label") == "БВ":
        out["label"] = "Область"
    if out.get("key") == "subproduct" and out.get("label") == "Субпродукт":
        out["label"] = "Витрина"
    return out


def materialize_schema(project: Project, tasks: list[Task]) -> list[dict]:
    """Build effective column list (adaptive mode) from tasks."""
    if project.table_schema:
        return [_normalize_column_label(col) for col in project.table_schema]

    columns: list[dict] = []
    pinned = pinned_keys_for_project(project, tasks)
    for col in BUILTIN_COLUMNS:
        key = col["key"]
        if key in pinned or any(_task_has_builtin_value(task, key) for task in tasks):
            columns.append(dict(col))

    for key in _collect_custom_keys(tasks):
        columns.append(
            {
                "key": key,
                "label": _label_for_custom_key(key, project.table_schema),
                "type": "text",
                "source": "custom",
            }
        )

    if not any(c["key"] == "status" for c in columns):
        columns.insert(0, dict(BUILTIN_BY_KEY["status"]))
    if not any(c["key"] == "name" for c in columns):
        insert_at = 1 if columns and columns[0]["key"] == "status" else 0
        columns.insert(insert_at, dict(BUILTIN_BY_KEY["name"]))

    return columns


def get_effective_schema(project: Project, tasks: list[Task]) -> list[dict]:
    return materialize_schema(project, tasks)


def list_hidden_builtin_columns(project: Project, tasks: list[Task]) -> list[dict]:
    current_keys = {col["key"] for col in get_effective_schema(project, tasks)}
    return [dict(col) for col in BUILTIN_COLUMNS if col["key"] not in current_keys]


def _slugify_label(label: str) -> str:
    text = unicodedata.normalize("NFKD", label.strip().lower())
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "column"


def _make_custom_key(label: str, existing_keys: set[str]) -> str:
    base = f"custom_{_slugify_label(label)}"
    if base not in existing_keys:
        return base
    index = 2
    while f"{base}_{index}" in existing_keys:
        index += 1
    return f"{base}_{index}"


def _persist_schema(db: Session, project: Project, schema: list[dict]) -> None:
    project.table_schema = schema
    db.add(project)
    db.commit()
    db.refresh(project)


def add_custom_column(db: Session, project: Project, tasks: list[Task], label: str) -> dict:
    label = label.strip()
    if not label:
        raise ValueError("Column label is required")

    schema = materialize_schema(project, tasks)
    existing_keys = {col["key"] for col in schema}
    if any(col.get("label", "").strip().lower() == label.lower() for col in schema):
        raise ValueError("Column with this label already exists")

    key = _make_custom_key(label, existing_keys)
    column = {"key": key, "label": label, "type": "text", "source": "custom"}
    schema.append(column)
    _persist_schema(db, project, schema)
    return column


def add_builtin_column(db: Session, project: Project, tasks: list[Task], key: str) -> dict:
    builtin = BUILTIN_BY_KEY.get(key)
    if not builtin:
        raise ValueError("Unknown standard column")

    schema = materialize_schema(project, tasks)
    if any(col["key"] == key for col in schema):
        raise ValueError("Column already visible")

    # Insert before predecessors if present, otherwise append
    insert_at = len(schema)
    for index, col in enumerate(schema):
        if col["key"] == "predecessors":
            insert_at = index
            break
    schema.insert(insert_at, dict(builtin))
    _persist_schema(db, project, schema)
    return dict(builtin)


def remove_column(db: Session, project: Project, tasks: list[Task], key: str) -> None:
    if key in CORE_KEYS:
        raise ValueError("Cannot remove required columns")

    schema = materialize_schema(project, tasks)
    column = next((col for col in schema if col["key"] == key), None)
    if not column:
        raise ValueError("Column not found")

    schema = [col for col in schema if col["key"] != key]
    _persist_schema(db, project, schema)

    if column.get("source") == "custom":
        for task in tasks:
            if task.custom_fields and key in task.custom_fields:
                updated = dict(task.custom_fields)
                del updated[key]
                task.custom_fields = updated or None
                db.add(task)
        db.commit()

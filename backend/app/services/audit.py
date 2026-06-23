from datetime import date
from decimal import Decimal
from enum import Enum

from sqlalchemy.orm import Session

from app.context import user_name_var
from app.models import AuditEvent, AuditEventType, Task
from app.services.notification_batch import PendingTaskChange, queue_task_change


def _serialize(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, Decimal)):
        return str(value)
    return str(value)


def log_change(
    db: Session,
    task: Task,
    event_type: AuditEventType,
    field: str,
    old_value,
    new_value,
    *,
    user_name: str | None = None,
) -> AuditEvent:
    old_s = _serialize(old_value)
    new_s = _serialize(new_value)
    if old_s == new_s:
        return None  # type: ignore
    event = AuditEvent(
        task_id=task.id,
        user_name=user_name or user_name_var.get(),
        event_type=event_type,
        field=field,
        old_value=old_s,
        new_value=new_s,
    )
    db.add(event)
    event_type_value = event_type.value if hasattr(event_type, "value") else str(event_type)
    queue_task_change(
        db,
        PendingTaskChange(
            task_id=task.id,
            project_id=task.project_id,
            task_name=task.name,
            field=field,
            old_value=old_s,
            new_value=new_s,
            actor=user_name or user_name_var.get(),
            event_type=event_type_value,
        ),
    )
    return event


def classify_field(field: str) -> AuditEventType:
    if field in {"start_date", "end_date", "duration_days", "indicative_start", "indicative_end"}:
        return AuditEventType.dates
    if field in {"planned_cost", "actual_cost"}:
        return AuditEventType.cost
    if field in {"planned_effort", "actual_effort"}:
        return AuditEventType.effort
    if field == "status":
        return AuditEventType.status
    return AuditEventType.other

from datetime import date, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import Dependency, DependencyType, Task
from app.services.audit import classify_field, log_change


def _task_duration(task: Task) -> int:
    if task.duration_days is not None:
        return task.duration_days
    if task.start_date and task.end_date:
        return (task.end_date - task.start_date).days + 1
    return 1


def _set_task_dates(task: Task, start: date, end: date) -> None:
    task.start_date = start
    task.end_date = end
    task.duration_days = (end - start).days + 1


def _constraint_date(pred: Task, dep: Dependency) -> date | None:
    lag = timedelta(days=dep.lag_days)
    if dep.type == DependencyType.FS:
        if pred.end_date:
            return pred.end_date + lag + timedelta(days=1)
    elif dep.type == DependencyType.SS:
        if pred.start_date:
            return pred.start_date + lag
    elif dep.type == DependencyType.FF:
        if pred.end_date:
            return pred.end_date + lag
    elif dep.type == DependencyType.SF:
        if pred.start_date:
            return pred.start_date + lag - timedelta(days=_task_duration(pred) - 1)
    return None


def _apply_constraint(successor: Task, required_start: date, dep_type: DependencyType) -> bool:
    duration = _task_duration(successor)
    changed = False
    if dep_type in (DependencyType.FS, DependencyType.SS, DependencyType.SF):
        if successor.start_date is None or successor.start_date < required_start:
            new_end = required_start + timedelta(days=duration - 1)
            _set_task_dates(successor, required_start, new_end)
            changed = True
    elif dep_type == DependencyType.FF:
        if successor.end_date is None or successor.end_date < required_start:
            new_start = required_start - timedelta(days=duration - 1)
            _set_task_dates(successor, new_start, required_start)
            changed = True
    return changed


def cascade_from_task(db: Session, root_task: Task) -> list[Task]:
    """Shift successors when predecessor dates change. Returns all modified tasks."""
    project_id = root_task.project_id
    deps: list[Dependency] = (
        db.query(Dependency).filter(Dependency.project_id == project_id).all()
    )
    tasks: dict[int, Task] = {
        t.id: t for t in db.query(Task).filter(Task.project_id == project_id).all()
    }
    successors_map: dict[int, list[Dependency]] = {}
    for d in deps:
        successors_map.setdefault(d.predecessor_id, []).append(d)

    modified: dict[int, Task] = {}
    queue: list[int] = [root_task.id]
    visited_order: list[int] = []

    while queue:
        pred_id = queue.pop(0)
        if pred_id in visited_order:
            continue
        visited_order.append(pred_id)
        pred = tasks.get(pred_id)
        if not pred:
            continue
        for dep in successors_map.get(pred_id, []):
            succ = tasks.get(dep.successor_id)
            if not succ:
                continue
            required = _constraint_date(pred, dep)
            if required and _apply_constraint(succ, required, dep.type):
                modified[succ.id] = succ
                queue.append(succ.id)

    return list(modified.values())


def detect_cycle(db: Session, project_id: int, predecessor_id: int, successor_id: int) -> bool:
    if predecessor_id == successor_id:
        return True
    deps = db.query(Dependency).filter(Dependency.project_id == project_id).all()
    graph: dict[int, list[int]] = {}
    for d in deps:
        graph.setdefault(d.predecessor_id, []).append(d.successor_id)
    graph.setdefault(predecessor_id, []).append(successor_id)

    visited: set[int] = set()
    stack: set[int] = set()

    def dfs(node: int) -> bool:
        if node in stack:
            return True
        if node in visited:
            return False
        visited.add(node)
        stack.add(node)
        for nxt in graph.get(node, []):
            if dfs(nxt):
                return True
        stack.remove(node)
        return False

    for node in graph:
        if dfs(node):
            return True
    return False


def apply_field_changes(
    db: Session,
    entity: object,
    changes: dict,
    *,
    audit_task: Task | None = None,
) -> list[str]:
    """Apply field updates; audit entries always reference a real task row."""
    audit_target = audit_task if audit_task is not None else entity
    changed_fields: list[str] = []
    for field, new_value in changes.items():
        old_value = getattr(entity, field)
        if old_value != new_value:
            if isinstance(audit_target, Task):
                log_change(db, audit_target, classify_field(field), field, old_value, new_value)
            setattr(entity, field, new_value)
            changed_fields.append(field)
    return changed_fields

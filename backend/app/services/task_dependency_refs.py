"""Resolve task predecessor references, optionally with stage numbers."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Task
from app.models import DependencyType
from app.services.component_merge import effective_sub_stages


@dataclass
class ResolvedPredecessorRef:
    task: Task
    predecessor_stage_id: int | None = None
    successor_stage_id: int | None = None
    dep_type: DependencyType = DependencyType.FS


def _sorted_stages(task: Task):
    stages = effective_sub_stages(task)
    return sorted(stages, key=lambda s: s.sort_order)


def _stage_id_by_number(task: Task, number: int) -> int:
    stages = _sorted_stages(task)
    if number < 1 or number > len(stages):
        raise ValueError(f"Stage {number} not found for task «{task.name}»")
    return stages[number - 1].id


def stage_meta(task: Task, stage_id: int | None) -> tuple[str | None, int | None]:
    if stage_id is None:
        return None, None
    for index, stage in enumerate(_sorted_stages(task)):
        if stage.id == stage_id:
            return stage.name, index + 1
    return None, None


def parse_predecessor_ref(ref: str) -> tuple[str, int | None, int | None, DependencyType]:
    """Parse `TaskName`, `TaskName:2`, `TaskName>3`, `TaskName:2>3`, optional `@FS`."""
    text = ref.strip()
    if not text:
        raise ValueError("Empty predecessor reference")

    dep_type = DependencyType.FS
    if "@" in text:
        text, type_raw = text.rsplit("@", 1)
        text = text.strip()
        type_raw = type_raw.strip().upper()
        try:
            dep_type = DependencyType(type_raw)
        except ValueError as exc:
            raise ValueError(f"Invalid dependency type in reference: {ref}") from exc

    successor_stage_num: int | None = None
    if ">" in text:
        text, succ_raw = text.split(">", 1)
        succ_raw = succ_raw.strip()
        if succ_raw:
            if not succ_raw.isdigit():
                raise ValueError(f"Invalid successor stage in reference: {ref}")
            successor_stage_num = int(succ_raw)

    predecessor_stage_num: int | None = None
    if ":" in text:
        task_part, pred_raw = text.rsplit(":", 1)
        pred_raw = pred_raw.strip()
        if pred_raw.isdigit():
            predecessor_stage_num = int(pred_raw)
            text = task_part.strip()

    if not text:
        raise ValueError(f"Invalid predecessor reference: {ref}")

    return text, predecessor_stage_num, successor_stage_num, dep_type


def resolve_predecessor_refs(
    db: Session,
    project_id: int,
    refs: list[str],
    successor_task: Task,
) -> list[ResolvedPredecessorRef]:
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    by_id = {str(t.id): t for t in tasks}
    by_name = {t.name.lower(): t for t in tasks}
    resolved: list[ResolvedPredecessorRef] = []

    for ref in refs:
        ref = ref.strip()
        if not ref:
            continue
        try:
            task_token, pred_stage_num, succ_stage_num, dep_type = parse_predecessor_ref(ref)
        except ValueError as exc:
            raise ValueError(str(exc)) from exc

        pred_task = by_id.get(task_token) or by_name.get(task_token.lower())
        if not pred_task:
            raise ValueError(f"Unknown predecessor reference: {ref}")

        pred_stage_id = (
            _stage_id_by_number(pred_task, pred_stage_num) if pred_stage_num is not None else None
        )
        succ_stage_id = (
            _stage_id_by_number(successor_task, succ_stage_num) if succ_stage_num is not None else None
        )

        resolved.append(
            ResolvedPredecessorRef(
                task=pred_task,
                predecessor_stage_id=pred_stage_id,
                successor_stage_id=succ_stage_id,
                dep_type=dep_type,
            )
        )

    return resolved


def predecessor_ref_from_dependency(
    dep,
    successor_task: Task,
) -> tuple[str, ResolvedPredecessorRef]:
    pred_task = dep.predecessor
    pred_name, pred_num = _stage_meta(pred_task, dep.predecessor_stage_id)
    _, succ_num = _stage_meta(successor_task, dep.successor_stage_id)

    token = pred_task.name
    if pred_num is not None:
        token = f"{token}:{pred_num}"
    if succ_num is not None:
        token = f"{token}>{succ_num}"

    return token, ResolvedPredecessorRef(
        task=pred_task,
        predecessor_stage_id=dep.predecessor_stage_id,
        successor_stage_id=dep.successor_stage_id,
    )


def validate_dependency_stages(
    db: Session,
    predecessor_id: int,
    successor_id: int,
    predecessor_stage_id: int | None,
    successor_stage_id: int | None,
) -> None:
    pred = db.query(Task).filter(Task.id == predecessor_id).first()
    succ = db.query(Task).filter(Task.id == successor_id).first()
    if not pred or not succ:
        raise HTTPException(404, "Task not found")
    if predecessor_stage_id is not None:
        valid = {s.id for s in _sorted_stages(pred)}
        if predecessor_stage_id not in valid:
            raise HTTPException(400, "predecessor_stage_id does not belong to predecessor task")
    if successor_stage_id is not None:
        valid = {s.id for s in _sorted_stages(succ)}
        if successor_stage_id not in valid:
            raise HTTPException(400, "successor_stage_id does not belong to successor task")

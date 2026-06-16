from sqlalchemy.orm import Session, joinedload

from app.models import Dependency, ProjectComponent, Task
from app.schemas import PredecessorRef, TaskOut
from app.services.component_merge import effective_sub_stages, merge_task_fields


def task_to_out(task: Task, db: Session | None = None) -> TaskOut:
    preds: list[PredecessorRef] = []
    if task.predecessors:
        for dep in task.predecessors:
            if dep.predecessor:
                preds.append(
                    PredecessorRef(id=dep.predecessor.id, name=dep.predecessor.name, type=dep.type)
                )
    merged = merge_task_fields(task)
    return TaskOut(
        id=task.id,
        project_id=task.project_id,
        category_id=task.category_id,
        name=task.name,
        assignee=merged["assignee"],
        status=merged["status"],
        completion_pct=merged["completion_pct"],
        version=task.version,
        start_date=merged["start_date"],
        end_date=merged["end_date"],
        duration_days=merged["duration_days"],
        indicative_start=merged["indicative_start"],
        indicative_end=merged["indicative_end"],
        planned_cost=task.planned_cost,
        actual_cost=task.actual_cost,
        planned_effort=task.planned_effort,
        actual_effort=task.actual_effort,
        priority=task.priority,
        release_id=task.release_id,
        goal_id=task.goal_id,
        moscow=task.moscow,
        rice_reach=task.rice_reach,
        rice_impact=task.rice_impact,
        rice_confidence=task.rice_confidence,
        rice_effort=task.rice_effort,
        value_score=task.value_score,
        effort_score=task.effort_score,
        subproduct=task.subproduct,
        forms=task.forms,
        customer=task.customer,
        data_source=task.data_source,
        platform=merged["platform"],
        area=task.area,
        contractor=merged["contractor"],
        desired_quarter=task.desired_quarter,
        attribute_count=task.attribute_count,
        risks=task.risks,
        notes=task.notes,
        extra_info=task.extra_info,
        component_id=merged["component_id"],
        component_name=merged["component_name"],
        component_version=merged["component_version"],
        component_usage_count=merged["component_usage_count"],
        sub_stages=effective_sub_stages(task),
        predecessors=preds,
    )


def load_task(db: Session, task_id: int) -> Task | None:
    return (
        db.query(Task)
        .options(
            joinedload(Task.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.sub_stages),
            joinedload(Task.component).joinedload(ProjectComponent.tasks),
            joinedload(Task.predecessors).joinedload(Dependency.predecessor),
        )
        .filter(Task.id == task_id)
        .first()
    )


def resolve_predecessor_refs(db: Session, project_id: int, refs: list[str]) -> list[Task]:
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    by_id = {str(t.id): t for t in tasks}
    by_name = {t.name.lower(): t for t in tasks}
    resolved: list[Task] = []
    for ref in refs:
        ref = ref.strip()
        if not ref:
            continue
        task = by_id.get(ref) or by_name.get(ref.lower())
        if not task:
            raise ValueError(f"Unknown predecessor reference: {ref}")
        resolved.append(task)
    return resolved

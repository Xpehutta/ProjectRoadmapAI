from sqlalchemy.orm import Session, joinedload

from app.models import ComponentSubStage, Dependency, ProjectComponent, Task
from app.schemas import ComponentOut, ComponentUsageOut, SubStageOut
from app.services.component_merge import component_stage_to_out


def component_to_out(component: ProjectComponent) -> ComponentOut:
    usages = [
        ComponentUsageOut(id=t.id, name=t.name, category_id=t.category_id) for t in (component.tasks or [])
    ]
    stages = [component_stage_to_out(s) for s in (component.sub_stages or [])]
    return ComponentOut(
        id=component.id,
        project_id=component.project_id,
        name=component.name,
        data_source=component.data_source,
        assignee=component.assignee,
        status=component.status,
        completion_pct=component.completion_pct,
        version=component.version,
        start_date=component.start_date,
        end_date=component.end_date,
        duration_days=component.duration_days,
        indicative_start=component.indicative_start,
        indicative_end=component.indicative_end,
        contractor=component.contractor,
        platform=component.platform,
        notes=component.notes,
        usage_count=len(usages),
        usages=usages,
        sub_stages=stages,
    )


def load_component(db: Session, component_id: int) -> ProjectComponent | None:
    return (
        db.query(ProjectComponent)
        .options(
            joinedload(ProjectComponent.sub_stages),
            joinedload(ProjectComponent.tasks),
        )
        .filter(ProjectComponent.id == component_id)
        .first()
    )


def recompute_component_completion(db: Session, component: ProjectComponent) -> None:
    from app.models import TaskStatus

    stages = (
        db.query(ComponentSubStage)
        .filter(ComponentSubStage.component_id == component.id)
        .all()
    )
    if not stages:
        return
    done = sum(1 for s in stages if s.is_done)
    new_pct = int(round(done / len(stages) * 100))
    component.completion_pct = new_pct
    if new_pct == 100:
        component.status = TaskStatus.done
    elif component.status == TaskStatus.done and new_pct < 100:
        component.status = TaskStatus.in_progress

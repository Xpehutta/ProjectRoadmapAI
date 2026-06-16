from pathlib import Path

from app.datamarts_import import parse_workbook, resolve_xlsx_path


def test_parse_datamarts_workbook():
    path = resolve_xlsx_path()
    rows = parse_workbook(path)
    assert len(rows) >= 50
    assert any(r.category == "Витрина Операции" for r in rows)
    assert any(r.data_source and "ЦОД" in r.data_source for r in rows)
    assert any(r.phases for r in rows)
    with_dates = [r for r in rows if r.start_date or r.indicative_start]
    assert len(with_dates) > 10


def test_russian_date_parsing():
    from app.datamarts_import import parse_phase_value

    parsed = parse_phase_value("15 июл. 2026 г.")
    assert parsed is not None
    assert parsed.due_date is not None
    assert parsed.due_date.year == 2026
    assert parsed.due_date.month == 7
    assert parsed.due_date.day == 15

    done = parse_phase_value("DONE")
    assert done is not None
    assert done.is_done

    ind = parse_phase_value("индикатив: 4 сент. 2026 г.")
    assert ind is not None
    assert ind.is_indicative
    assert ind.due_date is not None
    assert ind.due_date.month == 9


def test_build_usage_name_includes_source_without_subproduct():
    from app.datamarts_import import build_usage_name

    assert build_usage_name("Витрина Операции", None, "ППРБ.Переводы") == "Витрина Операции · ППРБ.Переводы"
    assert (
        build_usage_name("Аналитический баланс", "СДКП", "УВДО.АФЛ")
        == "Аналитический баланс · СДКП · УВДО.АФЛ"
    )
    assert build_usage_name("Документы", "Переводы ФЛ", "ППРБ.Переводы") == "Документы · Переводы ФЛ · ППРБ.Переводы"


def test_component_dedup_on_import():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.database import Base
    from app.datamarts_import import import_datamarts
    from app.models import ProjectComponent, Task

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    project = import_datamarts(db)
    components = db.query(ProjectComponent).filter(ProjectComponent.project_id == project.id).all()
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    assert len(tasks) >= 50
    assert len(components) < len(tasks)
    pprb = [c for c in components if "ППРБ.Переводы" in (c.data_source or "")]
    if pprb:
        comp = pprb[0]
        linked = [t for t in tasks if t.component_id == comp.id]
        assert len(linked) >= 2
    db.close()

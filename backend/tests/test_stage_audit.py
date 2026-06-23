from app.services.stage_audit import parse_stage_shift_field, stage_shift_days, stage_shift_from_event


def test_parse_stage_shift_field_with_long_name():
    field = "sub_stage:7:Детальный слой / Аналитика / Профилирование данных источника.end_date"
    parsed = parse_stage_shift_field(field)
    assert parsed == (
        7,
        "Детальный слой / Аналитика / Профилирование данных источника",
        "end_date",
    )


def test_stage_shift_days_positive():
    assert stage_shift_days("2024-03-10", "2024-03-20") == 10


def test_stage_shift_from_event():
    class Event:
        created_at = type("dt", (), {"isoformat": lambda self: "2024-06-01T12:00:00"})()
        user_name = "tester"
        field = "sub_stage:1:Загрузка.end_date"
        old_value = "2024-03-10"
        new_value = "2024-03-20"

    entry = stage_shift_from_event(Event())
    assert entry["days"] == 10
    assert entry["direction"] == "later"


def test_is_shift_comment():
    from app.services.stage_audit import is_shift_comment

    assert is_shift_comment("Этап «Аналитика»: перенос из-за задержки")
    assert not is_shift_comment("Обычный комментарий к задаче")

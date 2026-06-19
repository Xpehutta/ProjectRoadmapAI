from datetime import date

from app.services.stage_indicative import indicative_dates_from_stages


class _Stage:
    def __init__(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        due_date: date | None = None,
        is_done: bool = False,
        is_indicative: bool = True,
    ):
        self.start_date = start_date
        self.end_date = end_date
        self.due_date = due_date
        self.is_done = is_done
        self.is_indicative = is_indicative


def test_indicative_dates_min_start_max_end():
    stages = [
        _Stage(start_date=date(2024, 3, 1), end_date=date(2024, 3, 10)),
        _Stage(start_date=date(2024, 3, 15), end_date=date(2024, 3, 25)),
    ]
    assert indicative_dates_from_stages(stages) == (date(2024, 3, 1), date(2024, 3, 25))


def test_indicative_end_falls_back_to_due_date():
    stages = [_Stage(due_date=date(2024, 5, 20))]
    assert indicative_dates_from_stages(stages) == (date(2024, 5, 20), date(2024, 5, 20))


def test_indicative_min_start_max_end_mixed_dates():
    stages = [
        _Stage(due_date=date(2024, 2, 1)),
        _Stage(start_date=date(2024, 3, 1), end_date=date(2024, 3, 31)),
        _Stage(start_date=date(2024, 4, 1), end_date=date(2024, 4, 15)),
    ]
    assert indicative_dates_from_stages(stages) == (date(2024, 2, 1), date(2024, 4, 15))


def test_indicative_empty_when_no_dates():
    assert indicative_dates_from_stages([_Stage()]) == (None, None)


def test_indicative_excludes_unplanned_stages():
    stages = [
        _Stage(start_date=date(2024, 1, 1), end_date=date(2024, 1, 31), is_indicative=False),
        _Stage(start_date=date(2024, 3, 1), end_date=date(2024, 3, 10), is_indicative=True),
    ]
    assert indicative_dates_from_stages(stages) == (date(2024, 3, 1), date(2024, 3, 10))


def test_actual_dates_from_completed_stages_only():
    stages = [
        _Stage(start_date=date(2024, 3, 1), end_date=date(2024, 3, 10), is_done=True),
        _Stage(start_date=date(2024, 3, 15), end_date=date(2024, 3, 25)),
    ]
    from app.services.stage_indicative import actual_dates_from_completed_stages

    assert actual_dates_from_completed_stages(stages) == (date(2024, 3, 1), date(2024, 3, 10))

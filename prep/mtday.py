"""Fixed-offset mapping for the May to October 2026 Mountain-day window."""

from datetime import date, datetime, time, timedelta, timezone

MOUNTAIN = timezone(timedelta(hours=-6))
UTC = timezone.utc
FIRST_DAY = date(2026, 5, 1)
LAST_DAY = date(2026, 10, 31)


def _day(value: str | date) -> date:
    return date.fromisoformat(value) if isinstance(value, str) else value


def _guard(day: date) -> None:
    if not FIRST_DAY <= day <= LAST_DAY:
        raise ValueError(f"fixed MDT mapping is only valid from {FIRST_DAY} through {LAST_DAY}")


def mountain_day_hours(day: str | date) -> list[datetime]:
    mountain_day = _day(day)
    _guard(mountain_day)
    start = datetime.combine(mountain_day, time.min, tzinfo=MOUNTAIN).astimezone(UTC)
    return [start + timedelta(hours=hour) for hour in range(24)]


def local_mt(ts: str | datetime) -> str:
    instant = datetime.fromisoformat(ts.replace("Z", "+00:00")) if isinstance(ts, str) else ts
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    _guard(instant.astimezone(MOUNTAIN).date())
    return instant.astimezone(MOUNTAIN).strftime("%Y-%m-%dT%H:%M-06:00")


def caiso_operating_days(day: str | date) -> tuple[str, str]:
    mountain_day = _day(day)
    _guard(mountain_day)
    return ((mountain_day - timedelta(days=1)).isoformat(), mountain_day.isoformat())


def caiso_operating_hour(day: str | date, hour_mt: int) -> tuple[str, int]:
    mountain_day = _day(day)
    _guard(mountain_day)
    if not 0 <= hour_mt <= 23:
        raise ValueError("Mountain hour must be between 0 and 23")
    if hour_mt == 0:
        return (mountain_day - timedelta(days=1)).isoformat(), 24
    return mountain_day.isoformat(), hour_mt

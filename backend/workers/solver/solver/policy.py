"""Deterministic scheduling policy shared by online and offline solvers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from .models import Candidate, SolverOptions, WeatherBucket


@dataclass(frozen=True, slots=True)
class PacingPreset:
    name: str
    target_stops: int
    activity_to_rest_ratio: float
    start_offset_min: int
    max_continuous_walk_min: int | None


PACKED = PacingPreset("packed", target_stops=5, activity_to_rest_ratio=3.0, start_offset_min=30, max_continuous_walk_min=None)
BALANCED = PacingPreset("balanced", target_stops=4, activity_to_rest_ratio=2.0, start_offset_min=0, max_continuous_walk_min=30)
RELAXED = PacingPreset("relaxed", target_stops=3, activity_to_rest_ratio=1.0, start_offset_min=0, max_continuous_walk_min=15)


def pacing_preset(options: SolverOptions) -> PacingPreset:
    """Return an editable default; targets influence value and never hard-cap."""

    if options.pacing:
        requested = options.pacing.casefold()
        if requested == "packed":
            return PACKED
        if requested == "relaxed":
            return RELAXED
        return BALANCED
    if options.age is not None and options.age < 30:
        return PACKED
    if options.age is not None and options.age >= 60:
        return RELAXED
    return BALANCED


def priority_prize(priority: float) -> int:
    """Map curation rank/weight to a super-increasing integer prize.

    A factor of four means one stop at level N is worth more than two stops at
    level N-1, preventing the linear-score failure described in the PRD.  Values
    are capped so untrusted job data cannot overflow OR-Tools int64 arithmetic.
    """

    bounded = max(-8.0, min(12.0, priority))
    return max(1, min(250_000_000, int(round(64 * (4**bounded)))))


def weather_multiplier(candidate: Candidate, bucket: WeatherBucket | None) -> float:
    if bucket is None or candidate.indoor_outdoor == "indoor":
        return 1.0
    rain = bucket.rain_probability
    if rain > 0.70:
        rain_factor = 0.0 if candidate.indoor_outdoor == "outdoor" else 0.5
    elif rain >= 0.40:
        rain_factor = 0.5 if candidate.indoor_outdoor == "outdoor" else 0.75
    else:
        rain_factor = 1.0

    temperature_factor = 1.0
    if bucket.temperature_c is not None:
        if bucket.temperature_c >= 35 or bucket.temperature_c <= -5:
            temperature_factor = 0.25 if candidate.indoor_outdoor == "outdoor" else 0.75
        elif bucket.temperature_c >= 30 or bucket.temperature_c <= 2:
            temperature_factor = 0.65 if candidate.indoor_outdoor == "outdoor" else 0.9
    return rain_factor * temperature_factor


def departure_buffer_minutes(options: SolverOptions) -> int:
    base = {
        "train": 45,
        "flight": 150,
        "bus": 40,
        "ferry": 40,
    }.get((options.departure_mode or "").casefold(), 0)
    if options.age is not None and options.age < 30 and pacing_preset(options).name == "packed":
        base = max(0, base - 10)
    if (options.age is not None and options.age >= 60) or options.limited_mobility:
        base += 30 if options.limited_mobility else 15
    return base


def effective_deadline(deadline: datetime | None, options: SolverOptions) -> datetime | None:
    if deadline is None:
        return None
    return deadline - timedelta(minutes=departure_buffer_minutes(options))


def auto_insertable(candidate: Candidate) -> bool:
    """Enforce the out-of-town coordinate/access doctrine before optimization."""

    if not candidate.out_of_town:
        return True
    if candidate.access_status in {"routable", "corroborated", "verified"}:
        return True
    return candidate.user_forced


def access_buffer_minutes(candidate: Candidate, options: SolverOptions) -> int:
    if candidate.out_of_town and candidate.access_status not in {"routable", "corroborated", "verified"}:
        return options.forced_access_buffer_min
    return 0


def golden_hour_multiplier(candidate: Candidate, starts: datetime, ends: datetime) -> float:
    for window in candidate.best_time_windows:
        if window.opens < ends and starts < window.closes:
            return 1.875  # PRD example: 150 vs 80.
    return 1.0


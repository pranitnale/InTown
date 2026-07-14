"""Expand POIs into day/time variants without changing the frozen API shape."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from .models import Candidate, Day, SolverRequest
from .policy import (
    access_buffer_minutes,
    auto_insertable,
    effective_deadline,
    golden_hour_multiplier,
    pacing_preset,
    priority_prize,
    weather_multiplier,
)


@dataclass(frozen=True, slots=True)
class VisitVariant:
    key: str
    candidate: Candidate
    day_index: int
    opens: datetime
    latest_start: datetime
    duration_min: int
    prize: int

    @property
    def node(self) -> str:
        return self.candidate.node


def _base_intervals(request: SolverRequest, candidate: Candidate, day: Day) -> list[tuple[datetime, datetime]]:
    deadline = effective_deadline(day.end_deadline, request.options)
    preset = pacing_preset(request.options)
    effective_start = day.start_time + timedelta(minutes=preset.start_offset_min)
    day_end = deadline or (day.start_time + timedelta(minutes=request.options.max_day_duration_min))
    day_windows = candidate.windows_for_day(day.day_index)
    if candidate.windows and not day_windows:
        return []
    if not day_windows:
        return [(effective_start, day_end)]
    intervals: list[tuple[datetime, datetime]] = []
    for window in day_windows:
        opens = max(effective_start, window.opens)
        closes = min(day_end, window.closes)
        if closes > opens:
            intervals.append((opens, closes))
    return intervals


def _split_boundaries(
    request: SolverRequest,
    candidate: Candidate,
    day: Day,
    opens: datetime,
    closes: datetime,
) -> list[tuple[datetime, datetime]]:
    boundaries = {opens, closes}
    for bucket in request.options.weather:
        if bucket.day_index == day.day_index and bucket.starts < closes and opens < bucket.ends:
            boundaries.add(max(opens, bucket.starts))
            boundaries.add(min(closes, bucket.ends))
    for window in candidate.best_time_windows:
        if window.day_index == day.day_index and window.opens < closes and opens < window.closes:
            boundaries.add(max(opens, window.opens))
            boundaries.add(min(closes, window.closes))
    ordered = sorted(boundaries)
    return [(left, right) for left, right in zip(ordered, ordered[1:]) if right > left]


def _weather_at(request: SolverRequest, day_index: int, instant: datetime):
    for bucket in request.options.weather:
        if bucket.day_index == day_index and bucket.starts <= instant < bucket.ends:
            return bucket
    return None


def expand_variants(request: SolverRequest) -> dict[str, tuple[VisitVariant, ...]]:
    """Return feasible day/time clones keyed by canonical POI id."""

    expanded: dict[str, tuple[VisitVariant, ...]] = {}
    for candidate in request.candidates:
        if not auto_insertable(candidate):
            expanded[candidate.poi_id] = ()
            continue
        duration = candidate.duration_min + access_buffer_minutes(candidate, request.options)
        preset = pacing_preset(request.options)
        if preset.name == "relaxed":
            # Rest is pacing, not a stop-count cap: any stop can still be chosen
            # when the actual time windows and deadline allow it.
            duration += min(candidate.duration_min, 60)
        variants: list[VisitVariant] = []
        for day in request.days:
            for base_opens, base_closes in _base_intervals(request, candidate, day):
                for segment_opens, segment_closes in _split_boundaries(
                    request, candidate, day, base_opens, base_closes
                ):
                    latest_start = segment_closes - timedelta(minutes=duration)
                    if latest_start < segment_opens:
                        continue
                    midpoint = segment_opens + (segment_closes - segment_opens) / 2
                    multiplier = weather_multiplier(
                        candidate, _weather_at(request, day.day_index, midpoint)
                    ) * golden_hour_multiplier(candidate, segment_opens, segment_closes)
                    prize = max(0, int(round(priority_prize(candidate.priority) * multiplier)))
                    variants.append(
                        VisitVariant(
                            key=f"{candidate.poi_id}:{day.day_index}:{len(variants)}",
                            candidate=candidate,
                            day_index=day.day_index,
                            opens=segment_opens,
                            latest_start=latest_start,
                            duration_min=duration,
                            prize=prize,
                        )
                    )
        expanded[candidate.poi_id] = tuple(variants)
    return expanded

"""Typed, validation-first domain model for the itinerary solver.

The public worker seam is JSON.  Keeping parsing here (instead of throughout the
OR-Tools model) makes malformed jobs fail before they can consume solver time.
The optional ``options`` object contains scheduling policy inputs that are not
yet part of the frozen P00 contract; callers may omit it and get conservative
defaults.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping, Sequence


class RequestValidationError(ValueError):
    """Raised when a worker job is structurally unsafe or inconsistent."""


def parse_datetime(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise RequestValidationError(f"{field_name} must be an ISO-8601 string")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise RequestValidationError(f"{field_name} is not a valid ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise RequestValidationError(f"{field_name} must include a timezone")
    return parsed.astimezone(timezone.utc)


def format_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _mapping(value: Any, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise RequestValidationError(f"{field_name} must be an object")
    return value


def _sequence(value: Any, field_name: str) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise RequestValidationError(f"{field_name} must be an array")
    return value


def _number(value: Any, field_name: str, *, minimum: float | None = None) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise RequestValidationError(f"{field_name} must be a number")
    result = float(value)
    if minimum is not None and result < minimum:
        raise RequestValidationError(f"{field_name} must be at least {minimum:g}")
    return result


@dataclass(frozen=True, slots=True)
class Coordinate:
    lat: float
    lng: float

    @classmethod
    def from_json(cls, value: Any, field_name: str) -> "Coordinate":
        raw = _mapping(value, field_name)
        lat = _number(raw.get("lat"), f"{field_name}.lat")
        lng = _number(raw.get("lng"), f"{field_name}.lng")
        if not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise RequestValidationError(f"{field_name} is outside valid coordinate bounds")
        return cls(lat=lat, lng=lng)


@dataclass(frozen=True, slots=True)
class Anchor:
    node: str
    coord: Coordinate
    poi_id: str | None = None
    label: str | None = None

    @classmethod
    def from_json(cls, value: Any, field_name: str) -> "Anchor":
        raw = _mapping(value, field_name)
        node = raw.get("node")
        if not isinstance(node, str) or not node.strip():
            raise RequestValidationError(f"{field_name}.node must be a non-empty string")
        return cls(
            node=node,
            coord=Coordinate.from_json(raw.get("coord"), f"{field_name}.coord"),
            poi_id=raw.get("poi_id") if isinstance(raw.get("poi_id"), str) else None,
            label=raw.get("label") if isinstance(raw.get("label"), str) else None,
        )


@dataclass(frozen=True, slots=True)
class OpeningWindow:
    day_index: int
    opens: datetime
    closes: datetime

    @classmethod
    def from_json(cls, value: Any, field_name: str) -> "OpeningWindow":
        raw = _mapping(value, field_name)
        day_index = raw.get("day_index")
        if isinstance(day_index, bool) or not isinstance(day_index, int) or day_index < 0:
            raise RequestValidationError(f"{field_name}.day_index must be a non-negative integer")
        opens = parse_datetime(raw.get("opens"), f"{field_name}.opens")
        closes = parse_datetime(raw.get("closes"), f"{field_name}.closes")
        if closes <= opens:
            raise RequestValidationError(f"{field_name}.closes must be after opens")
        return cls(day_index=day_index, opens=opens, closes=closes)


@dataclass(frozen=True, slots=True)
class Candidate:
    poi_id: str
    node: str
    coord: Coordinate
    category: str
    duration_min: int
    priority: float
    must_do: bool
    indoor_outdoor: str
    windows: tuple[OpeningWindow, ...]
    # Policy extensions. They are deliberately data, never LLM-produced times.
    out_of_town: bool = False
    access_status: str = "verified"
    user_forced: bool = False
    best_time_windows: tuple[OpeningWindow, ...] = ()

    @classmethod
    def from_json(cls, value: Any, index: int) -> "Candidate":
        field_name = f"candidates[{index}]"
        raw = _mapping(value, field_name)
        poi_id = raw.get("poi_id")
        node = raw.get("node")
        if not isinstance(poi_id, str) or not poi_id:
            raise RequestValidationError(f"{field_name}.poi_id must be a non-empty string")
        if not isinstance(node, str) or not node:
            raise RequestValidationError(f"{field_name}.node must be a non-empty string")
        duration = raw.get("est_duration_min")
        if isinstance(duration, bool) or not isinstance(duration, int) or duration <= 0:
            raise RequestValidationError(f"{field_name}.est_duration_min must be a positive integer")
        exposure = raw.get("indoor_outdoor")
        if exposure not in {"indoor", "outdoor", "mixed"}:
            raise RequestValidationError(f"{field_name}.indoor_outdoor is invalid")
        windows = tuple(
            OpeningWindow.from_json(window, f"{field_name}.windows[{window_index}]")
            for window_index, window in enumerate(_sequence(raw.get("windows", []), f"{field_name}.windows"))
        )
        best_windows = tuple(
            OpeningWindow.from_json(window, f"{field_name}.best_time_windows[{window_index}]")
            for window_index, window in enumerate(
                _sequence(raw.get("best_time_windows", []), f"{field_name}.best_time_windows")
            )
        )
        return cls(
            poi_id=poi_id,
            node=node,
            coord=Coordinate.from_json(raw.get("coord"), f"{field_name}.coord"),
            category=str(raw.get("category", "OTHER")),
            duration_min=duration,
            priority=_number(raw.get("priority"), f"{field_name}.priority"),
            must_do=bool(raw.get("must_do", False)),
            indoor_outdoor=exposure,
            windows=windows,
            out_of_town=bool(raw.get("out_of_town", False)),
            access_status=str(raw.get("access_status", "verified")),
            user_forced=bool(raw.get("user_forced", False)),
            best_time_windows=best_windows,
        )

    def windows_for_day(self, day_index: int) -> tuple[OpeningWindow, ...]:
        return tuple(window for window in self.windows if window.day_index == day_index)


@dataclass(frozen=True, slots=True)
class Day:
    day_index: int
    start_time: datetime
    start: Anchor
    end_deadline: datetime | None
    end_anchor: Anchor | None
    walking_budget_m: float | None

    @classmethod
    def from_json(cls, value: Any, index: int) -> "Day":
        field_name = f"days[{index}]"
        raw = _mapping(value, field_name)
        day_index = raw.get("day_index")
        if isinstance(day_index, bool) or not isinstance(day_index, int) or day_index < 0:
            raise RequestValidationError(f"{field_name}.day_index must be a non-negative integer")
        deadline_raw = raw.get("end_deadline")
        end_anchor_raw = raw.get("end_anchor")
        budget_raw = raw.get("walking_budget_m")
        return cls(
            day_index=day_index,
            start_time=parse_datetime(raw.get("start_time"), f"{field_name}.start_time"),
            start=Anchor.from_json(raw.get("start"), f"{field_name}.start"),
            end_deadline=(
                parse_datetime(deadline_raw, f"{field_name}.end_deadline")
                if deadline_raw is not None
                else None
            ),
            end_anchor=(
                Anchor.from_json(end_anchor_raw, f"{field_name}.end_anchor")
                if end_anchor_raw is not None
                else None
            ),
            walking_budget_m=(
                _number(budget_raw, f"{field_name}.walking_budget_m", minimum=0)
                if budget_raw is not None
                else None
            ),
        )


@dataclass(frozen=True, slots=True)
class TravelEdge:
    from_node: str
    to_node: str
    mode: str
    seconds: int
    meters: float

    @classmethod
    def from_json(cls, value: Any, index: int) -> "TravelEdge":
        field_name = f"travel_matrix[{index}]"
        raw = _mapping(value, field_name)
        from_node, to_node = raw.get("from"), raw.get("to")
        if not isinstance(from_node, str) or not from_node:
            raise RequestValidationError(f"{field_name}.from must be a non-empty string")
        if not isinstance(to_node, str) or not to_node:
            raise RequestValidationError(f"{field_name}.to must be a non-empty string")
        mode = raw.get("mode")
        if mode not in {"walk", "transit", "drive", "bike", "ferry"}:
            raise RequestValidationError(f"{field_name}.mode is invalid")
        seconds = raw.get("seconds")
        if isinstance(seconds, bool) or not isinstance(seconds, int) or seconds < 0:
            raise RequestValidationError(f"{field_name}.seconds must be a non-negative integer")
        return cls(
            from_node=from_node,
            to_node=to_node,
            mode=mode,
            seconds=seconds,
            meters=_number(raw.get("meters"), f"{field_name}.meters", minimum=0),
        )


@dataclass(frozen=True, slots=True)
class WeatherBucket:
    day_index: int
    starts: datetime
    ends: datetime
    rain_probability: float = 0.0
    temperature_c: float | None = None

    @classmethod
    def from_json(cls, value: Any, index: int) -> "WeatherBucket":
        field_name = f"options.weather[{index}]"
        raw = _mapping(value, field_name)
        day_index = raw.get("day_index")
        if isinstance(day_index, bool) or not isinstance(day_index, int) or day_index < 0:
            raise RequestValidationError(f"{field_name}.day_index must be a non-negative integer")
        starts = parse_datetime(raw.get("starts"), f"{field_name}.starts")
        ends = parse_datetime(raw.get("ends"), f"{field_name}.ends")
        if ends <= starts:
            raise RequestValidationError(f"{field_name}.ends must be after starts")
        rain = _number(raw.get("rain_probability", 0), f"{field_name}.rain_probability", minimum=0)
        if rain > 1:
            raise RequestValidationError(f"{field_name}.rain_probability must be between 0 and 1")
        temperature_raw = raw.get("temperature_c")
        return cls(
            day_index=day_index,
            starts=starts,
            ends=ends,
            rain_probability=rain,
            temperature_c=(
                _number(temperature_raw, f"{field_name}.temperature_c")
                if temperature_raw is not None
                else None
            ),
        )


@dataclass(frozen=True, slots=True)
class MealPolicy:
    enabled: bool = False
    count_per_day: int = 1
    duration_min: int = 60
    lunch_start_hour: int = 12
    lunch_end_hour: int = 15
    dinner_start_hour: int = 19
    dinner_end_hour: int = 22


@dataclass(frozen=True, slots=True)
class SolverOptions:
    age: int | None = None
    pacing: str | None = None
    departure_mode: str | None = None
    limited_mobility: bool = False
    meal_policy: MealPolicy = field(default_factory=MealPolicy)
    weather: tuple[WeatherBucket, ...] = ()
    scenic_edges: frozenset[tuple[str, str]] = frozenset()
    luggage_duration_min: int = 0
    forced_access_buffer_min: int = 60
    max_day_duration_min: int = 12 * 60

    @classmethod
    def from_json(cls, value: Any | None) -> "SolverOptions":
        if value is None:
            return cls()
        raw = _mapping(value, "options")
        meals_raw = _mapping(raw.get("meals", {}), "options.meals")
        meal_policy = MealPolicy(
            enabled=bool(meals_raw.get("enabled", False)),
            count_per_day=max(0, min(2, int(meals_raw.get("count_per_day", 1)))),
            duration_min=max(15, min(180, int(meals_raw.get("duration_min", 60)))),
            lunch_start_hour=max(0, min(23, int(meals_raw.get("lunch_start_hour", 12)))),
            lunch_end_hour=max(1, min(24, int(meals_raw.get("lunch_end_hour", 15)))),
            dinner_start_hour=max(0, min(23, int(meals_raw.get("dinner_start_hour", 19)))),
            dinner_end_hour=max(1, min(24, int(meals_raw.get("dinner_end_hour", 22)))),
        )
        scenic_raw = _sequence(raw.get("scenic_edges", []), "options.scenic_edges")
        scenic_edges: set[tuple[str, str]] = set()
        for index, edge in enumerate(scenic_raw):
            pair = _sequence(edge, f"options.scenic_edges[{index}]")
            if len(pair) != 2 or not all(isinstance(item, str) for item in pair):
                raise RequestValidationError(f"options.scenic_edges[{index}] must contain two node keys")
            scenic_edges.add((pair[0], pair[1]))
        age_raw = raw.get("age")
        age = int(age_raw) if age_raw is not None else None
        if age is not None and not 0 <= age <= 120:
            raise RequestValidationError("options.age must be between 0 and 120")
        return cls(
            age=age,
            pacing=str(raw["pacing"]) if raw.get("pacing") is not None else None,
            departure_mode=(
                str(raw["departure_mode"]) if raw.get("departure_mode") is not None else None
            ),
            limited_mobility=bool(raw.get("limited_mobility", False)),
            meal_policy=meal_policy,
            weather=tuple(
                WeatherBucket.from_json(bucket, index)
                for index, bucket in enumerate(_sequence(raw.get("weather", []), "options.weather"))
            ),
            scenic_edges=frozenset(scenic_edges),
            luggage_duration_min=max(0, min(240, int(raw.get("luggage_duration_min", 0)))),
            forced_access_buffer_min=max(30, min(240, int(raw.get("forced_access_buffer_min", 60)))),
            max_day_duration_min=max(60, min(24 * 60, int(raw.get("max_day_duration_min", 12 * 60)))),
        )


@dataclass(frozen=True, slots=True)
class SolverRequest:
    trip_city_id: str
    days: tuple[Day, ...]
    candidates: tuple[Candidate, ...]
    travel_matrix: tuple[TravelEdge, ...]
    default_mode: str
    time_budget_ms: int
    options: SolverOptions

    @classmethod
    def from_json(cls, value: Any) -> "SolverRequest":
        raw = _mapping(value, "request")
        trip_city_id = raw.get("trip_city_id")
        if not isinstance(trip_city_id, str) or not trip_city_id:
            raise RequestValidationError("trip_city_id must be a non-empty string")
        days = tuple(
            Day.from_json(day, index)
            for index, day in enumerate(_sequence(raw.get("days"), "days"))
        )
        if not days:
            raise RequestValidationError("days must not be empty")
        if len({day.day_index for day in days}) != len(days):
            raise RequestValidationError("day_index values must be unique")
        candidates = tuple(
            Candidate.from_json(candidate, index)
            for index, candidate in enumerate(_sequence(raw.get("candidates"), "candidates"))
        )
        if len({candidate.poi_id for candidate in candidates}) != len(candidates):
            raise RequestValidationError("candidate poi_id values must be unique")
        default_mode = raw.get("default_mode")
        if default_mode not in {"walk", "transit", "drive", "bike", "ferry"}:
            raise RequestValidationError("default_mode is invalid")
        budget = raw.get("time_budget_ms")
        if isinstance(budget, bool) or not isinstance(budget, int) or budget <= 0:
            raise RequestValidationError("time_budget_ms must be a positive integer")
        request = cls(
            trip_city_id=trip_city_id,
            days=tuple(sorted(days, key=lambda day: day.day_index)),
            candidates=candidates,
            travel_matrix=tuple(
                TravelEdge.from_json(edge, index)
                for index, edge in enumerate(
                    _sequence(raw.get("travel_matrix"), "travel_matrix")
                )
            ),
            default_mode=default_mode,
            time_budget_ms=min(budget, 30_000),
            options=SolverOptions.from_json(raw.get("options")),
        )
        request._validate_references()
        return request

    def _validate_references(self) -> None:
        valid_days = {day.day_index for day in self.days}
        for candidate in self.candidates:
            for window in (*candidate.windows, *candidate.best_time_windows):
                if window.day_index not in valid_days:
                    raise RequestValidationError(
                        f"candidate {candidate.poi_id} references unknown day {window.day_index}"
                    )

    @property
    def epoch(self) -> datetime:
        first = min(day.start_time for day in self.days)
        return first.replace(second=0, microsecond=0)

    def minute(self, value: datetime) -> int:
        return int((value - self.epoch).total_seconds() // 60)

    def datetime_at(self, minute: int) -> datetime:
        return self.epoch + timedelta(minutes=minute)


def candidate_coordinates(request: SolverRequest) -> dict[str, Coordinate]:
    coordinates = {candidate.node: candidate.coord for candidate in request.candidates}
    for day in request.days:
        coordinates[day.start.node] = day.start.coord
        if day.end_anchor is not None:
            coordinates[day.end_anchor.node] = day.end_anchor.coord
    return coordinates


def ensure_unique_nodes(request: SolverRequest) -> None:
    """Reject ambiguous matrix keys while allowing a shared hotel anchor."""

    candidate_nodes = [candidate.node for candidate in request.candidates]
    if len(candidate_nodes) != len(set(candidate_nodes)):
        raise RequestValidationError("candidate node keys must be unique")


def iter_weather_for_day(options: SolverOptions, day_index: int) -> Iterable[WeatherBucket]:
    return (bucket for bucket in options.weather if bucket.day_index == day_index)

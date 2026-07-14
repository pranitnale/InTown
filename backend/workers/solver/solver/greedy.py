"""Deterministic cheapest-insertion solver and offline reference implementation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Iterable, Sequence

from .matrix import Leg, TravelMatrix
from .models import Day, SolverRequest, format_datetime
from .policy import effective_deadline, pacing_preset
from .variants import VisitVariant, expand_variants


@dataclass(frozen=True, slots=True)
class MaterializedVisit:
    variant: VisitVariant
    arrive: datetime
    depart: datetime
    leg: Leg


@dataclass(frozen=True, slots=True)
class RouteAttempt:
    feasible: bool
    visits: tuple[MaterializedVisit, ...]
    walking_m: float
    ends_at: datetime
    travel_seconds: int


def _materialize(
    request: SolverRequest,
    matrix: TravelMatrix,
    day: Day,
    route: Sequence[VisitVariant],
) -> RouteAttempt:
    now = day.start_time
    node = day.start.node
    walking = 0.0
    travel_seconds = 0
    visits: list[MaterializedVisit] = []
    for variant in route:
        leg = matrix.leg(node, variant.node)
        travel_seconds += leg.seconds
        if leg.mode == "walk":
            walking += leg.meters
        arrive = max(now + timedelta(seconds=leg.seconds), variant.opens)
        if arrive > variant.latest_start:
            return RouteAttempt(False, (), walking, arrive, travel_seconds)
        depart = arrive + timedelta(minutes=variant.duration_min)
        visits.append(MaterializedVisit(variant, arrive, depart, leg))
        now, node = depart, variant.node

    if day.end_anchor is not None:
        end_leg = matrix.leg(node, day.end_anchor.node)
        travel_seconds += end_leg.seconds
        if end_leg.mode == "walk":
            walking += end_leg.meters
        now += timedelta(seconds=end_leg.seconds)
    deadline = effective_deadline(day.end_deadline, request.options)
    if deadline is not None and now > deadline:
        return RouteAttempt(False, (), walking, now, travel_seconds)
    if day.walking_budget_m is not None and walking > day.walking_budget_m:
        return RouteAttempt(False, (), walking, now, travel_seconds)
    return RouteAttempt(True, tuple(visits), walking, now, travel_seconds)


def _best_insertion(
    request: SolverRequest,
    matrix: TravelMatrix,
    routes: dict[int, list[VisitVariant]],
    variants: Iterable[VisitVariant],
) -> tuple[int, int, VisitVariant, RouteAttempt] | None:
    day_by_index = {day.day_index: day for day in request.days}
    best: tuple[tuple[int, int, int, int, str], int, int, VisitVariant, RouteAttempt] | None = None
    for variant in variants:
        route = routes[variant.day_index]
        day = day_by_index[variant.day_index]
        baseline = _materialize(request, matrix, day, route)
        for position in range(len(route) + 1):
            proposed = [*route[:position], variant, *route[position:]]
            attempt = _materialize(request, matrix, day, proposed)
            if not attempt.feasible:
                continue
            added_travel = attempt.travel_seconds - baseline.travel_seconds
            wait_cost = int(sum((visit.arrive - visit.variant.opens).total_seconds() for visit in attempt.visits))
            score = (-variant.prize, added_travel, wait_cost, position, variant.key)
            if best is None or score < best[0]:
                best = (score, variant.day_index, position, variant, attempt)
    if best is None:
        return None
    return best[1], best[2], best[3], best[4]


def _two_opt(request: SolverRequest, matrix: TravelMatrix, day: Day, route: list[VisitVariant]) -> list[VisitVariant]:
    if len(route) < 4:
        return route
    current = route
    current_attempt = _materialize(request, matrix, day, current)
    improved = True
    while improved:
        improved = False
        for left in range(0, len(current) - 2):
            for right in range(left + 2, len(current) + 1):
                candidate = [*current[:left], *reversed(current[left:right]), *current[right:]]
                attempt = _materialize(request, matrix, day, candidate)
                if attempt.feasible and attempt.travel_seconds < current_attempt.travel_seconds:
                    current, current_attempt, improved = candidate, attempt, True
                    break
            if improved:
                break
    return current


def _meal_stops(request: SolverRequest, day: Day, visits: Sequence[MaterializedVisit]) -> list[dict[str, Any]]:
    policy = request.options.meal_policy
    if not policy.enabled or policy.count_per_day <= 0:
        return []
    day_date = day.start_time.astimezone().date()
    windows = [
        (
            datetime.combine(day_date, datetime.min.time(), tzinfo=day.start_time.tzinfo)
            + timedelta(hours=policy.lunch_start_hour),
            datetime.combine(day_date, datetime.min.time(), tzinfo=day.start_time.tzinfo)
            + timedelta(hours=policy.lunch_end_hour),
        )
    ]
    if policy.count_per_day == 2:
        windows.append(
            (
                datetime.combine(day_date, datetime.min.time(), tzinfo=day.start_time.tzinfo)
                + timedelta(hours=policy.dinner_start_hour),
                datetime.combine(day_date, datetime.min.time(), tzinfo=day.start_time.tzinfo)
                + timedelta(hours=policy.dinner_end_hour),
            )
        )
    occupied = [(visit.arrive, visit.depart) for visit in visits]
    meals: list[dict[str, Any]] = []
    for opens, closes in windows:
        starts = max(opens, day.start_time)
        for arrive, depart in occupied:
            if starts < depart and arrive < starts + timedelta(minutes=policy.duration_min):
                starts = depart
        if starts + timedelta(minutes=policy.duration_min) <= closes:
            meals.append(
                {
                    "poi_id": None,
                    "stop_kind": "meal",
                    "arrive": format_datetime(starts),
                    "depart": format_datetime(starts + timedelta(minutes=policy.duration_min)),
                    "travel_from_prev": None,
                }
            )
    return meals


def solve_greedy(request: SolverRequest) -> dict[str, Any]:
    matrix = TravelMatrix(request)
    variants_by_poi = expand_variants(request)
    routes: dict[int, list[VisitVariant]] = {day.day_index: [] for day in request.days}
    unscheduled: list[str] = []

    mandatory = sorted(
        (candidate for candidate in request.candidates if candidate.must_do),
        key=lambda candidate: (-candidate.priority, candidate.poi_id),
    )
    optional = sorted(
        (candidate for candidate in request.candidates if not candidate.must_do),
        key=lambda candidate: (-max((item.prize for item in variants_by_poi[candidate.poi_id]), default=0), candidate.poi_id),
    )
    for candidate in [*mandatory, *optional]:
        insertion = _best_insertion(
            request, matrix, routes, variants_by_poi[candidate.poi_id]
        )
        if insertion is None:
            if candidate.must_do:
                return {
                    "trip_city_id": request.trip_city_id,
                    "status": "infeasible",
                    "days": [],
                    "unscheduled_poi_ids": [],
                    "objective_value": None,
                    "solve_ms": 0,
                    "explanation": f"Must-do {candidate.poi_id} cannot fit with the other hard constraints.",
                }
            unscheduled.append(candidate.poi_id)
            continue
        day_index, position, variant, _ = insertion
        routes[day_index].insert(position, variant)

    day_by_index = {day.day_index: day for day in request.days}
    for day_index, route in routes.items():
        routes[day_index] = _two_opt(request, matrix, day_by_index[day_index], route)

    response_days: list[dict[str, Any]] = []
    objective = 0
    for day in request.days:
        attempt = _materialize(request, matrix, day, routes[day.day_index])
        stops: list[dict[str, Any]] = []
        for visit in attempt.visits:
            objective += visit.variant.prize
            stops.append(
                {
                    "poi_id": visit.variant.candidate.poi_id,
                    "stop_kind": "poi",
                    "arrive": format_datetime(visit.arrive),
                    "depart": format_datetime(visit.depart),
                    "travel_from_prev": {
                        "mode": visit.leg.mode,
                        "seconds": visit.leg.seconds,
                        "meters": round(visit.leg.meters, 3),
                    }
                    if stops
                    else None,
                }
            )
        stops.extend(_meal_stops(request, day, attempt.visits))
        stops.sort(key=lambda stop: (stop["arrive"], stop["stop_kind"]))
        for order, stop in enumerate(stops):
            stop["day_index"] = day.day_index
            stop["ord"] = order
        ends_at = max(
            (stop["depart"] for stop in stops),
            default=None,
        )
        response_days.append(
            {
                "day_index": day.day_index,
                "stops": stops,
                "walking_m": round(attempt.walking_m, 3),
                "ends_at": ends_at or (format_datetime(attempt.ends_at) if routes[day.day_index] else None),
            }
        )

    # Pacing is a soft value adjustment only; it never removes an otherwise
    # feasible stop. Returning it in diagnostics is intentionally avoided so the
    # response remains valid against the frozen contract.
    pacing_preset(request.options)
    return {
        "trip_city_id": request.trip_city_id,
        "status": "feasible",
        "days": response_days,
        "unscheduled_poi_ids": sorted(unscheduled),
        "objective_value": float(objective),
        "solve_ms": 0,
    }

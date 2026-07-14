"""Independent pre-solve and emitted-schedule feasibility checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Mapping, Sequence

from .matrix import TravelMatrix
from .models import SolverRequest, parse_datetime
from .policy import effective_deadline
from .variants import VisitVariant, expand_variants


@dataclass(frozen=True, slots=True)
class FeasibilityIssue:
    code: str
    message: str
    poi_id: str | None = None
    day_index: int | None = None


def precheck(request: SolverRequest) -> list[FeasibilityIssue]:
    variants = expand_variants(request)
    issues: list[FeasibilityIssue] = []
    for candidate in request.candidates:
        if not candidate.must_do:
            continue
        candidate_variants = variants[candidate.poi_id]
        if not candidate_variants:
            if candidate.out_of_town and candidate.access_status not in {
                "routable",
                "corroborated",
                "verified",
            } and not candidate.user_forced:
                message = (
                    f"{candidate.poi_id} is a must-do, but its out-of-town access is unverified. "
                    "Confirm the transfer or force it with a conservative buffer."
                )
                code = "access_unverified"
            elif candidate.windows:
                message = (
                    f"{candidate.poi_id} is a must-do but is closed, or lacks enough open time, "
                    "on every trip day."
                )
                code = "must_do_closed"
            else:
                message = f"{candidate.poi_id} cannot fit inside any available day."
                code = "must_do_unavailable"
            issues.append(FeasibilityIssue(code, message, candidate.poi_id))
    return issues


def _stop_sequence(value: Any, field_name: str) -> Sequence[Any]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes, bytearray)):
        raise ValueError(f"{field_name} must be an array")
    return value


def check_response(request: SolverRequest, response: Mapping[str, Any]) -> list[FeasibilityIssue]:
    """Audit a materialized response without sharing optimizer state."""

    matrix = TravelMatrix(request)
    candidate_by_id = {candidate.poi_id: candidate for candidate in request.candidates}
    day_by_index = {day.day_index: day for day in request.days}
    seen: set[str] = set()
    issues: list[FeasibilityIssue] = []

    for day_payload in _stop_sequence(response.get("days", []), "response.days"):
        if not isinstance(day_payload, Mapping):
            issues.append(FeasibilityIssue("invalid_day", "A response day is not an object."))
            continue
        day_index = day_payload.get("day_index")
        if not isinstance(day_index, int) or day_index not in day_by_index:
            issues.append(FeasibilityIssue("unknown_day", f"Unknown response day {day_index!r}."))
            continue
        day = day_by_index[day_index]
        previous_depart = day.start_time
        previous_node = day.start.node
        walking = 0.0
        last_ord = -1
        for stop in _stop_sequence(day_payload.get("stops", []), "response.days[].stops"):
            if not isinstance(stop, Mapping):
                issues.append(FeasibilityIssue("invalid_stop", "A response stop is not an object.", day_index=day_index))
                continue
            order = stop.get("ord")
            if not isinstance(order, int) or order != last_ord + 1:
                issues.append(FeasibilityIssue("invalid_order", "Stop ord values must be contiguous.", day_index=day_index))
            last_ord = order if isinstance(order, int) else last_ord
            arrive = parse_datetime(stop.get("arrive"), "response.stop.arrive")
            depart = parse_datetime(stop.get("depart"), "response.stop.depart")
            if depart < arrive:
                issues.append(FeasibilityIssue("negative_duration", "A stop departs before arrival.", day_index=day_index))
            if arrive < previous_depart:
                issues.append(FeasibilityIssue("overlap", "Stops overlap or move backwards in time.", day_index=day_index))
            poi_id = stop.get("poi_id")
            if poi_id is not None:
                candidate = candidate_by_id.get(str(poi_id))
                if candidate is None:
                    issues.append(FeasibilityIssue("unknown_poi", f"Unknown scheduled POI {poi_id}.", str(poi_id), day_index))
                else:
                    if candidate.poi_id in seen:
                        issues.append(FeasibilityIssue("duplicate_poi", f"{candidate.poi_id} is scheduled more than once.", candidate.poi_id, day_index))
                    seen.add(candidate.poi_id)
                    duration = int((depart - arrive).total_seconds() // 60)
                    if duration < candidate.duration_min:
                        issues.append(FeasibilityIssue("short_visit", f"{candidate.poi_id} is shorter than its required dwell.", candidate.poi_id, day_index))
                    windows = candidate.windows_for_day(day_index)
                    if candidate.windows and not any(window.opens <= arrive and depart <= window.closes for window in windows):
                        issues.append(FeasibilityIssue("outside_hours", f"{candidate.poi_id} is scheduled outside opening hours.", candidate.poi_id, day_index))
                    leg = matrix.leg(previous_node, candidate.node)
                    earliest = previous_depart + timedelta(seconds=leg.seconds)
                    if arrive < earliest:
                        issues.append(FeasibilityIssue("travel_overlap", f"{candidate.poi_id} starts before travel can finish.", candidate.poi_id, day_index))
                    if leg.mode == "walk":
                        walking += leg.meters
                    previous_node = candidate.node
            previous_depart = depart

        deadline = effective_deadline(day.end_deadline, request.options)
        if day.end_anchor is not None:
            leg = matrix.leg(previous_node, day.end_anchor.node)
            if leg.mode == "walk":
                walking += leg.meters
            day_end = previous_depart + timedelta(seconds=leg.seconds)
        else:
            day_end = previous_depart
        if deadline is not None and day_end > deadline:
            issues.append(FeasibilityIssue("missed_deadline", "The day misses its buffered departure deadline.", day_index=day_index))
        if day.walking_budget_m is not None and walking > day.walking_budget_m + 1:
            issues.append(FeasibilityIssue("walking_budget", "The day exceeds its walking budget.", day_index=day_index))

    for candidate in request.candidates:
        if candidate.must_do and candidate.poi_id not in seen:
            issues.append(FeasibilityIssue("missing_must_do", f"Must-do {candidate.poi_id} was not scheduled.", candidate.poi_id))
    return issues


def explain_issues(issues: Sequence[FeasibilityIssue]) -> str:
    return " ".join(issue.message for issue in issues)


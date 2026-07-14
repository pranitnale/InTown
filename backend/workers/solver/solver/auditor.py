"""CP-SAT-backed schedule auditor for CI and golden-city evaluation."""

from __future__ import annotations

from typing import Any, Mapping

from .feasibility import FeasibilityIssue, check_response
from .models import SolverRequest, parse_datetime

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover
    cp_model = None  # type: ignore[assignment]


def cp_sat_audit(request: SolverRequest, response: Mapping[str, Any]) -> list[FeasibilityIssue]:
    """Audit fixed emitted intervals with an implementation independent of routing.

    The semantic checker validates travel, hours, deadlines, must-dos and walking.
    CP-SAT separately proves that the emitted intervals do not overlap. Keeping
    both gates catches accidental coupling to RoutingModel assumptions.
    """

    issues = check_response(request, response)
    if cp_model is None:
        return issues
    model = cp_model.CpModel()
    epoch = request.epoch
    for day_payload in response.get("days", []):
        intervals = []
        for index, stop in enumerate(day_payload.get("stops", [])):
            arrive = parse_datetime(stop["arrive"], "stop.arrive")
            depart = parse_datetime(stop["depart"], "stop.depart")
            start = int((arrive - epoch).total_seconds() // 60)
            duration = max(0, int((depart - arrive).total_seconds() // 60))
            start_var = model.NewIntVar(start, start, f"start_{day_payload['day_index']}_{index}")
            end_var = model.NewIntVar(start + duration, start + duration, f"end_{day_payload['day_index']}_{index}")
            intervals.append(model.NewIntervalVar(start_var, duration, end_var, f"visit_{day_payload['day_index']}_{index}"))
        if intervals:
            model.AddNoOverlap(intervals)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 1.0
    solver.parameters.num_search_workers = 1
    result = solver.Solve(model)
    if result not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
        issues.append(FeasibilityIssue("cp_sat_overlap", "CP-SAT could not prove the emitted intervals feasible."))
    return issues

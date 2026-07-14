"""Google OR-Tools TOPTW implementation.

Each calendar day is a vehicle with its own start/end. POIs are expanded into
day/time clones, then constrained so at most one clone is active. Must-dos use
an equality constraint and therefore can never be silently paid away as a
disjunction penalty.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from math import ceil
from time import perf_counter
from typing import Any, Mapping, Sequence

from .feasibility import check_response, explain_issues, precheck
from .matrix import TravelMatrix
from .models import SolverRequest, format_datetime
from .policy import effective_deadline
from .variants import VisitVariant, expand_variants

try:  # Kept import-safe so the offline fallback works without the heavy wheel.
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2
except ImportError:  # pragma: no cover - exercised in dependency-free smoke tests.
    pywrapcp = None  # type: ignore[assignment]
    routing_enums_pb2 = None  # type: ignore[assignment]


@dataclass(frozen=True, slots=True)
class NodeSpec:
    matrix_node: str
    day_index: int
    kind: str
    variant: VisitVariant | None = None


def available() -> bool:
    return pywrapcp is not None and routing_enums_pb2 is not None


def _build_nodes(request: SolverRequest) -> tuple[list[NodeSpec], list[int], list[int], dict[str, list[int]]]:
    nodes: list[NodeSpec] = []
    starts: list[int] = []
    ends: list[int] = []
    for day in request.days:
        starts.append(len(nodes))
        nodes.append(NodeSpec(day.start.node, day.day_index, "start"))
    for day in request.days:
        ends.append(len(nodes))
        nodes.append(
            NodeSpec(
                day.end_anchor.node if day.end_anchor is not None else day.start.node,
                day.day_index,
                "end",
            )
        )

    clone_nodes: dict[str, list[int]] = {}
    for candidate in request.candidates:
        clone_nodes[candidate.poi_id] = []
        for variant in expand_variants(request)[candidate.poi_id]:
            clone_nodes[candidate.poi_id].append(len(nodes))
            nodes.append(NodeSpec(candidate.node, variant.day_index, "poi", variant))
    return nodes, starts, ends, clone_nodes


def solve_ortools(
    request: SolverRequest,
    *,
    warm_routes: Mapping[int, Sequence[str]] | None = None,
    budget_ms: int | None = None,
) -> dict[str, Any]:
    if not available():
        raise RuntimeError("OR-Tools is not installed")
    started = perf_counter()
    precheck_issues = precheck(request)
    if precheck_issues:
        return {
            "trip_city_id": request.trip_city_id,
            "status": "infeasible",
            "days": [],
            "unscheduled_poi_ids": [],
            "objective_value": None,
            "solve_ms": int((perf_counter() - started) * 1000),
            "explanation": explain_issues(precheck_issues),
        }

    nodes, starts, ends, clone_nodes = _build_nodes(request)
    manager = pywrapcp.RoutingIndexManager(len(nodes), len(request.days), starts, ends)
    routing = pywrapcp.RoutingModel(manager)
    matrix = TravelMatrix(request)
    day_vehicle = {day.day_index: index for index, day in enumerate(request.days)}

    def time_transit(from_index: int, to_index: int) -> int:
        from_node = nodes[manager.IndexToNode(from_index)]
        to_node = nodes[manager.IndexToNode(to_index)]
        dwell = from_node.variant.duration_min if from_node.variant is not None else 0
        leg = matrix.leg(from_node.matrix_node, to_node.matrix_node)
        return dwell + ceil(leg.seconds / 60)

    time_callback = routing.RegisterTransitCallback(time_transit)
    routing.SetArcCostEvaluatorOfAllVehicles(time_callback)

    maximum_minute = max(
        request.minute(
            effective_deadline(day.end_deadline, request.options)
            or (day.start_time + timedelta(minutes=request.options.max_day_duration_min))
        )
        for day in request.days
    )
    routing.AddDimension(time_callback, 24 * 60, max(1, maximum_minute + 24 * 60), False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")

    for vehicle, day in enumerate(request.days):
        start_minute = request.minute(day.start_time)
        end_value = effective_deadline(day.end_deadline, request.options) or (
            day.start_time + timedelta(minutes=request.options.max_day_duration_min)
        )
        time_dimension.CumulVar(routing.Start(vehicle)).SetRange(start_minute, start_minute)
        time_dimension.CumulVar(routing.End(vehicle)).SetRange(start_minute, request.minute(end_value))

    for node_index, spec in enumerate(nodes):
        if spec.variant is None:
            continue
        routing_index = manager.NodeToIndex(node_index)
        variant = spec.variant
        time_dimension.CumulVar(routing_index).SetRange(
            request.minute(variant.opens), request.minute(variant.latest_start)
        )
        routing.SetAllowedVehiclesForIndex([day_vehicle[variant.day_index]], routing_index)
        # Singleton disjunctions make each clone prize-bearing. A separate sum
        # constraint below prevents selecting multiple time/day clones.
        routing.AddDisjunction([routing_index], max(1, variant.prize))

    for candidate in request.candidates:
        active_vars = [
            routing.ActiveVar(manager.NodeToIndex(node_index))
            for node_index in clone_nodes[candidate.poi_id]
        ]
        if not active_vars:
            if candidate.must_do:
                return {
                    "trip_city_id": request.trip_city_id,
                    "status": "infeasible",
                    "days": [],
                    "unscheduled_poi_ids": [],
                    "objective_value": None,
                    "solve_ms": int((perf_counter() - started) * 1000),
                    "explanation": f"Must-do {candidate.poi_id} has no schedulable time window.",
                }
            continue
        active_sum = routing.solver().Sum(active_vars)
        routing.solver().Add(active_sum == 1 if candidate.must_do else active_sum <= 1)

    def walking_transit(from_index: int, to_index: int) -> int:
        left = nodes[manager.IndexToNode(from_index)]
        right = nodes[manager.IndexToNode(to_index)]
        return int(round(matrix.walking_meters(left.matrix_node, right.matrix_node)))

    walking_callback = routing.RegisterTransitCallback(walking_transit)
    capacities = [
        int(round(day.walking_budget_m)) if day.walking_budget_m is not None else 100_000_000
        for day in request.days
    ]
    routing.AddDimensionWithVehicleCapacity(walking_callback, 0, capacities, True, "Walk")
    walk_dimension = routing.GetDimensionOrDie("Walk")

    parameters = pywrapcp.DefaultRoutingSearchParameters()
    parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    effective_budget = max(50, min(budget_ms or request.time_budget_ms, 30_000))
    parameters.time_limit.seconds = effective_budget // 1000
    parameters.time_limit.nanos = (effective_budget % 1000) * 1_000_000
    parameters.log_search = False

    assignment = None
    if warm_routes:
        route_nodes: list[list[int]] = []
        for day in request.days:
            selected: list[int] = []
            for poi_id in warm_routes.get(day.day_index, ()):  # previous order, best valid clone for this day
                for node_index in clone_nodes.get(poi_id, []):
                    spec = nodes[node_index]
                    if spec.day_index == day.day_index:
                        selected.append(node_index)
                        break
            route_nodes.append(selected)
        initial = routing.ReadAssignmentFromRoutes(route_nodes, True)
        if initial is not None:
            assignment = routing.SolveFromAssignmentWithParameters(initial, parameters)
    if assignment is None:
        assignment = routing.SolveWithParameters(parameters)

    solve_ms = int((perf_counter() - started) * 1000)
    if assignment is None:
        return {
            "trip_city_id": request.trip_city_id,
            "status": "infeasible" if solve_ms < effective_budget else "timeout",
            "days": [],
            "unscheduled_poi_ids": [],
            "objective_value": None,
            "solve_ms": solve_ms,
            "explanation": "No route satisfies every must-do, opening window, walking budget, and buffered deadline.",
        }

    selected_pois: set[str] = set()
    response_days: list[dict[str, Any]] = []
    objective_value = 0.0
    for vehicle, day in enumerate(request.days):
        index = routing.Start(vehicle)
        stops: list[dict[str, Any]] = []
        previous_spec = nodes[manager.IndexToNode(index)]
        while not routing.IsEnd(index):
            next_index = assignment.Value(routing.NextVar(index))
            if routing.IsEnd(next_index):
                index = next_index
                break
            spec = nodes[manager.IndexToNode(next_index)]
            if spec.variant is not None:
                arrival_minute = assignment.Value(time_dimension.CumulVar(next_index))
                arrival = request.datetime_at(arrival_minute)
                depart = arrival + timedelta(minutes=spec.variant.duration_min)
                leg = matrix.leg(previous_spec.matrix_node, spec.matrix_node)
                candidate = spec.variant.candidate
                selected_pois.add(candidate.poi_id)
                objective_value += candidate.priority
                stops.append(
                    {
                        "poi_id": candidate.poi_id,
                        "stop_kind": "poi",
                        "day_index": day.day_index,
                        "ord": len(stops),
                        "arrive": format_datetime(arrival),
                        "depart": format_datetime(depart),
                        "travel_from_prev": (
                            None
                            if not stops
                            else {
                                "mode": leg.mode,
                                "seconds": leg.seconds,
                                "meters": round(leg.meters, 3),
                            }
                        ),
                    }
                )
            previous_spec = spec
            index = next_index
        walking_m = float(assignment.Value(walk_dimension.CumulVar(routing.End(vehicle))))
        response_days.append(
            {
                "day_index": day.day_index,
                "stops": stops,
                "walking_m": walking_m,
                "ends_at": stops[-1]["depart"] if stops else None,
            }
        )

    unscheduled = sorted(
        candidate.poi_id
        for candidate in request.candidates
        if not candidate.must_do and candidate.poi_id not in selected_pois
    )
    response: dict[str, Any] = {
        "trip_city_id": request.trip_city_id,
        "status": "feasible",
        "days": response_days,
        "unscheduled_poi_ids": unscheduled,
        "objective_value": objective_value,
        "solve_ms": solve_ms,
    }
    audit_issues = check_response(request, response)
    if audit_issues:
        # Never publish an optimizer response that fails the independent gate.
        return {
            "trip_city_id": request.trip_city_id,
            "status": "infeasible",
            "days": [],
            "unscheduled_poi_ids": [],
            "objective_value": None,
            "solve_ms": solve_ms,
            "explanation": f"Independent feasibility gate rejected the route: {explain_issues(audit_issues)}",
        }
    return response


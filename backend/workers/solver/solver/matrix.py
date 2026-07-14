"""Travel-matrix access with bounded, conservative missing-edge fallback."""

from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

from .models import Coordinate, SolverRequest, TravelEdge, candidate_coordinates


@dataclass(frozen=True, slots=True)
class Leg:
    mode: str
    seconds: int
    meters: float


_SPEED_MPS = {
    "walk": 1.15,
    "bike": 3.3,
    "drive": 5.5,
    "transit": 4.2,
    "ferry": 4.0,
}


def haversine_meters(left: Coordinate, right: Coordinate) -> float:
    radius = 6_371_000.0
    lat1, lat2 = radians(left.lat), radians(right.lat)
    delta_lat = radians(right.lat - left.lat)
    delta_lng = radians(right.lng - left.lng)
    a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
    return 2 * radius * asin(sqrt(a))


class TravelMatrix:
    def __init__(self, request: SolverRequest) -> None:
        self._edges: dict[tuple[str, str], TravelEdge] = {
            (edge.from_node, edge.to_node): edge for edge in request.travel_matrix
        }
        self._coordinates = candidate_coordinates(request)
        self._default_mode = request.default_mode

    def leg(self, from_node: str, to_node: str) -> Leg:
        if from_node == to_node:
            return Leg(self._default_mode, 0, 0.0)
        edge = self._edges.get((from_node, to_node))
        if edge is not None:
            return Leg(edge.mode, edge.seconds, edge.meters)

        # The API normally supplies a complete OSRM matrix.  A bounded fallback
        # keeps fixture/offline solves useful while deliberately overestimating
        # straight-line distance (x1.35) and using slow effective speeds.
        left, right = self._coordinates.get(from_node), self._coordinates.get(to_node)
        if left is None or right is None:
            return Leg(self._default_mode, 6 * 60 * 60, 100_000.0)
        meters = haversine_meters(left, right) * 1.35
        seconds = int(round(meters / _SPEED_MPS[self._default_mode]))
        return Leg(self._default_mode, max(1, seconds), meters)

    def walking_meters(self, from_node: str, to_node: str) -> float:
        leg = self.leg(from_node, to_node)
        return leg.meters if leg.mode == "walk" else 0.0

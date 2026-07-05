"""Golden-fixture contract test — Python side (P00 AC #5).

Every one of the six golden-fixture families in `contracts/fixtures/` is loaded
and validated against the corresponding *generated* pydantic model in
`intown_contracts`. This is the honesty check that keeps the mock data in
lockstep with the frozen contract on the Python side, exactly mirroring the
TypeScript `contracts/tests/fixtures.test.ts`.

All six families are enumerated explicitly, so a missing / renamed fixture file
or a drifted model fails loudly rather than silently skipping.
"""

import json
from pathlib import Path

from pydantic import TypeAdapter

from intown_contracts.Consent import Consent
from intown_contracts.Fact import Fact
from intown_contracts.PlanRevision import PlanRevision
from intown_contracts.Poi import Poi
from intown_contracts.PoiGeoObservation import PoiGeoObservation
from intown_contracts.ResearchStreamMessage import ResearchStreamMessage
from intown_contracts.SolverRequest import SolverRequest
from intown_contracts.SolverResponse import SolverResponse
from intown_contracts.Stop import Stop
from intown_contracts.TasteProfile import TasteProfile
from intown_contracts.TravelerProfile import TravelerProfile
from intown_contracts.Trip import Trip
from intown_contracts.TripInvite import TripInvite
from intown_contracts.TripMember import TripMember
from intown_contracts.TripPlace import TripPlace
from intown_contracts.User import User

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


def _load(rel: str):
    return json.loads((FIXTURES / rel).read_text(encoding="utf-8"))


# --- family 1: brain-slice (POIs + facts + geo-observations) ------------------


def test_brain_slice_pois():
    pois = TypeAdapter(list[Poi]).validate_python(_load("brain-slice/pois.json"))
    assert len(pois) >= 8
    assert any(p.coord is None for p in pois)
    assert any(p.coord_verified_by == "first_traveler_gps" for p in pois)


def test_brain_slice_facts():
    facts = TypeAdapter(list[Fact]).validate_python(_load("brain-slice/facts.json"))
    assert len(facts) > 0
    assert any(f.entity_kind == "city" for f in facts)


def test_brain_slice_geo_observations():
    obs = TypeAdapter(list[PoiGeoObservation]).validate_python(
        _load("brain-slice/geo-observations.json")
    )
    assert len(obs) > 0
    # §5.5: a ToS-limited (expiring) observation and a durable one both exist.
    assert any(o.expires_at is not None for o in obs)
    assert any(o.expires_at is None for o in obs)


# --- family 2: longlist -------------------------------------------------------


def test_longlist():
    places = TypeAdapter(list[TripPlace]).validate_python(_load("longlist.json"))
    assert len(places) >= 30
    states = {p.state for p in places}
    assert "must_do" in states
    assert "suggested" in states


# --- family 3: solved 3-day plan ----------------------------------------------


def test_plan_3day():
    data = _load("plan-3day.json")
    PlanRevision.model_validate(data["plan_revision"])
    stops = TypeAdapter(list[Stop]).validate_python(data["stops"])
    assert {s.day_index for s in stops} == {0, 1, 2}
    assert any(s.stop_kind == "meal" for s in stops)
    assert any(s.poi_id is None for s in stops)


# --- family 4: profiles + trip + members --------------------------------------


def test_profiles_trip_members():
    data = _load("profiles-trip-members.json")
    TypeAdapter(list[User]).validate_python(data["users"])
    TypeAdapter(list[TravelerProfile]).validate_python(data["traveler_profiles"])
    TypeAdapter(list[TasteProfile]).validate_python(data["taste_profiles"])
    TypeAdapter(list[Consent]).validate_python(data["consents"])
    Trip.model_validate(data["trip"])
    members = TypeAdapter(list[TripMember]).validate_python(data["members"])
    TripInvite.model_validate(data["invite"])
    assert any(m.role == "owner" for m in members)


# --- family 5: SSE research-progress stream -----------------------------------


def test_sse_research_stream():
    stream = TypeAdapter(list[ResearchStreamMessage]).validate_python(
        _load("sse-research-stream.json")
    )
    assert stream[0].root.type == "stage_started"
    assert stream[-1].root.type == "research_completed"
    # §5.5: no coordinate is ever streamed.
    for msg in stream:
        dumped = msg.model_dump()
        assert "lat" not in dumped
        assert "lng" not in dumped
        assert "coord" not in dumped


# --- family 6: solver request/response pair -----------------------------------


def test_solver_request():
    req = SolverRequest.model_validate(_load("solver/request.json"))
    assert any(c.must_do for c in req.candidates)


def test_solver_response():
    res = SolverResponse.model_validate(_load("solver/response.json"))
    assert res.status == "optimal"
    assert len(res.days) > 0

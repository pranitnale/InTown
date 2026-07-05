# solver — itinerary solver (§5.7, §14)

Python 3.12+ service that turns a curated longlist + travel-time matrix +
constraints (hours, pace, meals, must-dos) into a day-by-day schedule using
**OR-Tools ≥9.10** routing, with an independent **CP-SAT** feasibility auditor
(§14 — solver feasibility is a 100% hard gate). **P00 ships only the skeleton.**

## Layout
- `pyproject.toml` — package metadata (`requires-python >=3.12`; declares `ortools>=9.10`).
- `solver/` — the package (`main.py` stub entrypoint).

## Local dev (later phases)
```bash
cd backend/workers/solver
python -m venv .venv && . .venv/bin/activate
pip install -e .[dev]   # pulls ortools>=9.10
python -m solver.main
```

## Notes
- Nothing installs `ortools` in P00; the dependency is declared for later phases.
- The solver validates its request/response against `contracts/python` and the
  golden `contracts/fixtures` solver request/response pairs.

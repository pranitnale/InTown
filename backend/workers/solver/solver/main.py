"""Solver worker entrypoint (stub).

P00 ships only the package skeleton. The OR-Tools (>=9.10) routing model, the
independent CP-SAT feasibility auditor (§14), and the solver request/response
contract (validated against `contracts/python` + `contracts/fixtures`) arrive in
a later phase.
"""

from __future__ import annotations


def main() -> None:
    """Placeholder entrypoint; consumes solve jobs from the Postgres queue (P11) later."""
    print("intown-solver: skeleton — OR-Tools model not wired yet")


if __name__ == "__main__":
    main()

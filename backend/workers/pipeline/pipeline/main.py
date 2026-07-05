"""Pipeline worker entrypoint (stub).

P00 ships only the package skeleton. The real City Brain build stages (Overpass
POI sweep, research, geo-resolution cascade §5.5, enrichment) arrive in later
phases. The LLM never emits coordinates — coordinate grounding is a separate,
provenance-tracked stage writing only to `poi_geo_observations`.
"""

from __future__ import annotations


def main() -> None:
    """Placeholder entrypoint; wired to the Postgres job queue (§12, P11) later."""
    print("intown-pipeline: skeleton — no stages wired yet")


if __name__ == "__main__":
    main()

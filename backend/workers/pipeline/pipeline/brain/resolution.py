"""SQL seam for the City Brain geo-consensus + entity-resolution layer (§5.5, §5.4).

**This module contains NO logic.** The coordinate law (§5.5, D52/D53) and the
dedup/merge machinery (§5.4, D23/D31) live in the ONE canonical place — the DB
migrations ``backend/db/migrations/0015_brain_grants_geo.sql`` (recompute + purge)
and ``0016_brain_resolution.sql`` (matcher + merge/unmerge). The TypeScript API
(P09) and this Python pipeline (P11) both *call* those SQL functions over their
own DB connection rather than re-deriving anything in application code, so the two
services can never disagree.

Doctrine the SQL enforces (do not re-implement it here):
  * The LLM NEVER emits coordinates. ``pois.coord`` is DERIVED from the
    append-only ``poi_geo_observations`` log and is NULL until grounded.
  * The pipeline's grounding stage writes ONLY ``poi_geo_observations`` rows; the
    AFTER-STATEMENT trigger ``poi_geo_obs_recompute_aist`` recomputes the canonical
    coord + display gate synchronously on insert.
  * ``google_fallback`` observations are never canonical (Google ToS): excluded
    from the centroid/agreement/confidence, and expired via ``expires_at``.

Usage (P09/P11): execute the named function through a DB cursor, e.g.
``cur.execute("SELECT poi_find_by_external_id(%s, %s, %s)", (city, key, value))``.
The Python callables below are intentionally NotImplementedError stubs — they
document the signatures and pin the single source of truth, and are wired to a
real connection in a later phase.
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# The canonical SQL entry points, keyed by function name → (migration, SQL
# signature). This mapping is the seam's contract: the pipeline dispatches these
# by name and must not shadow their behaviour in Python.
# ---------------------------------------------------------------------------
SQL_FUNCTIONS: Final[dict[str, tuple[str, str]]] = {
    "poi_recompute_coord": (
        "0015_brain_grants_geo.sql",
        "poi_recompute_coord(p_poi_id uuid) RETURNS void",
    ),
    "poi_geo_purge_expired": (
        "0015_brain_grants_geo.sql",
        "poi_geo_purge_expired() RETURNS integer",
    ),
    "poi_find_by_external_id": (
        "0016_brain_resolution.sql",
        "poi_find_by_external_id(p_city_id uuid, p_key text, p_value text) RETURNS uuid",
    ),
    "poi_match_candidates": (
        "0016_brain_resolution.sql",
        "poi_match_candidates(p_city_id uuid, p_name text, p_category category, "
        "p_lat double precision, p_lng double precision) "
        "RETURNS TABLE (poi_id uuid, name_sim real, dist_m double precision, score real)",
    ),
    "poi_merge": (
        "0016_brain_resolution.sql",
        "poi_merge(p_kept uuid, p_merged uuid, p_reason text, p_actor text) RETURNS void",
    ),
    "poi_unmerge": (
        "0016_brain_resolution.sql",
        "poi_unmerge(p_merged uuid) RETURNS void",
    ),
}

# Fuzzy-matcher tunables encoded in 0016 (documented here for callers deciding
# whether a candidate clears the bar; the SQL remains authoritative).
NAME_SIMILARITY_FLOOR: Final[float] = 0.45
GEO_AGREEMENT_RADIUS_M: Final[int] = 150

_SEAM_MESSAGE: Final[str] = (
    "City Brain resolution/geo logic is DB-owned (migrations 0015/0016). "
    "Call the SQL function {name} over a DB connection; do not implement it in Python. "
    "See SQL_FUNCTIONS[{name!r}]."
)


def _seam(name: str) -> NotImplementedError:
    return NotImplementedError(_SEAM_MESSAGE.format(name=name))


def poi_recompute_coord(poi_id: str) -> None:
    """Re-derive a POI's canonical coord + display gate (§5.5). SQL: 0015.

    Idempotent; resolves ``poi_id`` to its merge-group head. Not called directly by
    the pipeline in the normal path — the insert trigger runs it — but exposed for
    backfills. Behaviour lives in ``poi_recompute_coord`` (0015).
    """
    raise _seam("poi_recompute_coord")


def poi_geo_purge_expired() -> int:
    """Hard-delete expired observations, recompute affected POIs, return the count.

    The ONE sanctioned deletion path against the append-only observation log
    (SECURITY DEFINER; disables/re-arms the guard). Owner/maintenance only. SQL:
    ``poi_geo_purge_expired`` (0015).
    """
    raise _seam("poi_geo_purge_expired")


def poi_find_by_external_id(city_id: str, key: str, value: str) -> str | None:
    """ID-first resolution: canonical POI in the city carrying ``external_ids[key] ==
    value``, else None. Merged duplicates are excluded. SQL:
    ``poi_find_by_external_id`` (0016).
    """
    raise _seam("poi_find_by_external_id")


def poi_match_candidates(
    city_id: str,
    name: str,
    category: str,
    lat: float | None,
    lng: float | None,
) -> list[tuple[str, float, float | None, float]]:
    """Fuzzy duplicate search: canonical POIs with a compatible category and trigram
    name similarity ≥ 0.45, within 150 m when both coords are known. Returns rows of
    ``(poi_id, name_sim, dist_m, score)`` ordered by score. SQL:
    ``poi_match_candidates`` (0016).
    """
    raise _seam("poi_match_candidates")


def poi_merge(kept: str, merged: str, reason: str, actor: str) -> None:
    """Fold ``merged`` into ``kept``: union source_refs/external_ids (kept wins),
    redirect ``merged.merged_into``, journal a snapshot, recompute the group coord.
    Facts/observations are never moved (append-only). SQL: ``poi_merge`` (0016).
    """
    raise _seam("poi_merge")


def poi_unmerge(merged: str) -> None:
    """Reverse the latest live merge for ``merged``: restore the kept POI's
    snapshotted source_refs/external_ids, clear the redirect, stamp the journal, and
    recompute both coords. SQL: ``poi_unmerge`` (0016).
    """
    raise _seam("poi_unmerge")


__all__ = [
    "SQL_FUNCTIONS",
    "NAME_SIMILARITY_FLOOR",
    "GEO_AGREEMENT_RADIUS_M",
    "poi_recompute_coord",
    "poi_geo_purge_expired",
    "poi_find_by_external_id",
    "poi_match_candidates",
    "poi_merge",
    "poi_unmerge",
]

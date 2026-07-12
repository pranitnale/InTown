"""City Brain SQL seam (§5.4, §5.5).

Thin Python surface over the DB-owned geo-consensus and entity-resolution
functions. No logic lives here — see ``resolution`` and ``README.md``. The SQL in
migrations 0015/0016 is the single source of truth.
"""

from __future__ import annotations

from .resolution import (
    GEO_AGREEMENT_RADIUS_M,
    NAME_SIMILARITY_FLOOR,
    SQL_FUNCTIONS,
    poi_find_by_external_id,
    poi_geo_purge_expired,
    poi_match_candidates,
    poi_merge,
    poi_recompute_coord,
    poi_unmerge,
)

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

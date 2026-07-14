"""Structured open-data ingestion for the City Brain (P09).

The package deliberately keeps network and persistence boundaries injectable:
source parsers can be tested from recorded responses and the orchestrator can be
run without live HTTP or PostgreSQL.
"""

from .models import BBox, BuildRequest, BuildReport, Category
from .orchestrator import StructuredIngestionPipeline

__all__ = [
    "BBox",
    "BuildRequest",
    "BuildReport",
    "Category",
    "StructuredIngestionPipeline",
]

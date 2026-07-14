"""Production wiring for P09; tests inject every boundary instead."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from .commons import CommonsClient
from .geoapify import GeoapifyClient, GeoapifyPlacesClient
from .http import FileResponseCache, HttpxTransport, ResilientJsonClient, validate_wikimedia_user_agent
from .orchestrator import StructuredIngestionPipeline
from .osm import OverpassClient
from .repository import PsycopgCityBrainRepository
from .wikimedia import WikidataClient, WikipediaClient


@dataclass(frozen=True, slots=True)
class RuntimeConfig:
    database_url: str = field(repr=False)
    user_agent: str
    cache_directory: Path
    geoapify_api_key: str | None = field(default=None, repr=False)
    http_concurrency: int = 4
    db_pool_size: int = 4

    def __post_init__(self) -> None:
        if not self.database_url.strip():
            raise ValueError("DATABASE_URL is required")
        validate_wikimedia_user_agent(self.user_agent)
        if not 1 <= self.http_concurrency <= 8:
            raise ValueError("INTOWN_PIPELINE_HTTP_CONCURRENCY must be in [1,8]")
        if not 1 <= self.db_pool_size <= 8:
            raise ValueError("INTOWN_PIPELINE_DB_POOL_SIZE must be in [1,8]")

    @classmethod
    def from_environment(cls) -> "RuntimeConfig":
        try:
            http_concurrency = int(os.environ.get("INTOWN_PIPELINE_HTTP_CONCURRENCY", "4"))
            db_pool_size = int(os.environ.get("INTOWN_PIPELINE_DB_POOL_SIZE", "4"))
        except ValueError as exc:
            raise ValueError("pipeline concurrency settings must be integers") from exc
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            user_agent=os.environ.get("INTOWN_HTTP_USER_AGENT", ""),
            cache_directory=Path(
                os.environ.get("INTOWN_PIPELINE_CACHE_DIR", ".cache/intown-pipeline")
            ),
            geoapify_api_key=os.environ.get("GEOAPIFY_API_KEY") or None,
            http_concurrency=http_concurrency,
            db_pool_size=db_pool_size,
        )


class StructuredIngestionRuntime:
    def __init__(self, config: RuntimeConfig) -> None:
        self.config = config
        self.transport = HttpxTransport(max_connections=config.http_concurrency)
        self.http = ResilientJsonClient(
            self.transport,
            cache=FileResponseCache(config.cache_directory),
            max_concurrency=config.http_concurrency,
            max_retries=2,
        )
        self.repository = PsycopgCityBrainRepository(
            config.database_url, max_pool_size=config.db_pool_size
        )
        self.geoapify = (
            GeoapifyClient(self.http, config.geoapify_api_key, config.user_agent)
            if config.geoapify_api_key
            else None
        )
        self.pipeline = StructuredIngestionPipeline(
            repository=self.repository,
            overpass=OverpassClient(self.http, config.user_agent),
            wikidata=WikidataClient(self.http, config.user_agent),
            wikipedia=WikipediaClient(self.http, config.user_agent),
            commons=CommonsClient(self.http, config.user_agent),
            geoapify_places=(
                GeoapifyPlacesClient(self.http, config.geoapify_api_key, config.user_agent)
                if config.geoapify_api_key
                else None
            ),
        )

    async def __aenter__(self) -> "StructuredIngestionRuntime":
        try:
            await self.repository.open()
        except Exception:
            await self.transport.aclose()
            raise
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        await self.repository.close()
        await self.transport.aclose()


__all__ = ["RuntimeConfig", "StructuredIngestionRuntime"]

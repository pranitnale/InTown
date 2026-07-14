"""Bounded, cancellable HTTP boundary with deterministic response caching.

No source adapter accepts an arbitrary URL. Requests carry an :class:`Endpoint`
member, preventing source data or user input from turning ingestion into an SSRF
primitive. API keys live in a repr-hidden query collection and never participate
in cache keys or error messages.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from enum import StrEnum
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlencode

from .models import ErrorCode


class Endpoint(StrEnum):
    OVERPASS_KUMI = "https://overpass.kumi.systems/api/interpreter"
    OVERPASS_DE = "https://overpass-api.de/api/interpreter"
    WIKIDATA_API = "https://www.wikidata.org/w/api.php"
    WIKIPEDIA_EN_API = "https://en.wikipedia.org/w/api.php"
    COMMONS_API = "https://commons.wikimedia.org/w/api.php"
    GEOAPIFY_SEARCH = "https://api.geoapify.com/v1/geocode/search"
    GEOAPIFY_AUTOCOMPLETE = "https://api.geoapify.com/v1/geocode/autocomplete"
    GEOAPIFY_REVERSE = "https://api.geoapify.com/v1/geocode/reverse"
    GEOAPIFY_PLACES = "https://api.geoapify.com/v2/places"

    @property
    def label(self) -> str:
        return self.name.lower()


@dataclass(frozen=True, slots=True)
class HttpRequest:
    endpoint: Endpoint
    method: str = "GET"
    query: tuple[tuple[str, str], ...] = ()
    sensitive_query: tuple[tuple[str, str], ...] = field(default=(), repr=False)
    headers: tuple[tuple[str, str], ...] = ()
    body: bytes | None = field(default=None, repr=False)
    timeout_seconds: float = 15.0
    cache_ttl_seconds: float = 86_400.0
    max_response_bytes: int = 8 * 1024 * 1024

    def __post_init__(self) -> None:
        if not isinstance(self.endpoint, Endpoint):
            raise TypeError("request endpoint must be a fixed Endpoint member")
        method = self.method.upper()
        if method not in {"GET", "POST"}:
            raise ValueError("only GET and POST are allowed")
        object.__setattr__(self, "method", method)
        if not 0 < self.timeout_seconds <= 60:
            raise ValueError("request timeout must be in (0,60] seconds")
        if not 0 <= self.cache_ttl_seconds <= 7 * 86_400:
            raise ValueError("cache TTL must be in [0,7 days]")
        if not 1 <= self.max_response_bytes <= 32 * 1024 * 1024:
            raise ValueError("response size cap must be in [1 byte,32 MiB]")
        public_keys = {key for key, _ in self.query}
        secret_keys = {key for key, _ in self.sensitive_query}
        if public_keys & secret_keys:
            raise ValueError("query key cannot be both public and sensitive")

    def cache_key(self) -> str:
        safe_headers = sorted(
            (key.lower(), value)
            for key, value in self.headers
            if key.lower() not in {"authorization", "cookie", "proxy-authorization"}
        )
        document = {
            "endpoint": self.endpoint.value,
            "method": self.method,
            "query": sorted(self.query),
            "headers": safe_headers,
            "body_sha256": hashlib.sha256(self.body or b"").hexdigest(),
        }
        encoded = json.dumps(document, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def wire_url(self) -> str:
        # Kept out of repr/errors: this string can contain an API key.
        params = (*self.query, *self.sensitive_query)
        return self.endpoint.value if not params else f"{self.endpoint.value}?{urlencode(params)}"


@dataclass(frozen=True, slots=True)
class HttpResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


class HttpTransport(Protocol):
    async def send(self, request: HttpRequest, timeout_seconds: float) -> HttpResponse: ...


class TransportFailure(Exception):
    """Sanitized transport failure; source URLs and secrets are never embedded."""


class HttpxTransport:
    """Production async transport. ``httpx`` is imported lazily for fixture CI."""

    def __init__(self, client: Any | None = None, *, max_connections: int = 8) -> None:
        if client is None:
            try:
                import httpx
            except ImportError as exc:  # pragma: no cover - deploy dependency guard
                raise RuntimeError("install the pipeline package to enable live HTTP") from exc
            client = httpx.AsyncClient(
                follow_redirects=False,
                http2=True,
                headers={"Accept-Encoding": "gzip"},
                limits=httpx.Limits(
                    max_connections=max_connections,
                    max_keepalive_connections=max_connections,
                ),
            )
            self._owns_client = True
        else:
            self._owns_client = False
        self._client = client

    async def send(self, request: HttpRequest, timeout_seconds: float) -> HttpResponse:
        headers = dict(request.headers)
        try:
            async with self._client.stream(
                request.method,
                request.wire_url(),
                headers=headers,
                content=request.body,
                timeout=timeout_seconds,
            ) as response:
                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > request.max_response_bytes:
                        raise TransportFailure("response exceeded configured size cap")
                    chunks.append(chunk)
                return HttpResponse(
                    status=response.status_code,
                    headers={key.lower(): value for key, value in response.headers.items()},
                    body=b"".join(chunks),
                )
        except asyncio.CancelledError:
            raise
        except TransportFailure:
            raise
        except Exception:
            # The underlying exception often includes the complete URL (and thus
            # Geoapify key). It is intentionally not chained or interpolated.
            raise TransportFailure("network request failed") from None

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


@dataclass(frozen=True, slots=True)
class CachedResponse:
    body: bytes
    fetched_at: datetime
    expires_at: datetime


class ResponseCache(Protocol):
    async def get(self, key: str, now: datetime) -> CachedResponse | None: ...

    async def set(self, key: str, response: CachedResponse) -> None: ...


class MemoryResponseCache:
    def __init__(self) -> None:
        self._values: dict[str, CachedResponse] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, now: datetime) -> CachedResponse | None:
        async with self._lock:
            item = self._values.get(key)
            if item is not None and item.expires_at > now:
                return item
            self._values.pop(key, None)
            return None

    async def set(self, key: str, response: CachedResponse) -> None:
        async with self._lock:
            self._values[key] = response


class FileResponseCache:
    """Process-safe-enough, content-addressed cache with atomic file replacement."""

    def __init__(self, directory: str | Path) -> None:
        self._directory = Path(directory)

    async def get(self, key: str, now: datetime) -> CachedResponse | None:
        return await asyncio.to_thread(self._get_sync, key, now)

    def _get_sync(self, key: str, now: datetime) -> CachedResponse | None:
        path = self._directory / f"{key}.json"
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            expires_at = datetime.fromisoformat(raw["expires_at"])
            if expires_at <= now:
                return None
            return CachedResponse(
                body=bytes.fromhex(raw["body_hex"]),
                fetched_at=datetime.fromisoformat(raw["fetched_at"]),
                expires_at=expires_at,
            )
        except (FileNotFoundError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return None

    async def set(self, key: str, response: CachedResponse) -> None:
        await asyncio.to_thread(self._set_sync, key, response)

    def _set_sync(self, key: str, response: CachedResponse) -> None:
        self._directory.mkdir(parents=True, exist_ok=True)
        target = self._directory / f"{key}.json"
        temporary = self._directory / f".{key}.{os.getpid()}.tmp"
        payload = json.dumps(
            {
                "body_hex": response.body.hex(),
                "fetched_at": response.fetched_at.isoformat(),
                "expires_at": response.expires_at.isoformat(),
            },
            separators=(",", ":"),
            sort_keys=True,
        )
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(target)


@dataclass(frozen=True, slots=True)
class JsonDocument:
    payload: Any
    fetched_at: datetime
    endpoint: Endpoint
    attempts: int
    cache_hit: bool


class HttpClientError(Exception):
    def __init__(
        self,
        *,
        endpoint: Endpoint,
        code: ErrorCode,
        message: str,
        attempts: int,
        status: int | None = None,
        retriable: bool = False,
    ) -> None:
        super().__init__(f"{endpoint.label}: {message}")
        self.endpoint = endpoint
        self.code = code
        self.safe_message = message
        self.attempts = attempts
        self.status = status
        self.retriable = retriable


@dataclass(frozen=True, slots=True)
class Deadline:
    end: float
    monotonic: Callable[[], float] = field(compare=False, repr=False)

    @classmethod
    def after(
        cls,
        seconds: float,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> "Deadline":
        return cls(monotonic() + seconds, monotonic)

    def remaining(self) -> float:
        return max(0.0, self.end - self.monotonic())

    @property
    def expired(self) -> bool:
        return self.remaining() <= 0


Sleep: type = Callable[[float], Awaitable[None]]


class ResilientJsonClient:
    """JSON client with bounded concurrency, retries, deadlines, and caching."""

    RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})

    def __init__(
        self,
        transport: HttpTransport,
        *,
        cache: ResponseCache | None = None,
        max_concurrency: int = 4,
        max_retries: int = 2,
        max_retry_after_seconds: float = 30.0,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        sleep: Sleep = asyncio.sleep,
    ) -> None:
        if not 1 <= max_concurrency <= 16:
            raise ValueError("HTTP concurrency must be in [1,16]")
        if not 0 <= max_retries <= 4:
            raise ValueError("HTTP retries must be in [0,4]")
        self._transport = transport
        self._cache = cache
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._max_retries = max_retries
        self._max_retry_after = max_retry_after_seconds
        self._clock = clock
        self._sleep = sleep

    async def request_json(self, request: HttpRequest, deadline: Deadline) -> JsonDocument:
        key = request.cache_key()
        now = self._clock()
        if self._cache is not None and request.cache_ttl_seconds > 0:
            cached = await self._cache.get(key, now)
            if cached is not None:
                return self._decode(cached.body, cached.fetched_at, request.endpoint, 0, True)

        last_code = ErrorCode.UPSTREAM
        last_message = "upstream request failed"
        last_status: int | None = None
        for attempt in range(1, self._max_retries + 2):
            remaining = deadline.remaining()
            if remaining <= 0:
                raise HttpClientError(
                    endpoint=request.endpoint,
                    code=ErrorCode.BUDGET_EXHAUSTED,
                    message="source deadline exhausted",
                    attempts=attempt - 1,
                )
            timeout = min(request.timeout_seconds, remaining)
            try:
                async with self._semaphore:
                    response = await asyncio.wait_for(
                        self._transport.send(request, timeout), timeout=timeout
                    )
            except asyncio.CancelledError:
                raise
            except TimeoutError:
                response = None
                last_code = ErrorCode.TIMEOUT
                last_message = "request timed out"
                last_status = None
            except TransportFailure:
                response = None
                last_code = ErrorCode.TRANSPORT
                last_message = "network request failed"
                last_status = None

            if response is not None and 200 <= response.status < 300:
                fetched_at = self._clock()
                document = self._decode(response.body, fetched_at, request.endpoint, attempt, False)
                structured_error = self._structured_retry_error(document.payload)
                if structured_error is not None:
                    code, message, delay = structured_error
                    if attempt > self._max_retries:
                        raise HttpClientError(
                            endpoint=request.endpoint,
                            code=code,
                            message=message,
                            attempts=attempt,
                            status=response.status,
                            retriable=True,
                        )
                    retry_delay = min(self._max_retry_after, delay)
                    if retry_delay >= deadline.remaining():
                        raise HttpClientError(
                            endpoint=request.endpoint,
                            code=ErrorCode.BUDGET_EXHAUSTED,
                            message="structured API retry exceeds source deadline",
                            attempts=attempt,
                            status=response.status,
                            retriable=True,
                        )
                    await self._sleep(retry_delay)
                    continue
                if self._cache is not None and request.cache_ttl_seconds > 0:
                    from datetime import timedelta

                    await self._cache.set(
                        key,
                        CachedResponse(
                            body=response.body,
                            fetched_at=fetched_at,
                            expires_at=fetched_at + timedelta(seconds=request.cache_ttl_seconds),
                        ),
                    )
                return document

            if response is not None:
                last_status = response.status
                last_code = (
                    ErrorCode.RATE_LIMITED if response.status == 429 else ErrorCode.UPSTREAM
                )
                last_message = (
                    "upstream rate limit exceeded"
                    if response.status == 429
                    else f"upstream returned HTTP {response.status}"
                )
                retryable = response.status in self.RETRYABLE_STATUS
            else:
                retryable = True

            if not retryable or attempt > self._max_retries:
                raise HttpClientError(
                    endpoint=request.endpoint,
                    code=last_code,
                    message=last_message,
                    attempts=attempt,
                    status=last_status,
                    retriable=retryable,
                )

            retry_after = self._retry_delay(response, attempt)
            if retry_after >= deadline.remaining():
                raise HttpClientError(
                    endpoint=request.endpoint,
                    code=ErrorCode.BUDGET_EXHAUSTED,
                    message="retry delay exceeds source deadline",
                    attempts=attempt,
                    status=last_status,
                    retriable=True,
                )
            await self._sleep(retry_after)

        raise AssertionError("retry loop exhausted unexpectedly")

    @staticmethod
    def _structured_retry_error(payload: Any) -> tuple[ErrorCode, str, float] | None:
        """Recognize retryable MediaWiki errors returned with HTTP 200.

        In particular, ``maxlag`` must not poison the deterministic cache.
        Unknown API error objects are left to the source parser.
        """

        if not isinstance(payload, dict) or not isinstance(payload.get("error"), dict):
            return None
        error = payload["error"]
        code = str(error.get("code", "")).lower()
        if code not in {"maxlag", "ratelimited", "readonly", "internal_api_error_dbconnectionerror"}:
            return None
        raw_lag = error.get("lag", 0.5)
        try:
            delay = max(0.25, float(raw_lag))
        except (TypeError, ValueError):
            delay = 0.5
        if code == "ratelimited":
            return ErrorCode.RATE_LIMITED, "structured API rate limit exceeded", delay
        return ErrorCode.UPSTREAM, "structured API temporarily unavailable", delay

    def _decode(
        self,
        body: bytes,
        fetched_at: datetime,
        endpoint: Endpoint,
        attempts: int,
        cache_hit: bool,
    ) -> JsonDocument:
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise HttpClientError(
                endpoint=endpoint,
                code=ErrorCode.INVALID_RESPONSE,
                message="upstream returned invalid JSON",
                attempts=attempts,
            ) from exc
        return JsonDocument(payload, fetched_at, endpoint, attempts, cache_hit)

    def _retry_delay(self, response: HttpResponse | None, attempt: int) -> float:
        if response is not None:
            raw = response.headers.get("retry-after") or response.headers.get("Retry-After")
            if raw:
                try:
                    return min(self._max_retry_after, max(0.0, float(raw)))
                except ValueError:
                    try:
                        parsed = parsedate_to_datetime(raw)
                        if parsed.tzinfo is None:
                            parsed = parsed.replace(tzinfo=UTC)
                        seconds = (parsed - self._clock()).total_seconds()
                        return min(self._max_retry_after, max(0.0, seconds))
                    except (TypeError, ValueError, OverflowError):
                        pass
        return min(self._max_retry_after, 0.25 * (2 ** (attempt - 1)))


def validate_wikimedia_user_agent(value: str) -> str:
    """Require an identifiable agent with a contact URL or mail address."""

    stripped = value.strip()
    lowered = stripped.lower()
    has_contact = "http://" in lowered or "https://" in lowered or "mailto:" in lowered or "@" in lowered
    if len(stripped) < 12 or not has_contact:
        raise ValueError("Wikimedia User-Agent must identify the app and include contact information")
    if "python-requests" in lowered or lowered in {"curl", "httpx"}:
        raise ValueError("generic Wikimedia User-Agent is not allowed")
    return stripped


__all__ = [
    "CachedResponse",
    "Deadline",
    "Endpoint",
    "FileResponseCache",
    "HttpClientError",
    "HttpRequest",
    "HttpResponse",
    "HttpTransport",
    "HttpxTransport",
    "JsonDocument",
    "MemoryResponseCache",
    "ResilientJsonClient",
    "ResponseCache",
    "TransportFailure",
    "validate_wikimedia_user_agent",
]

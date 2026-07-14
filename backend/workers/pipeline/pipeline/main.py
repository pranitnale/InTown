"""Operator CLI for the structured City Brain skeleton builder.

The Postgres job-queue consumer arrives in P11. This P09 entrypoint remains a
safe direct operator path for smoke tests and one-off cold-city warming.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import asdict
from datetime import datetime
from enum import Enum

from .ingestion.models import BBox, BuildRequest
from .ingestion.runtime import RuntimeConfig, StructuredIngestionRuntime


def _bbox(value: str) -> BBox:
    try:
        numbers = [float(item.strip()) for item in value.split(",")]
        if len(numbers) != 4:
            raise ValueError
        return BBox(*numbers)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "bbox must be min_lat,min_lng,max_lat,max_lng"
        ) from exc


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, Enum):
        return value.value
    raise TypeError(f"cannot encode {type(value).__name__}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="intown-pipeline")
    subcommands = parser.add_subparsers(dest="command", required=True)
    build = subcommands.add_parser("build-city", help="build a structured cold-city skeleton")
    build.add_argument("--city-id", required=True)
    build.add_argument("--name", required=True)
    build.add_argument("--country-code")
    build.add_argument("--bbox", required=True, type=_bbox)
    build.add_argument("--language", default="en")
    build.add_argument("--budget-seconds", type=float, default=120.0)
    return parser


async def _run(args: argparse.Namespace) -> int:
    config = RuntimeConfig.from_environment()
    request = BuildRequest(
        city_id=args.city_id,
        city_name=args.name,
        country_code=args.country_code,
        bbox=args.bbox,
        language=args.language,
        budget_seconds=args.budget_seconds,
    )
    async with StructuredIngestionRuntime(config) as runtime:
        report = await runtime.pipeline.build_city(request)
    print(json.dumps(asdict(report), default=_json_default, separators=(",", ":"), sort_keys=True))
    return 0 if report.curatable else 2


def main() -> None:
    raise SystemExit(asyncio.run(_run(_parser().parse_args())))


if __name__ == "__main__":
    main()

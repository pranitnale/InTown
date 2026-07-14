#!/usr/bin/env bash
# Run the repo's Python test suites:
#   1. the generated-contracts fixture-contract parity check (contracts/python), and
#   2. the P09 structured-ingestion pipeline suite (recorded HTTP fixtures only).
#
# Creates or reuses the repo-root `.venv`, installs
# `contracts/python/requirements.txt` only when the toolchain is missing (so
# repeated local runs are fast), then runs both suites. Targets Python 3.11 for
# the contracts suite; the pipeline package requires 3.11+ and lazy-imports its
# httpx/psycopg dependencies, so the fixture suite needs no extra install.
#
# Canonical invocation is via the root workspace test script:
#   pnpm -w test   ->   bash scripts/python-tests.sh
set -euo pipefail

# Resolve the repo root from this script's location so cwd does not matter.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${REPO_ROOT}/.venv"
REQUIREMENTS="${REPO_ROOT}/contracts/python/requirements.txt"
VENV_PY="${VENV_DIR}/bin/python"

# 1. Create the virtualenv if it does not already exist.
if [ ! -x "${VENV_PY}" ]; then
  echo "[python-tests] creating virtualenv at ${VENV_DIR}"
  python3 -m venv "${VENV_DIR}"
fi

# 2. Install requirements only when a key runtime import is missing. pytest and
#    pydantic (with the email extra) are what the tests import at collection time.
if ! "${VENV_PY}" -c "import pytest, pydantic, email_validator" >/dev/null 2>&1; then
  echo "[python-tests] installing Python requirements (quiet)"
  "${VENV_PY}" -m pip install --quiet --upgrade pip
  "${VENV_PY}" -m pip install --quiet -r "${REQUIREMENTS}"
fi

# 3. Run the generated-contracts fixture-contract parity suite.
"${VENV_PY}" -m pytest "${REPO_ROOT}/contracts/python/tests" -q

# 4. Run the P09 structured-ingestion pipeline suite. `-t` sets the top-level
#    dir so the `pipeline` package is importable; recorded JSON fixtures mean no
#    live network calls and no third-party install (httpx/psycopg are lazy).
PIPELINE_DIR="${REPO_ROOT}/backend/workers/pipeline"
exec "${VENV_PY}" -m unittest discover -s "${PIPELINE_DIR}/tests" -t "${PIPELINE_DIR}"

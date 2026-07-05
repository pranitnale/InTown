#!/usr/bin/env bash
# Run the generated-contracts Python test suite (fixture-contract parity check).
#
# Creates or reuses the repo-root `.venv`, installs
# `contracts/python/requirements.txt` only when the toolchain is missing (so
# repeated local runs are fast), then runs pytest against `contracts/python/tests`.
# Targets Python 3.11 (the provisioned interpreter) but works on any 3.11+.
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

# 3. Run the suite.
exec "${VENV_PY}" -m pytest "${REPO_ROOT}/contracts/python/tests" -q

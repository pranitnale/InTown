# `intown_contracts` — generated Python mirror

This directory is **generated, never hand-edited.** `jsonschema/*.json` (draft
2020-12, one file per contract schema, shared sub-schemas factored out and
`$ref`'d) and `intown_contracts/*.py` (pydantic v2 models) are produced from the
frozen zod v4 contract in `contracts/types`, `contracts/events`, and the
solver/research API seams, so Python services validate against the exact same
shapes as the TypeScript apps. Both outputs are deterministic and drift-checked
in CI — edit the zod source, then regenerate with `pnpm --filter
@intown/contracts run generate:python` (needs the repo-root `.venv`:
`python3 -m venv .venv && .venv/bin/pip install -r contracts/python/requirements.txt`).

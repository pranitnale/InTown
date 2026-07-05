"""Put the generated `intown_contracts` package on `sys.path`.

The package lives at `contracts/python/intown_contracts`; this conftest adds
`contracts/python` (its parent) so `import intown_contracts.*` resolves no matter
which directory pytest is invoked from (the canonical command runs from the repo
root: `.venv/bin/python -m pytest contracts/python/tests -q`).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

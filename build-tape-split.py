#!/usr/bin/env python3
"""Derive page JSON from trades.json / trades-lite.json via qc.js so names and order match the site.

Outputs: tape/{page,all,filers}.json, tape/kind/*, tape/politicians/*, tape/tickers/*, landed.json, heat.json.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    node = shutil.which("node")
    if not node:
        print("node is required to run qc.js for the tape split", file=sys.stderr)
        return 1
    script = ROOT / "scripts" / "tape-split.mjs"
    proc = subprocess.run([node, str(script)], cwd=ROOT)
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())

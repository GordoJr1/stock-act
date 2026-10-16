"""Fail when the tape has not been rebuilt in over 30 hours (the collector publishes twice a day)."""

import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIMIT = dt.timedelta(hours=30)


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc)
    page = ROOT / "tape" / "page.json"
    if not page.exists():
        print("FAIL: tape/page.json is missing")
        return 1
    try:
        generated = json.loads(page.read_text(encoding="utf-8")).get("generated", "")
        gen = dt.datetime.fromisoformat(generated.replace("Z", "+00:00"))
    except Exception as err:
        print(f"FAIL: cannot read tape/page.json generated stamp: {err}")
        return 1
    if gen.tzinfo is None:
        gen = gen.replace(tzinfo=dt.timezone.utc)
    age = now - gen
    hours = age.total_seconds() / 3600
    if age <= LIMIT:
        print(f"OK: tape rebuilt {hours:.1f} hours ago ({generated})")
        return 0
    print(f"FAIL: tape rebuilt {hours:.1f} hours ago ({generated}); the collector looks stalled")
    return 1


if __name__ == "__main__":
    sys.exit(main())

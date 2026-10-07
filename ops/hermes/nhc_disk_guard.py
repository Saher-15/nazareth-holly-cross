#!/usr/bin/env python3
"""Keeps the Hermes volume from filling up (a full disk stops Hermes, and with it every alert and the 08:00 report).

Runs daily as a script-only Hermes cron job (docs/MONITORING.md section 8). When the volume is above CLEAN_AT, it
deletes ONLY download caches that tools rebuild by themselves (npm, uv, Hermes scratch files), never data, sessions,
memories, the website clone or the scripts. It prints nothing (Hermes sends nothing) unless the disk is still above
WARN_AT afterwards: then the owner gets one message with what is using the space.

Manual use:  python3 nhc_disk_guard.py [--dry-run]
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

HOME = Path(os.environ.get("HERMES_HOME", "/opt/data"))
CLEAN_AT = 80   # percent used: clean the caches above this
WARN_AT = 85    # percent used after cleaning: tell the owner above this
CACHES = [      # rebuilt automatically when needed
    HOME / "home" / ".npm" / "_cacache",
    HOME / ".npm" / "_cacache",
    HOME / "home" / ".cache" / "uv",
    HOME / ".cache" / "uv",
    HOME / "cache" / "scratch",
]


def used_percent(path: Path) -> float:
    total, used, _ = shutil.disk_usage(path)
    return used * 100 / total


def size_mb(path: Path) -> float:
    if not path.exists():
        return 0.0
    total = 0
    for root, _, files in os.walk(path):
        for name in files:
            try:
                total += (Path(root) / name).lstat().st_size
            except OSError:
                pass
    return total / 1_048_576


def biggest(path: Path, n: int = 5) -> list[str]:
    rows = []
    for child in path.iterdir():
        if child.is_dir() and not child.is_symlink():
            rows.append((size_mb(child), child.name))
    return [f"{name} {mb:.0f} MB" for mb, name in sorted(rows, reverse=True)[:n]]


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    before = used_percent(HOME)
    freed = 0.0
    if before > CLEAN_AT:
        for cache in CACHES:
            mb = size_mb(cache)
            if mb and not dry:
                shutil.rmtree(cache, ignore_errors=True)
            freed += mb
    after = used_percent(HOME)
    if dry:
        print(f"disk {before:.0f}% used; would free about {freed:.0f} MB of caches (above {CLEAN_AT}% only)")
    elif after > WARN_AT:
        print(f"🟠 Hermes disk is {after:.0f}% full (was {before:.0f}%, {freed:.0f} MB of caches cleared). "
              f"A full disk stops Hermes and its alerts. Largest folders: {', '.join(biggest(HOME))}. "
              "Grow the volume in Railway (hermes service -> volume) or clean up.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

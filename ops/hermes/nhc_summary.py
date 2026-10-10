#!/usr/bin/env python3
"""Daily status report for Hermes Agent (a script-only cron job cannot pass arguments, so this file adds --summary).

Lives next to nhc_watch.py in $HERMES_HOME/scripts/. See docs/MONITORING.md, section 8.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nhc_watch import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(["--summary", *sys.argv[1:]]))

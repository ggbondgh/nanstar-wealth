#!/usr/bin/env python3
"""Watch a local Guosen snapshot JSON and upload it when it changes.

This is meant to run in normal Windows Python, outside iQuant. iQuant writes
local_guosen_snapshot.json; this watcher pushes that snapshot to Cloudflare D1.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import sync_guosen


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = BASE_DIR / "config.json"
DEFAULT_SNAPSHOT = BASE_DIR / "local_guosen_snapshot.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-upload Guosen local snapshots to NanStar Wealth.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to config.json.")
    parser.add_argument("--snapshot", default=str(DEFAULT_SNAPSHOT), help="Path to local_guosen_snapshot.json.")
    parser.add_argument("--poll-seconds", type=int, default=20, help="How often to check the snapshot file.")
    parser.add_argument("--once", action="store_true", help="Upload once and exit.")
    args = parser.parse_args()

    config_path = Path(args.config)
    snapshot_path = Path(args.snapshot)
    poll_seconds = max(5, int(args.poll_seconds or 20))
    config = sync_guosen.load_config(config_path)

    print("[nanstar-uploader] watching:", snapshot_path)
    print("[nanstar-uploader] config:", config_path)
    print("[nanstar-uploader] poll seconds:", poll_seconds)

    last_seen: Optional[Tuple[int, int]] = None
    while True:
        try:
            current = snapshot_signature(snapshot_path)
            if current and current != last_seen:
                summary = sync_guosen.sync_once(config, sample_path=str(snapshot_path))
                last_seen = current
                print(json.dumps(summary, ensure_ascii=False, indent=2))
            elif not current:
                print("[nanstar-uploader] snapshot not found, waiting:", snapshot_path)
        except KeyboardInterrupt:
            print("[nanstar-uploader] stopped")
            return 130
        except Exception as exc:  # noqa: BLE001 - command line watcher should keep running.
            print(f"[nanstar-uploader] failed: {exc}", file=sys.stderr)

        if args.once:
            return 0
        time.sleep(poll_seconds)


def snapshot_signature(path: Path) -> Optional[Tuple[int, int]]:
    if not path.exists():
        return None
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


if __name__ == "__main__":
    raise SystemExit(main())

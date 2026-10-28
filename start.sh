#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
python3 restore_assets.py
python3 -m http.server 8642 --directory dist

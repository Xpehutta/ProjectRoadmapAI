#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Backend tests =="
cd "$ROOT/backend"
python3 -m pytest -q

echo "== Frontend lint =="
cd "$ROOT/frontend"
npm run lint

echo "== Frontend tests =="
npm test

echo "== Frontend build =="
npm run build

echo "CI checks passed."

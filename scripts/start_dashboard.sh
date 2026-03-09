#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/web"
PORT="${PORT:-3000}"

cd "$PROJECT_ROOT"

echo "Refreshing trend data..."
python3 scripts/run_ingestion.py
python3 scripts/export_web_data.py

if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo "Installing web dependencies..."
  cd "$WEB_DIR"
  npm install
else
  cd "$WEB_DIR"
fi

echo "Starting dashboard on http://localhost:$PORT"
exec npm run dev -- --port "$PORT"

#!/bin/bash

# Ticketing System Restart Script
# Preserves explicit mode selection and forwards it to start_app.sh.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE_ARG="${1:-}"
if [ -n "${APP_MODE:-}" ]; then
  MODE="${APP_MODE}"
elif [ -n "${ENV:-}" ]; then
  MODE="${ENV}"
elif [ -n "$MODE_ARG" ]; then
  MODE="$MODE_ARG"
else
  MODE="prod"
fi

case "$MODE" in
  dev|prod) ;;
  *)
    echo "Usage: ./restart_app.sh [dev|prod]"
    echo "       or APP_MODE=dev ./restart_app.sh"
    exit 1
    ;;
esac

echo "🔄 Restarting Ticketing System (mode: $MODE)..."

"$SCRIPT_DIR/stop_app.sh" || true

sleep 1

APP_MODE="$MODE" "$SCRIPT_DIR/start_app.sh"

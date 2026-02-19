#!/usr/bin/env python3
"""Lightweight schema/migration parity guard for CI."""

from __future__ import annotations

import sys
from pathlib import Path
import importlib


BACKEND_DIR = Path(__file__).resolve().parents[1]
VERSIONS_DIR = BACKEND_DIR / "alembic" / "versions"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

REQUIRED_TICKET_COLUMNS = {
    "workflow_state",
    "ticket_version",
    "nro_phase1_scheduled_date",
    "nro_phase1_completed_at",
    "nro_phase1_state",
    "nro_phase2_scheduled_date",
    "nro_phase2_completed_at",
    "nro_phase2_state",
}
REQUIRED_MIGRATION_FILE_SNIPPETS = (
    "ticket_workflow_state_and_version",
    "nro_phase_fields",
)


def main() -> int:
    if not VERSIONS_DIR.exists():
        sys.stderr.write(f"Missing alembic versions directory: {VERSIONS_DIR}\n")
        return 1

    models = importlib.import_module("models")
    ticket_table = models.Ticket.__table__
    model_cols = {c.name for c in ticket_table.columns}
    missing_cols = sorted(REQUIRED_TICKET_COLUMNS - model_cols)
    if missing_cols:
        sys.stderr.write(f"Ticket model missing required columns: {missing_cols}\n")
        return 1

    migration_files = [p.name for p in VERSIONS_DIR.glob("*.py")]
    missing_migrations = [
        snippet
        for snippet in REQUIRED_MIGRATION_FILE_SNIPPETS
        if not any(snippet in name for name in migration_files)
    ]
    if missing_migrations:
        sys.stderr.write(f"Required migration files not found for: {missing_migrations}\n")
        return 1

    print("Schema/migration parity guard passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

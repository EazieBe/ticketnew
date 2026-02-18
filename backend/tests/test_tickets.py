"""Tests for ticket create, update, approve, claim, complete."""
import os
import sys
import pytest

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from starlette.testclient import TestClient
from main import app
from database import SessionLocal
import crud
import schemas
import models

client = TestClient(app)


@pytest.fixture
def test_site_id(ensure_test_site):
    """Return a site_id that exists (from conftest ensure_test_site)."""
    db = SessionLocal()
    try:
        site = db.query(models.Site).first()
        assert site is not None
        return site.site_id
    finally:
        db.close()


def test_ticket_create(auth_headers, ensure_test_site, test_site_id):
    """POST /tickets/ creates a ticket and returns 200 with ticket_id."""
    payload = {
        "site_id": test_site_id,
        "type": "onsite",
        "status": "open",
        "priority": "normal",
        "notes": "Test ticket from pytest",
    }
    resp = client.post("/tickets/", json=payload, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "ticket_id" in data
    assert data["site_id"] == test_site_id
    assert data["notes"] == "Test ticket from pytest"


def test_ticket_create_unauthorized(ensure_test_site, test_site_id):
    """POST /tickets/ without auth returns 401."""
    payload = {"site_id": test_site_id, "type": "onsite", "status": "open"}
    resp = client.post("/tickets/", json=payload)
    assert resp.status_code == 401


def test_ticket_update(auth_headers, ensure_test_site, test_site_id):
    """PUT /tickets/{id} updates a ticket."""
    # Create ticket first
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "onsite", "status": "open", "notes": "Original"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    ticket_id = create_resp.json()["ticket_id"]

    # Update
    update_resp = client.put(
        f"/tickets/{ticket_id}",
        json={"notes": "Updated by test"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["notes"] == "Updated by test"


def test_ticket_approve(auth_headers, ensure_test_site, test_site_id):
    """POST /tickets/{id}/approve?approve=true approves a ticket (must be completed first)."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "onsite", "status": "open"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    ticket_id = create_resp.json()["ticket_id"]
    client.put(f"/tickets/{ticket_id}/claim", json={}, headers=auth_headers)
    client.put(f"/tickets/{ticket_id}/complete", json={}, headers=auth_headers)

    resp = client.post(f"/tickets/{ticket_id}/approve?approve=true", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") in ("approved", "archived")


def test_ticket_claim(auth_headers, ensure_test_site, test_site_id):
    """PUT /tickets/{id}/claim sets claimed_by."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "onsite", "status": "open"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    ticket_id = create_resp.json()["ticket_id"]

    resp = client.put(f"/tickets/{ticket_id}/claim", json={}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("claimed_by") is not None


def test_ticket_complete(auth_headers, ensure_test_site, test_site_id):
    """PUT /tickets/{id}/complete sets status completed."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "onsite", "status": "open"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    ticket_id = create_resp.json()["ticket_id"]
    # Claim first (complete may require claimed)
    client.put(f"/tickets/{ticket_id}/claim", json={}, headers=auth_headers)

    resp = client.put(f"/tickets/{ticket_id}/complete", json={}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "completed"


def test_ticket_update_conflict_returns_409(auth_headers, ensure_test_site, test_site_id):
    """Stale ticket_version updates should fail with 409 conflict."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "inhouse", "status": "open", "notes": "v1"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    ticket_id = created["ticket_id"]
    base_version = created.get("ticket_version") or 1

    ok_update = client.put(
        f"/tickets/{ticket_id}",
        json={"notes": "v2", "expected_ticket_version": base_version},
        headers=auth_headers,
    )
    assert ok_update.status_code == 200, ok_update.text
    assert (ok_update.json().get("ticket_version") or 0) >= base_version + 1

    stale_update = client.put(
        f"/tickets/{ticket_id}",
        json={"notes": "v3", "expected_ticket_version": base_version},
        headers=auth_headers,
    )
    assert stale_update.status_code == 409, stale_update.text
    detail = stale_update.json().get("detail", {})
    assert "current_ticket_version" in detail


def test_workflow_transition_and_dispatch_queue(auth_headers, ensure_test_site, test_site_id):
    """Workflow transitions should update state and appear in dispatcher queues."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "inhouse", "status": "open"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    ticket_id = created["ticket_id"]
    version = created.get("ticket_version") or 1

    trans_resp = client.post(
        f"/tickets/{ticket_id}/workflow-transition",
        json={
            "workflow_state": "needstech",
            "expected_ticket_version": version,
            "notes": "Escalate to onsite dispatcher scheduling",
        },
        headers=auth_headers,
    )
    assert trans_resp.status_code == 200, trans_resp.text
    data = trans_resp.json()
    assert data.get("workflow_state") == "needstech"
    assert data.get("status") == "open"

    queue_resp = client.get("/tickets/dispatch/queue?queue=needstech", headers=auth_headers)
    assert queue_resp.status_code == 200, queue_resp.text
    ids = {t.get("ticket_id") for t in queue_resp.json()}
    assert ticket_id in ids


def test_nro_phase_transition_fields(auth_headers, ensure_test_site, test_site_id):
    """NRO phase transitions should set phase-specific scheduling/completion fields."""
    create_resp = client.post(
        "/tickets/",
        json={"site_id": test_site_id, "type": "nro", "status": "open"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    ticket_id = created["ticket_id"]
    version = created.get("ticket_version") or 1

    p1_sched = client.post(
        f"/tickets/{ticket_id}/workflow-transition",
        json={
            "workflow_state": "nro_phase1_scheduled",
            "schedule_date": "2026-03-02",
            "expected_ticket_version": version,
        },
        headers=auth_headers,
    )
    assert p1_sched.status_code == 200, p1_sched.text
    data = p1_sched.json()
    assert data.get("nro_phase1_scheduled_date") == "2026-03-02"
    assert data.get("nro_phase1_state") == "scheduled"

    p1_done = client.post(
        f"/tickets/{ticket_id}/workflow-transition",
        json={
            "workflow_state": "nro_phase1_complete_pending_phase2",
            "expected_ticket_version": data.get("ticket_version"),
        },
        headers=auth_headers,
    )
    assert p1_done.status_code == 200, p1_done.text
    d2 = p1_done.json()
    assert d2.get("nro_phase1_state") == "completed"
    assert d2.get("nro_phase1_completed_at") is not None

    p2_sched = client.post(
        f"/tickets/{ticket_id}/workflow-transition",
        json={
            "workflow_state": "nro_phase2_scheduled",
            "schedule_date": "2026-03-09",
            "expected_ticket_version": d2.get("ticket_version"),
        },
        headers=auth_headers,
    )
    assert p2_sched.status_code == 200, p2_sched.text
    d3 = p2_sched.json()
    assert d3.get("nro_phase2_scheduled_date") == "2026-03-09"
    assert d3.get("nro_phase2_state") == "scheduled"

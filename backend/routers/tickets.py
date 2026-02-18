from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Body, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

import models, schemas, crud
from database import get_db
from utils.main_utils import get_current_user, require_role, audit_log, _as_ticket_status, _as_role
from utils.main_utils import _enqueue_broadcast

router = APIRouter(prefix="/tickets", tags=["tickets"])

# Ensure datetime fields are timezone-aware (UTC) before serialization
def _normalize_ticket_dt(t: models.Ticket):
    if not t:
        return t
    from datetime import timezone as _tz
    for field in ("created_at", "claimed_at", "check_in_time", "check_out_time", "end_time", "approved_at"):
        val = getattr(t, field, None)
        if val is not None and getattr(val, 'tzinfo', None) is None:
            try:
                setattr(t, field, val.replace(tzinfo=_tz.utc))
            except Exception:
                pass
    return t

def _enforce_ticket_version(expected_version: Optional[int], current_version: int):
    """Raise 409 when client writes with a stale version."""
    if expected_version is None:
        return
    if expected_version != current_version:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Ticket was updated by another user. Refresh and retry.",
                "current_ticket_version": current_version,
                "expected_ticket_version": expected_version,
            },
        )

def _bump_ticket_version(ticket: models.Ticket):
    ticket.ticket_version = (ticket.ticket_version or 0) + 1

def _canonicalize_status(requested: schemas.TicketStatus) -> schemas.TicketStatus:
    """Normalize legacy statuses to lifecycle status contract."""
    if requested == schemas.TicketStatus.archived:
        return schemas.TicketStatus.archived
    if requested in (schemas.TicketStatus.completed, schemas.TicketStatus.closed, schemas.TicketStatus.approved):
        return schemas.TicketStatus.completed
    return schemas.TicketStatus.open

def _status_for_workflow_state(workflow_state: schemas.TicketWorkflowState) -> schemas.TicketStatus:
    """Map operational workflow states to canonical lifecycle status."""
    if workflow_state in {
        schemas.TicketWorkflowState.pending_approval,
        schemas.TicketWorkflowState.ready_to_archive,
        schemas.TicketWorkflowState.nro_ready_for_completion,
    }:
        return schemas.TicketStatus.completed
    return schemas.TicketStatus.open

def _can_transition_workflow_state(
    target_state: schemas.TicketWorkflowState,
    role: models.UserRole,
    is_assigned: bool,
    is_claimer: bool,
) -> bool:
    is_admin_or_dispatcher = role in (models.UserRole.admin, models.UserRole.dispatcher)
    is_worker = role == models.UserRole.tech or is_assigned or is_claimer

    dispatcher_only_states = {
        schemas.TicketWorkflowState.scheduled,
        schemas.TicketWorkflowState.pending_dispatch_review,
        schemas.TicketWorkflowState.nro_phase1_scheduled,
        schemas.TicketWorkflowState.nro_phase2_scheduled,
    }
    worker_states = {
        schemas.TicketWorkflowState.claimed,
        schemas.TicketWorkflowState.onsite,
        schemas.TicketWorkflowState.offsite,
        schemas.TicketWorkflowState.followup_required,
        schemas.TicketWorkflowState.needstech,
        schemas.TicketWorkflowState.goback_required,
        schemas.TicketWorkflowState.pending_approval,
        schemas.TicketWorkflowState.nro_phase1_complete_pending_phase2,
        schemas.TicketWorkflowState.nro_phase1_goback_required,
        schemas.TicketWorkflowState.nro_phase2_goback_required,
        schemas.TicketWorkflowState.nro_ready_for_completion,
    }

    if target_state in dispatcher_only_states:
        return is_admin_or_dispatcher
    if target_state == schemas.TicketWorkflowState.ready_to_archive:
        return is_admin_or_dispatcher
    if target_state in worker_states:
        return is_admin_or_dispatcher or is_worker
    return is_admin_or_dispatcher or is_worker

@router.get("/count")
def tickets_count(
    response: Response,
    status: Optional[str] = None,
    workflow_state: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    site_id: Optional[str] = None,
    ticket_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    count = crud.count_tickets(
        db,
        status=status,
        workflow_state=workflow_state,
        priority=priority,
        assigned_user_id=assigned_user_id,
        site_id=site_id,
        ticket_type=ticket_type,
        search=search,
    )
    response.headers["Cache-Control"] = "public, max-age=15"
    return {"count": count}

@router.post("/", response_model=schemas.TicketOut)
def create_ticket(
    ticket: schemas.TicketCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user), 
    background_tasks: BackgroundTasks = None
):
    """Create a new ticket"""
    # Wrap to return cleaner errors
    try:
        result = crud.create_ticket(db=db, ticket=ticket)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not create ticket: {str(e)}")
    
    # Create audit log for ticket creation
    audit = schemas.TicketAuditCreate(
        ticket_id=result.ticket_id,
        user_id=current_user.user_id,
        change_time=datetime.now(timezone.utc),
        field_changed="ticket_create",
        old_value=None,
        new_value=f"Ticket {result.ticket_id} created"
    )
    crud.create_ticket_audit(db, audit)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"create"}')
    # Refetch with relations to avoid N+1 during TicketOut serialization
    out = crud.get_ticket_for_response(db, result.ticket_id)
    return _normalize_ticket_dt(out)

@router.get("/", response_model=List[schemas.TicketOut])
def list_tickets(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    workflow_state: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    site_id: Optional[str] = None,
    ticket_type: Optional[str] = None,
    search: Optional[str] = None,
    include_related: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List tickets with pagination and filters"""
    safe_skip = max(0, skip)
    safe_limit = max(1, min(limit, 200))
    tickets = crud.get_tickets(
        db,
        skip=safe_skip,
        limit=safe_limit,
        status=status,
        workflow_state=workflow_state,
        priority=priority,
        assigned_user_id=assigned_user_id,
        site_id=site_id,
        ticket_type=ticket_type,
        search=search,
        include_related=include_related,
    )
    return [_normalize_ticket_dt(t) for t in tickets]

@router.post("/{ticket_id}/workflow-transition", response_model=schemas.TicketOut, tags=["ticket-workflow"])
def workflow_transition(
    ticket_id: str,
    transition: schemas.WorkflowTransitionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    """Transition ticket operational workflow state with role and version guards."""
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    role = _as_role(current_user.role)
    is_admin_or_dispatcher = role in (models.UserRole.admin, models.UserRole.dispatcher)
    is_assigned = ticket.assigned_user_id == current_user.user_id
    is_claimer = getattr(ticket, "claimed_by", None) == current_user.user_id
    if not _can_transition_workflow_state(transition.workflow_state, role, is_assigned, is_claimer):
        raise HTTPException(status_code=403, detail="Not authorized for this workflow transition")

    _enforce_ticket_version(transition.expected_ticket_version, ticket.ticket_version or 1)

    effective_type = transition.convert_to_type.value if transition.convert_to_type is not None else (ticket.type.value if hasattr(ticket.type, "value") else ticket.type)
    if transition.workflow_state.value.startswith("nro_") and effective_type != models.TicketType.nro.value:
        raise HTTPException(status_code=400, detail="NRO phase transitions require ticket type 'nro'")

    ticket.workflow_state = transition.workflow_state.value
    ticket.status = _status_for_workflow_state(transition.workflow_state).value
    ticket.last_updated_by = current_user.user_id
    ticket.last_updated_at = datetime.now(timezone.utc)
    if transition.convert_to_type is not None:
        if not is_admin_or_dispatcher:
            raise HTTPException(status_code=403, detail="Only dispatcher/admin can convert ticket type")
        ticket.type = transition.convert_to_type.value

    if transition.schedule_date is not None:
        ticket.date_scheduled = transition.schedule_date
    if transition.follow_up_date is not None:
        ticket.follow_up_required = True
        ticket.follow_up_date = transition.follow_up_date
    if transition.follow_up_notes is not None:
        ticket.follow_up_notes = transition.follow_up_notes
    if transition.notes:
        base = ticket.notes or ""
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        note_line = f"[WORKFLOW:{transition.workflow_state.value}] {stamp} - {transition.notes}"
        ticket.notes = f"{base}\n{note_line}".strip()

    # NRO phase-specific field synchronization
    if transition.workflow_state == schemas.TicketWorkflowState.nro_phase1_scheduled:
        if transition.schedule_date is None:
            raise HTTPException(status_code=400, detail="schedule_date is required for nro_phase1_scheduled")
        ticket.nro_phase1_scheduled_date = transition.schedule_date
        ticket.nro_phase1_state = "scheduled"
    elif transition.workflow_state == schemas.TicketWorkflowState.nro_phase1_complete_pending_phase2:
        ticket.nro_phase1_completed_at = datetime.now(timezone.utc)
        ticket.nro_phase1_state = "completed"
    elif transition.workflow_state == schemas.TicketWorkflowState.nro_phase1_goback_required:
        ticket.nro_phase1_state = "goback_required"
    elif transition.workflow_state == schemas.TicketWorkflowState.nro_phase2_scheduled:
        if transition.schedule_date is None:
            raise HTTPException(status_code=400, detail="schedule_date is required for nro_phase2_scheduled")
        ticket.nro_phase2_scheduled_date = transition.schedule_date
        ticket.nro_phase2_state = "scheduled"
    elif transition.workflow_state == schemas.TicketWorkflowState.nro_phase2_goback_required:
        ticket.nro_phase2_state = "goback_required"
    elif transition.workflow_state == schemas.TicketWorkflowState.nro_ready_for_completion:
        if ticket.nro_phase1_completed_at is None:
            raise HTTPException(status_code=400, detail="Phase 1 must be completed before marking NRO ready for completion")
        ticket.nro_phase2_completed_at = datetime.now(timezone.utc)
        ticket.nro_phase2_state = "completed"

    _bump_ticket_version(ticket)
    db.commit()
    db.refresh(ticket)

    audit_log(
        db,
        current_user.user_id,
        "workflow_state",
        None,
        transition.workflow_state.value,
        ticket_id,
    )

    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"workflow_transition"}')

    return _normalize_ticket_dt(ticket)

@router.get("/dispatch/queue", response_model=List[schemas.TicketOut], tags=["ticket-workflow"])
def dispatcher_queue(
    queue: str = "all",
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.UserRole.admin.value, models.UserRole.dispatcher.value])),
):
    """
    Dispatcher queue buckets:
    - approval: pending approval tickets
    - needstech: inhouse escalations requiring dispatcher conversion/scheduling
    - goback: tickets requiring go-back scheduling
    - returns: open tickets with follow-up required (temporary expected-returns queue)
    - all: union of above
    """
    safe_skip = max(0, skip)
    safe_limit = max(1, min(limit, 500))
    queue_map = {
        "approval": [
            models.TicketWorkflowState.pending_approval.value,
            models.TicketWorkflowState.nro_ready_for_completion.value,
        ],
        "needstech": [
            models.TicketWorkflowState.needstech.value,
            models.TicketWorkflowState.nro_phase1_complete_pending_phase2.value,
        ],
        "goback": [
            models.TicketWorkflowState.goback_required.value,
            models.TicketWorkflowState.nro_phase1_goback_required.value,
            models.TicketWorkflowState.nro_phase2_goback_required.value,
        ],
        "returns": [models.TicketWorkflowState.followup_required.value],
    }
    selected_states: List[str]
    if queue == "all":
        selected_states = []
        for arr in queue_map.values():
            selected_states.extend(arr)
    elif queue in queue_map:
        selected_states = queue_map[queue]
    else:
        raise HTTPException(status_code=400, detail="Invalid queue value")

    query = db.query(models.Ticket).filter(models.Ticket.workflow_state.in_(selected_states)).order_by(models.Ticket.date_scheduled.asc().nullsfirst(), models.Ticket.created_at.desc())
    items = query.offset(safe_skip).limit(safe_limit).all()
    return [_normalize_ticket_dt(t) for t in items]

@router.get("/{ticket_id}", response_model=schemas.TicketOut)
def get_ticket(
    ticket_id: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific ticket by ID"""
    db_ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _normalize_ticket_dt(db_ticket)

@router.put("/{ticket_id}", response_model=schemas.TicketOut)
def update_ticket(
    ticket_id: str, 
    ticket: schemas.TicketUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user), 
    background_tasks: BackgroundTasks = None
):
    """Update a ticket"""
    prev_ticket = crud.get_ticket(db, ticket_id)
    if not prev_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # RBAC: Only admin/dispatcher or assigned/claimer can update
    user_role = _as_role(current_user.role)
    is_admin_or_dispatcher = user_role in (models.UserRole.admin, models.UserRole.dispatcher)
    is_assigned = prev_ticket.assigned_user_id == current_user.user_id
    is_claimer = (getattr(prev_ticket, 'claimed_by', None) == current_user.user_id)
    if not (is_admin_or_dispatcher or is_assigned or is_claimer):
        raise HTTPException(status_code=403, detail="Not authorized to update this ticket")

    _enforce_ticket_version(ticket.expected_ticket_version, prev_ticket.ticket_version or 1)

    if ticket.status is not None:
        requested = _as_ticket_status(ticket.status)
        prev = _as_ticket_status(prev_ticket.status)
        new_status = _canonicalize_status(requested)
        if requested == schemas.TicketStatus.archived and _as_role(current_user.role) not in (models.UserRole.admin, models.UserRole.dispatcher):
            new_status = schemas.TicketStatus.completed
        ticket.status = new_status.value  # store value consistently as string

    # metadata
    ticket.last_updated_by = current_user.user_id
    ticket.last_updated_at = datetime.now(timezone.utc)
    ticket.ticket_version = (prev_ticket.ticket_version or 1) + 1
    
    try:
        crud.update_ticket(db, ticket_id=ticket_id, ticket=ticket)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not update ticket: {str(e)}")
    
    # Audit comparisons
    if ticket.status is not None and not (prev_ticket.status == ticket.status):
        audit_log(db, current_user.user_id, "status", prev_ticket.status, ticket.status, ticket_id)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"update"}')
    # Refetch with relations to avoid N+1 during TicketOut serialization
    out = crud.get_ticket_for_response(db, ticket_id)
    return _normalize_ticket_dt(out)

@router.patch("/{ticket_id}/status", response_model=schemas.TicketOut)
def update_ticket_status(
    ticket_id: str, 
    status_update: schemas.StatusUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user), 
    background_tasks: BackgroundTasks = None
):
    """Quick endpoint for status changes only"""
    prev_ticket = crud.get_ticket(db, ticket_id)
    
    if not prev_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Handle status change logic
    requested = _as_ticket_status(status_update.status)
    is_admin_or_dispatcher = _as_role(current_user.role) in (models.UserRole.admin, models.UserRole.dispatcher)
    new_status = _canonicalize_status(requested)
    if requested == schemas.TicketStatus.archived and not is_admin_or_dispatcher:
        new_status = schemas.TicketStatus.completed

    ticket_update = schemas.TicketUpdate(
        status=new_status.value,
        last_updated_by=current_user.user_id,
        last_updated_at=datetime.now(timezone.utc),
        ticket_version=(prev_ticket.ticket_version or 1) + 1,
    )
    
    try:
        result = crud.update_ticket(db, ticket_id=ticket_id, ticket=ticket_update)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not update status: {str(e)}")
    
    # Audit log
    if prev_ticket.status != new_status:
        audit_log(db, current_user.user_id, "status", prev_ticket.status, new_status, ticket_id)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"update"}')
    return result

@router.post("/{ticket_id}/approve")
def approve_ticket(
    ticket_id: str, 
    approve: bool, 
    background_tasks: BackgroundTasks = None, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.UserRole.admin.value, models.UserRole.dispatcher.value]))
):
    """Approve or reject a ticket"""
    ticket = crud.get_ticket(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    current = _as_ticket_status(ticket.status)
    if current not in (schemas.TicketStatus.completed, schemas.TicketStatus.closed):
        raise HTTPException(status_code=400, detail="Ticket must be completed or closed before approval")

    from datetime import datetime, timezone
    prev_status = _as_ticket_status(ticket.status)
    ticket.status = (schemas.TicketStatus.archived if approve else schemas.TicketStatus.open).value
    ticket.workflow_state = (models.TicketWorkflowState.ready_to_archive.value if approve else models.TicketWorkflowState.pending_dispatch_review.value)
    ticket.approved_by = current_user.user_id if approve else None
    ticket.approved_at = datetime.now(timezone.utc) if approve else None
    _bump_ticket_version(ticket)
    db.commit()
    db.refresh(ticket)
    # Audit log
    audit_log(db, current_user.user_id, "approval", prev_status, ticket.status, ticket_id)
    _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"approval"}')
    return _normalize_ticket_dt(ticket)

@router.put("/{ticket_id}/claim")
def claim_ticket(
    ticket_id: str,
    claim_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Claim a ticket (for in-house technicians)"""
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Update ticket with claim info - auto-assign to claiming user
    from datetime import datetime, timezone
    ticket.claimed_by = claim_data.get('claimed_by', current_user.user_id)
    ticket.claimed_at = datetime.now(timezone.utc)
    ticket.assigned_user_id = current_user.user_id  # Auto-assign to claimer
    ticket.workflow_state = models.TicketWorkflowState.claimed.value
    # Start timer on claim if not already started
    if not getattr(ticket, 'start_time', None):
        ticket.start_time = datetime.now(timezone.utc)
    ticket.status = models.TicketStatus.open.value
    _bump_ticket_version(ticket)
    
    db.commit()
    db.refresh(ticket)
    
    # Audit log
    audit_log(db, current_user.user_id, "claimed", None, ticket.claimed_by, ticket_id)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"claimed"}')
    
    return _normalize_ticket_dt(ticket)

@router.put("/{ticket_id}/complete")
def complete_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Complete a ticket: stop timer and compute time_spent."""
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Permissions: admin/dispatcher or assigned/claimer can complete
    user_role = _as_role(current_user.role)
    is_admin_or_dispatcher = user_role in (models.UserRole.admin, models.UserRole.dispatcher)
    is_assigned = ticket.assigned_user_id == current_user.user_id
    is_claimer = (getattr(ticket, 'claimed_by', None) == current_user.user_id)
    if not (is_admin_or_dispatcher or is_assigned or is_claimer):
        raise HTTPException(status_code=403, detail="Not authorized to complete this ticket")

    # Stop timer and compute duration (minutes)
    from datetime import timezone as _tz
    now = datetime.now(_tz.utc)
    ticket.end_time = now
    start = getattr(ticket, 'start_time', None) or getattr(ticket, 'claimed_at', None) or getattr(ticket, 'check_in_time', None) or getattr(ticket, 'created_at', None)
    if start is not None:
        # Ensure both aware
        if getattr(start, 'tzinfo', None) is None:
            start = start.replace(tzinfo=_tz.utc)
        duration = now - start
        import math
        seconds = max(0, int(duration.total_seconds()))
        minutes = max(1, math.ceil(seconds / 60)) if seconds > 0 else 0
        ticket.time_spent = minutes

    prev_status = ticket.status
    ticket.status = models.TicketStatus.completed.value
    ticket.workflow_state = models.TicketWorkflowState.pending_approval.value
    _bump_ticket_version(ticket)

    db.commit()
    db.refresh(ticket)

    # Create a time entry for billing based on computed duration
    if ticket.time_spent and ticket.time_spent > 0:
        try:
            entry_dict = {
                'ticket_id': ticket.ticket_id,
                'user_id': current_user.user_id,
                'start_time': start,
                'end_time': now,
                'duration_minutes': ticket.time_spent,
                'description': 'Auto: work duration from claim to complete',
                'is_billable': True,
            }
            crud.create_time_entry(db, entry_dict)
        except Exception:
            pass

    # Audit log
    audit_log(db, current_user.user_id, "status", prev_status, ticket.status, ticket_id)

    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"complete"}')

    return _normalize_ticket_dt(ticket)

@router.put("/{ticket_id}/check-in")
def check_in_ticket(
    ticket_id: str,
    check_in_data: dict = Body(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Field tech check-in at site"""
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Update ticket with check-in info
    from datetime import datetime, timezone
    ticket.check_in_time = datetime.now(timezone.utc)
    ticket.status = models.TicketStatus.open.value
    ticket.workflow_state = models.TicketWorkflowState.onsite.value
    _bump_ticket_version(ticket)
    
    db.commit()
    db.refresh(ticket)
    
    # Audit log
    audit_log(db, current_user.user_id, "check_in", None, str(ticket.check_in_time), ticket_id)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"check_in"}')
    
    return ticket

@router.put("/{ticket_id}/check-out")
def check_out_ticket(
    ticket_id: str,
    check_out_data: dict = Body(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Field tech check-out from site"""
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Update ticket with check-out info
    from datetime import datetime, timezone
    ticket.check_out_time = datetime.now(timezone.utc)
    
    # Calculate onsite duration if check-in exists
    if ticket.check_in_time:
        # Ensure both datetimes are timezone-aware for comparison
        check_in = ticket.check_in_time
        if check_in.tzinfo is None:
            # Make timezone-naive datetime aware (assume UTC)
            check_in = check_in.replace(tzinfo=timezone.utc)
        
        duration = ticket.check_out_time - check_in
        duration_minutes = int(duration.total_seconds() / 60)
        ticket.onsite_duration_minutes = duration_minutes
        # Also set time_spent so it displays in the frontend
        ticket.time_spent = duration_minutes
    
    ticket.status = models.TicketStatus.open.value
    ticket.workflow_state = models.TicketWorkflowState.offsite.value
    _bump_ticket_version(ticket)
    
    db.commit()
    db.refresh(ticket)
    
    # Audit log
    audit_log(db, current_user.user_id, "check_out", None, str(ticket.check_out_time), ticket_id)
    
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"check_out"}')
    
    return ticket

@router.delete("/{ticket_id}")
def delete_ticket(
    ticket_id: str, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.UserRole.admin.value, models.UserRole.dispatcher.value])), 
    background_tasks: BackgroundTasks = None
):
    """Delete a ticket"""
    try:
        result = crud.delete_ticket(db, ticket_id=ticket_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not delete ticket: {str(e)}")
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"delete"}')
    if not result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"success": True, "message": "Ticket deleted"}

# ============================
# Bulk operations
# ============================

@router.post("/bulk/status", response_model=List[schemas.TicketOut])
def bulk_update_ticket_status(
    payload: schemas.BulkTicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Bulk update status for multiple tickets"""
    updated: List[models.Ticket] = []
    user_role = _as_role(current_user.role)
    is_admin_or_dispatcher = user_role in (models.UserRole.admin, models.UserRole.dispatcher)

    requested = _as_ticket_status(payload.status)
    for tid in payload.ticket_ids:
        t = crud.get_ticket(db, tid)
        if not t:
            continue
        # Permission: same as single update - only admin/dispatcher can close
        new_status = requested if not (requested == schemas.TicketStatus.closed and not is_admin_or_dispatcher) else schemas.TicketStatus.pending
        ticket_update = schemas.TicketUpdate(
            status=new_status.value,
            last_updated_by=current_user.user_id,
            last_updated_at=datetime.now(timezone.utc),
        )
        try:
            res = crud.update_ticket(db, ticket_id=tid, ticket=ticket_update)
        except Exception:
            res = None
        if res:
            if getattr(t, 'status', None) != new_status.value:
                audit_log(db, current_user.user_id, "status", getattr(t, 'status', None), new_status, tid)
            updated.append(res)

    if background_tasks and updated:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"bulk_status"}')
    return updated

@router.get("/daily/{date_str}")
def get_daily_tickets(
    date_str: str,
    ticket_type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get tickets for daily operations dashboard"""
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    tickets = crud.get_daily_tickets(
        db, 
        date=date_obj, 
        ticket_type=ticket_type, 
        priority=priority, 
        status=status, 
        assigned_user_id=assigned_user_id
    )
    return tickets

@router.put("/{ticket_id}/costs")
def update_ticket_costs(
    ticket_id: str,
    cost_data: schemas.TicketCostUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Update ticket cost information"""
    result = crud.update_ticket_costs(db, ticket_id, cost_data.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"ticket","action":"costs_updated"}')
    
    return result

# ============================================================================
# COMMENTS ENDPOINTS
# ============================================================================

@router.get("/{ticket_id}/comments")
def get_ticket_comments(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all comments for a ticket"""
    # Verify ticket exists
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    comments = crud.get_comments_by_ticket(db, ticket_id=ticket_id)
    return comments

@router.post("/{ticket_id}/comments")
def create_comment(
    ticket_id: str,
    comment_data: schemas.TicketCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Create a comment on a ticket"""
    # Verify ticket exists
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Create comment with user info
    comment_dict = comment_data.model_dump()
    comment_dict['ticket_id'] = ticket_id
    comment_dict['user_id'] = current_user.user_id
    
    result = crud.create_ticket_comment(db, comment_dict)
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"comment","action":"create"}')
    
    return result

@router.put("/{ticket_id}/comments/{comment_id}")
def update_comment(
    ticket_id: str,
    comment_id: str,
    comment_data: schemas.TicketCommentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Update a comment"""
    # Verify comment exists and belongs to ticket
    comment = crud.get_ticket_comment(db, comment_id=comment_id)
    if not comment or comment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Only allow user to edit their own comments (or admin)
    if comment.user_id != current_user.user_id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    
    result = crud.update_ticket_comment(db, comment_id=comment_id, comment_data=comment_data.model_dump(exclude_unset=True))
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"comment","action":"update"}')
    
    return result

@router.delete("/{ticket_id}/comments/{comment_id}")
def delete_comment(
    ticket_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Delete a comment"""
    # Verify comment exists and belongs to ticket
    comment = crud.get_ticket_comment(db, comment_id=comment_id)
    if not comment or comment.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Only allow user to delete their own comments (or admin)
    if comment.user_id != current_user.user_id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    crud.delete_ticket_comment(db, comment_id=comment_id)
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"comment","action":"delete"}')
    
    return {"success": True, "message": "Comment deleted successfully"}

# ============================================================================
# TIME ENTRIES ENDPOINTS
# ============================================================================

@router.get("/{ticket_id}/time-entries/")
def get_ticket_time_entries(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all time entries for a ticket"""
    # Verify ticket exists
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    time_entries = crud.get_time_entries_by_ticket(db, ticket_id=ticket_id)
    return time_entries

@router.post("/{ticket_id}/time-entries/")
def create_time_entry(
    ticket_id: str,
    entry_data: schemas.TimeEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Create a time entry for a ticket"""
    # Verify ticket exists
    ticket = crud.get_ticket(db, ticket_id=ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Create time entry with user and ticket info
    entry_dict = entry_data.model_dump()
    entry_dict['ticket_id'] = ticket_id
    entry_dict['user_id'] = current_user.user_id
    
    result = crud.create_time_entry(db, entry_dict)
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"time_entry","action":"create"}')
    
    return result

@router.put("/{ticket_id}/time-entries/{entry_id}")
def update_time_entry(
    ticket_id: str,
    entry_id: str,
    entry_data: schemas.TimeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Update a time entry"""
    # Verify time entry exists and belongs to ticket
    entry = crud.get_time_entry(db, entry_id=entry_id)
    if not entry or entry.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    # Only allow user to edit their own entries (or admin)
    if entry.user_id != current_user.user_id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to edit this time entry")
    
    result = crud.update_time_entry(db, entry_id=entry_id, time_entry_data=entry_data.model_dump(exclude_unset=True))
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"time_entry","action":"update"}')
    
    return result

@router.delete("/{ticket_id}/time-entries/{entry_id}")
def delete_time_entry(
    ticket_id: str,
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None
):
    """Delete a time entry"""
    # Verify time entry exists and belongs to ticket
    entry = crud.get_time_entry(db, entry_id=entry_id)
    if not entry or entry.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    # Only allow user to delete their own entries (or admin)
    if entry.user_id != current_user.user_id and current_user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this time entry")
    
    crud.delete_time_entry(db, entry_id=entry_id)
    
    # Broadcast update
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"time_entry","action":"delete"}')
    
    return {"success": True, "message": "Time entry deleted successfully"}

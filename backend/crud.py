from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import and_, or_, desc, asc, case, update, func, text
import models, schemas
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

# =============================================================================
# OPTIMIZED CRUD OPERATIONS WITH PROPER EAGER LOADING
# =============================================================================

# User CRUD - Optimized
def create_user(db: Session, user):
    """Create user - accepts both UserCreate and AdminUserCreate schemas"""
    db_user = models.User(
        user_id=str(uuid.uuid4()),
        name=user.name,
        email=user.email,
        role=user.role,
        phone=user.phone,
        # region removed
        preferences=user.preferences,
        hashed_password=getattr(user, 'hashed_password', None),
        must_change_password=getattr(user, 'must_change_password', False),
        active=getattr(user, 'active', True)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: str):
    """Get user with optimized query"""
    return db.query(models.User).filter(models.User.user_id == user_id).first()

def get_user_by_email(db: Session, email: str):
    """Get user by email using case-insensitive match with functional index support"""
    if not email:
        return None
    return db.query(models.User).filter(func.lower(models.User.email) == email.lower()).first()

def get_users(db: Session, skip: int = 0, limit: int = 100, include_inactive: bool = True):
    """Get users with pagination; default includes inactive"""
    query = db.query(models.User)
    if not include_inactive:
        query = query.filter(models.User.active == True)
    return query.order_by(models.User.name.asc()).offset(skip).limit(limit).all()

def update_user(db: Session, user_id: str, user):
    """Update user - accepts both UserCreate and AdminUserCreate schemas"""
    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        return None
    
    # Update fields
    db_user.name = user.name
    db_user.email = user.email
    db_user.role = user.role
    db_user.phone = user.phone
    # region removed
    db_user.preferences = user.preferences
    if hasattr(user, 'active') and user.active is not None:
        db_user.active = user.active
    
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: str):
    """Soft delete user by setting active=False (historical integrity preserved)"""
    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        return None
    db_user.active = False
    db.commit()
    db.refresh(db_user)
    return db_user

# Site CRUD - Optimized

# ------------------------------
# Normalization helpers (state -> abbr, region, timezone label)
# ------------------------------
STATE_NAME_TO_ABBR = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'DISTRICT OF COLUMBIA': 'DC', 'WASHINGTON DC': 'DC', 'DC': 'DC',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN',
    'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND',
    'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI',
    'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
}

REGION_BY_ABBR = {
    'Northeast': {'ME','NH','VT','MA','RI','CT','NY','NJ','PA'},
    'Midwest': {'OH','MI','IN','IL','WI','MN','IA','MO','ND','SD','NE','KS'},
    'South': {'DE','MD','DC','VA','WV','NC','SC','GA','FL','KY','TN','MS','AL','AR','LA','OK','TX'},
    'West': {'MT','ID','WY','CO','NM','AZ','UT','NV','CA','OR','WA','AK','HI'},
}

TZ_LABEL_BY_ABBR = {
    # Eastern
    **{abbr: 'Eastern' for abbr in ['CT','DE','DC','FL','GA','ME','MD','MA','MI','NH','NJ','NY','NC','OH','PA','RI','SC','VT','VA','WV','KY']},
    # Central
    **{abbr: 'Central' for abbr in ['AL','AR','IL','IA','LA','MN','MS','MO','OK','WI','TX','KS','NE','SD','ND','TN']},
    # Mountain
    **{abbr: 'Mountain' for abbr in ['AZ','CO','ID','MT','NM','UT','WY']},
    # Pacific (also map AK and HI to Pacific per simplified labeling)
    **{abbr: 'Pacific' for abbr in ['CA','NV','OR','WA','AK','HI']},
}

def _to_abbr(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    s = str(state).strip()
    if len(s) == 2:
        return s.upper()
    return STATE_NAME_TO_ABBR.get(s.upper(), s[:2].upper())

def _region_for(abbr: Optional[str]) -> Optional[str]:
    if not abbr:
        return None
    for name, group in REGION_BY_ABBR.items():
        if abbr in group:
            return name
    return None

def _tz_label_for(abbr: Optional[str]) -> Optional[str]:
    if not abbr:
        return None
    return TZ_LABEL_BY_ABBR.get(abbr)
def create_site(db: Session, site: schemas.SiteCreate):
    """Create site with optimized query"""
    abbr = _to_abbr(site.state)
    region = site.region or _region_for(abbr)
    tz_label = site.timezone or _tz_label_for(abbr)
    db_site = models.Site(
        site_id=site.site_id,
        ip_address=site.ip_address,
        location=site.location,
        brand=site.brand,
        main_number=site.main_number,
        mp=site.mp,
        service_address=site.service_address,
        city=site.city,
        state=abbr or site.state,
        zip=site.zip,
        region=region,
        timezone=tz_label,
        notes=site.notes,
        equipment_notes=site.equipment_notes,
        phone_system=site.phone_system,
        phone_types=site.phone_types,
        network_equipment=site.network_equipment,
        additional_equipment=site.additional_equipment
    )
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

def get_site(db: Session, site_id: str):
    """Get site with related data eager loaded"""
    return db.query(models.Site).options(
        selectinload(models.Site.tickets),
        selectinload(models.Site.shipments),
        selectinload(models.Site.equipment),
        selectinload(models.Site.site_equipment)
    ).filter(models.Site.site_id == site_id).first()

def get_sites(db: Session, skip: int = 0, limit: int = 100, region: Optional[str] = None, search: Optional[str] = None):
    """Get sites with pagination, optional region and search filtering"""
    query = db.query(models.Site)
    if region:
        query = query.filter(models.Site.region == region)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                models.Site.site_id.ilike(like),
                models.Site.location.ilike(like),
                models.Site.city.ilike(like),
                models.Site.state.ilike(like),
                models.Site.brand.ilike(like),
                models.Site.ip_address.ilike(like),
            )
        )
        # Prioritize prefix matches on site_id for better Autocomplete behavior
        prefix = f"{search}%"
        order_first = case((models.Site.site_id.ilike(prefix), 0), else_=1)
        return query.order_by(order_first.asc(), models.Site.site_id.asc()).offset(skip).limit(limit).all()
    return query.order_by(models.Site.site_id.asc()).offset(skip).limit(limit).all()

def count_sites(db: Session, region: Optional[str] = None, search: Optional[str] = None) -> int:
    """Count sites with optional filters"""
    query = db.query(models.Site)
    if region:
        query = query.filter(models.Site.region == region)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                models.Site.site_id.ilike(like),
                models.Site.location.ilike(like),
                models.Site.city.ilike(like),
                models.Site.state.ilike(like),
                models.Site.brand.ilike(like),
                models.Site.ip_address.ilike(like),
            )
        )
    return query.count()

def update_site(db: Session, site_id: str, site: schemas.SiteCreate):
    """Update site with optimized query"""
    db_site = db.query(models.Site).filter(models.Site.site_id == site_id).first()
    if not db_site:
        return None
    
    # Update all fields
    for field, value in site.model_dump().items():
        if hasattr(db_site, field) and value is not None:
            setattr(db_site, field, value)
    # Normalize dependent fields after applying incoming values
    db_site.state = _to_abbr(db_site.state) or db_site.state
    db_site.region = _region_for(db_site.state) or db_site.region
    db_site.timezone = _tz_label_for(db_site.state) or db_site.timezone
    
    db.commit()
    db.refresh(db_site)
    return db_site

def delete_site(db: Session, site_id: str):
    """Delete site (check for dependencies first)"""
    db_site = db.query(models.Site).filter(models.Site.site_id == site_id).first()
    if not db_site:
        return None
    
    # Clean up dependencies to avoid FK constraint errors
    # 1) Delete equipment and site_equipment
    db.query(models.Equipment).filter(models.Equipment.site_id == site_id).delete(synchronize_session=False)
    db.query(models.SiteEquipment).filter(models.SiteEquipment.site_id == site_id).delete(synchronize_session=False)
    # 2) Delete shipments (and inventory transactions linked via shipment_items)
    shipment_ids = [s.shipment_id for s in db.query(models.Shipment).filter(models.Shipment.site_id == site_id).all()]
    if shipment_ids:
        shipment_items = db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_id.in_(shipment_ids)).all()
        shipment_item_ids = [si.shipment_item_id for si in shipment_items]
        if shipment_item_ids:
            db.query(models.InventoryTransaction).filter(models.InventoryTransaction.shipment_item_id.in_(shipment_item_ids)).delete(synchronize_session=False)
        db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_id.in_(shipment_ids)).delete(synchronize_session=False)
        db.query(models.Shipment).filter(models.Shipment.shipment_id.in_(shipment_ids)).delete(synchronize_session=False)
    # 3) Delete tickets and their children
    ticket_ids = [t.ticket_id for t in db.query(models.Ticket).filter(models.Ticket.site_id == site_id).all()]
    for tid in ticket_ids:
        # Reuse delete_ticket logic
        delete_ticket(db, tid)
    
    db.delete(db_site)
    db.commit()
    return db_site

# Ticket CRUD - Highly Optimized
# =============================================================================
# ID GENERATION FUNCTIONS
# =============================================================================

def generate_ticket_id(db: Session) -> str:
    """Generate a sequential ticket ID in format: YYYY-NNNNNN. Uses advisory lock to prevent duplicate IDs under concurrent create."""
    from datetime import datetime, timezone
    
    current_year = datetime.now(timezone.utc).year
    year_prefix = str(current_year)
    # Advisory lock key per year so concurrent creates for same year serialize on ID generation
    lock_key = 1000000 + current_year
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})
    
    # Get the highest ticket number for this year
    latest_ticket = db.query(models.Ticket).filter(
        models.Ticket.ticket_id.like(f"{year_prefix}-%")
    ).order_by(models.Ticket.ticket_id.desc()).first()
    
    if latest_ticket:
        # Extract the number part and increment
        try:
            last_number = int(latest_ticket.ticket_id.split('-')[1])
            new_number = last_number + 1
        except (ValueError, IndexError):
            new_number = 1
    else:
        # First ticket of the year
        new_number = 1
    
    # Format: YYYY-NNNNNN (6 digits, can handle up to 999,999 tickets per year)
    ticket_id = f"{year_prefix}-{new_number:06d}"
    
    return ticket_id

def generate_sequential_id(db: Session, model, id_field: str, prefix: str, digits: int = 6) -> str:
    """
    Generate a sequential ID with prefix: PREFIX-NNNNNN
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        id_field: Name of the ID field (e.g., 'shipment_id')
        prefix: Prefix for the ID (e.g., 'SHIP')
        digits: Number of digits for the counter (default 6)
    
    Returns:
        Sequential ID string (e.g., 'SHIP-000001')
    """
    # Get the highest ID with this prefix
    latest = db.query(model).filter(
        getattr(model, id_field).like(f"{prefix}-%")
    ).order_by(getattr(model, id_field).desc()).first()
    
    if latest:
        # Extract the number part and increment
        try:
            current_id = getattr(latest, id_field)
            last_number = int(current_id.split('-')[1])
            new_number = last_number + 1
        except (ValueError, IndexError):
            new_number = 1
    else:
        # First ID with this prefix
        new_number = 1
    
    # Format: PREFIX-NNNNNN
    new_id = f"{prefix}-{new_number:0{digits}d}"
    
    return new_id

def create_ticket(db: Session, ticket: schemas.TicketCreate):
    """Create ticket with optimized query"""
    from timezone_utils import get_eastern_today
    
    db_ticket = models.Ticket(
        ticket_id=generate_ticket_id(db),
        site_id=ticket.site_id,
        inc_number=ticket.inc_number,
        so_number=ticket.so_number,
        type=ticket.type,
        status=ticket.status,
        workflow_state=(ticket.workflow_state.value if getattr(ticket.workflow_state, "value", None) else (ticket.workflow_state or models.TicketWorkflowState.new.value)),
        ticket_version=(ticket.ticket_version or 1),
        priority=ticket.priority,
        category=ticket.category,
        assigned_user_id=ticket.assigned_user_id,
        onsite_tech_id=ticket.onsite_tech_id,
        date_created=ticket.date_created or get_eastern_today(),
        date_scheduled=ticket.date_scheduled,
        date_closed=ticket.date_closed,
        time_spent=ticket.time_spent,
        notes=ticket.notes,
        color_flag=ticket.color_flag,
        special_flag=ticket.special_flag,
        last_updated_by=ticket.last_updated_by,
        last_updated_at=ticket.last_updated_at,
        created_by=getattr(ticket, "created_by", None),
        # New Ticket Type System Fields
        claimed_by=ticket.claimed_by,
        claimed_at=ticket.claimed_at,
        check_in_time=ticket.check_in_time,
        check_out_time=ticket.check_out_time,
        onsite_duration_minutes=ticket.onsite_duration_minutes,
        billing_rate=ticket.billing_rate,
        total_cost=ticket.total_cost,
        # Enhanced Workflow Fields
        estimated_hours=ticket.estimated_hours,
        actual_hours=ticket.actual_hours,
        start_time=ticket.start_time,
        end_time=ticket.end_time,
        is_billable=ticket.is_billable,
        requires_approval=ticket.requires_approval,
        approved_by=ticket.approved_by,
        approved_at=ticket.approved_at,
        rejection_reason=ticket.rejection_reason,
        # Enhanced SLA Management Fields
        sla_target_hours=ticket.sla_target_hours,
        sla_breach_hours=ticket.sla_breach_hours,
        first_response_time=ticket.first_response_time,
        resolution_time=ticket.resolution_time,
        escalation_level=ticket.escalation_level,
        escalation_notified=ticket.escalation_notified,
        customer_impact=ticket.customer_impact,
        business_priority=ticket.business_priority,
        # New Workflow Fields
        workflow_step=ticket.workflow_step,
        next_action_required=ticket.next_action_required,
        due_date=ticket.due_date,
        nro_phase1_scheduled_date=ticket.nro_phase1_scheduled_date,
        nro_phase1_completed_at=ticket.nro_phase1_completed_at,
        nro_phase1_state=ticket.nro_phase1_state,
        nro_phase2_scheduled_date=ticket.nro_phase2_scheduled_date,
        nro_phase2_completed_at=ticket.nro_phase2_completed_at,
        nro_phase2_state=ticket.nro_phase2_state,
        is_urgent=ticket.is_urgent,
        is_vip=ticket.is_vip,
        customer_name=ticket.customer_name,
        customer_phone=ticket.customer_phone,
        customer_email=ticket.customer_email,
        # Equipment and Parts
        equipment_affected=ticket.equipment_affected,
        parts_needed=ticket.parts_needed,
        parts_ordered=ticket.parts_ordered,
        parts_received=ticket.parts_received,
        # Quality and Follow-up
        quality_score=ticket.quality_score,
        customer_satisfaction=ticket.customer_satisfaction,
        tech_rating=ticket.tech_rating,
        follow_up_required=ticket.follow_up_required,
        follow_up_date=ticket.follow_up_date,
        follow_up_notes=ticket.follow_up_notes
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def get_ticket(db: Session, ticket_id: str):
    """Get ticket with all related data eager loaded"""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech),
        joinedload(models.Ticket.claimed_user),
        joinedload(models.Ticket.approved_user),
        selectinload(models.Ticket.comments).joinedload(models.TicketComment.user),
        selectinload(models.Ticket.time_entries),
        selectinload(models.Ticket.attachments),
        selectinload(models.Ticket.tasks),
        selectinload(models.Ticket.audits).joinedload(models.TicketAudit.user)
    ).filter(models.Ticket.ticket_id == ticket_id).first()

def get_ticket_for_response(db: Session, ticket_id: str):
    """Lightweight load for create/update response: only relations needed by TicketOut (avoids N+1)."""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech),
        joinedload(models.Ticket.claimed_user),
    ).filter(models.Ticket.ticket_id == ticket_id).first()

def _apply_ticket_list_filters(query, status, workflow_state, priority, assigned_user_id, site_id, ticket_type, search):
    """Apply common ticket list/count filters. Returns the modified query."""
    if status:
        if status == 'active':
            query = query.filter(~models.Ticket.status.in_([
                models.TicketStatus.completed,
                models.TicketStatus.closed,
                models.TicketStatus.approved,
                models.TicketStatus.archived,
            ]))
        else:
            try:
                enum_status = models.TicketStatus(status)
                query = query.filter(models.Ticket.status == enum_status)
            except Exception:
                query = query.filter(models.Ticket.status == status)
    if workflow_state:
        query = query.filter(models.Ticket.workflow_state == workflow_state)
    if priority:
        query = query.filter(models.Ticket.priority == priority)
    if assigned_user_id:
        query = query.filter(models.Ticket.assigned_user_id == assigned_user_id)
    if site_id:
        query = query.filter(models.Ticket.site_id == site_id)
    if ticket_type:
        query = query.filter(models.Ticket.type == ticket_type)
    if search:
        clean = search.strip()
        like_any = f"%{clean}%"
        like_prefix = f"{clean}%"
        query = query.filter(or_(
            models.Ticket.ticket_id.ilike(like_prefix),
            models.Ticket.site_id.ilike(like_prefix),
            models.Ticket.inc_number.ilike(like_prefix),
            models.Ticket.so_number.ilike(like_prefix),
            models.Ticket.notes.ilike(like_any)
        ))
    return query


def get_tickets(db: Session, skip: int = 0, limit: int = 100, 
                status: Optional[str] = None, 
                workflow_state: Optional[str] = None,
                priority: Optional[str] = None,
                assigned_user_id: Optional[str] = None,
                site_id: Optional[str] = None,
                ticket_type: Optional[str] = None,
                search: Optional[str] = None,
                include_related: bool = True):
    """Get tickets with comprehensive filtering and eager loading"""
    query = db.query(models.Ticket)
    if include_related:
        query = query.options(
            joinedload(models.Ticket.site),
            joinedload(models.Ticket.assigned_user),
            joinedload(models.Ticket.claimed_user),
            joinedload(models.Ticket.onsite_tech)
        )
    query = _apply_ticket_list_filters(query, status, workflow_state, priority, assigned_user_id, site_id, ticket_type, search)
    return query.order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

def count_tickets(db: Session,
                  status: Optional[str] = None,
                  workflow_state: Optional[str] = None,
                  priority: Optional[str] = None,
                  assigned_user_id: Optional[str] = None,
                  site_id: Optional[str] = None,
                  ticket_type: Optional[str] = None,
                  search: Optional[str] = None) -> int:
    query = db.query(models.Ticket)
    query = _apply_ticket_list_filters(query, status, workflow_state, priority, assigned_user_id, site_id, ticket_type, search)
    return query.count()


def update_ticket(db: Session, ticket_id: str, ticket: schemas.TicketUpdate):
    """Update ticket with optimized query"""
    db_ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not db_ticket:
        return None
    
    # Update fields dynamically
    for field, value in ticket.model_dump(exclude_unset=True).items():
        if hasattr(db_ticket, field) and value is not None:
            setattr(db_ticket, field, value)
    
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def delete_ticket(db: Session, ticket_id: str):
    """Delete ticket with optimized cascade deletion"""
    db_ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not db_ticket:
        return None
    
    # Manually delete dependent rows to satisfy FK constraints (DB may not have ON DELETE CASCADE)
    # Order matters to avoid FK issues
    db.query(models.TicketAttachment).filter(models.TicketAttachment.ticket_id == ticket_id).delete(synchronize_session=False)
    db.query(models.TicketComment).filter(models.TicketComment.ticket_id == ticket_id).delete(synchronize_session=False)
    db.query(models.TimeEntry).filter(models.TimeEntry.ticket_id == ticket_id).delete(synchronize_session=False)
    db.query(models.Task).filter(models.Task.ticket_id == ticket_id).delete(synchronize_session=False)
    db.query(models.InventoryTransaction).filter(models.InventoryTransaction.ticket_id == ticket_id).delete(synchronize_session=False)
    # Delete audits last referencing this ticket
    db.query(models.TicketAudit).filter(models.TicketAudit.ticket_id == ticket_id).delete(synchronize_session=False)
    # Detach shipments linked to this ticket by nullifying the foreign key
    # Deleting shipments can violate FKs from inventory transactions that reference shipments
    db.query(models.Shipment).filter(models.Shipment.ticket_id == ticket_id).update({"ticket_id": None}, synchronize_session=False)
    # (moved above) audits already deleted

    # Finally delete the ticket using a bulk delete to avoid ORM relationship updates
    try:
        db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return db_ticket

# Shipment CRUD - Optimized
def create_shipment(db: Session, shipment: schemas.ShipmentCreate):
    """Create shipment with optimized query"""
    db_shipment = models.Shipment(
        shipment_id=generate_sequential_id(db, models.Shipment, 'shipment_id', 'SHIP', 6),
        site_id=shipment.site_id,
        ticket_id=shipment.ticket_id,
        item_id=shipment.item_id,
        what_is_being_shipped=shipment.what_is_being_shipped,
        shipping_preference=shipment.shipping_preference,
        charges_out=shipment.charges_out,
        charges_in=shipment.charges_in,
        tracking_number=shipment.tracking_number,
        return_tracking=shipment.return_tracking,
        date_shipped=shipment.date_shipped,
        date_returned=shipment.date_returned,
        notes=shipment.notes,
        source_ticket_type=shipment.source_ticket_type,
        shipping_priority=shipment.shipping_priority,
        parts_cost=shipment.parts_cost,
        total_cost=shipment.total_cost,
        status=shipment.status,
        quantity=shipment.quantity or 1,
        archived=shipment.archived or False,
        remove_from_inventory=shipment.remove_from_inventory,
        date_created=datetime.now(timezone.utc)
    )
    db.add(db_shipment)
    db.commit()
    db.refresh(db_shipment)
    return db_shipment

def get_shipment(db: Session, shipment_id: str):
    """Get shipment with related data eager loaded"""
    return db.query(models.Shipment).options(
        joinedload(models.Shipment.site),
        joinedload(models.Shipment.ticket),
        joinedload(models.Shipment.item),
        selectinload(models.Shipment.shipment_items).joinedload(models.ShipmentItem.item)
    ).filter(models.Shipment.shipment_id == shipment_id).first()

def get_shipments(db: Session, skip: int = 0, limit: int = 100, 
                  site_id: Optional[str] = None,
                  ticket_id: Optional[str] = None,
                  search: Optional[str] = None):
    """Get shipments with filtering and eager loading"""
    query = db.query(models.Shipment).options(
        joinedload(models.Shipment.site),
        joinedload(models.Shipment.ticket)
    )
    
    if site_id:
        query = query.filter(models.Shipment.site_id == site_id)
    if ticket_id:
        query = query.filter(models.Shipment.ticket_id == ticket_id)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            models.Shipment.shipment_id.ilike(like),
            models.Shipment.tracking_number.ilike(like),
            models.Shipment.return_tracking.ilike(like),
            models.Shipment.what_is_being_shipped.ilike(like),
            models.Shipment.site_id.ilike(like)
        ))
    
    return query.order_by(desc(models.Shipment.date_created)).offset(skip).limit(limit).all()

def count_shipments(db: Session,
                    site_id: Optional[str] = None,
                    ticket_id: Optional[str] = None,
                    search: Optional[str] = None,
                    include_archived: bool = True) -> int:
    query = db.query(models.Shipment)
    if site_id:
        query = query.filter(models.Shipment.site_id == site_id)
    if ticket_id:
        query = query.filter(models.Shipment.ticket_id == ticket_id)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            models.Shipment.shipment_id.ilike(like),
            models.Shipment.tracking_number.ilike(like),
            models.Shipment.return_tracking.ilike(like),
            models.Shipment.what_is_being_shipped.ilike(like),
            models.Shipment.site_id.ilike(like)
        ))
    if not include_archived:
        query = query.filter(models.Shipment.archived.is_(False))
    return query.count()

def get_shipments_by_site(db: Session, site_id: str):
    """Get all shipments for a specific site with eager loading"""
    return db.query(models.Shipment).options(
        joinedload(models.Shipment.ticket)
    ).filter(models.Shipment.site_id == site_id).order_by(desc(models.Shipment.date_created)).all()

def update_shipment(db: Session, shipment_id: str, shipment: schemas.ShipmentCreate):
    """Update shipment with optimized query"""
    db_shipment = db.query(models.Shipment).filter(models.Shipment.shipment_id == shipment_id).first()
    if not db_shipment:
        return None
    
    # Update fields dynamically
    for field, value in shipment.model_dump(exclude_unset=True).items():
        if hasattr(db_shipment, field) and value is not None:
            setattr(db_shipment, field, value)
    
    db.commit()
    db.refresh(db_shipment)
    return db_shipment

def archive_shipment(db: Session, shipment_id: str, archived: bool = True):
    """Archive or unarchive a shipment"""
    shipment = db.query(models.Shipment).filter(models.Shipment.shipment_id == shipment_id).first()
    if not shipment:
        return None
    
    shipment.archived = archived
    db.commit()
    db.refresh(shipment)
    return shipment

def delete_shipment(db: Session, shipment_id: str):
    """Delete shipment with cascade delete of shipment items and related transactions"""
    db_shipment = db.query(models.Shipment).filter(models.Shipment.shipment_id == shipment_id).first()
    if not db_shipment:
        return None
    
    # Get all shipment items for this shipment
    shipment_items = db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_id == shipment_id).all()
    
    # Delete inventory transactions that reference these shipment items
    for item in shipment_items:
        db.query(models.InventoryTransaction).filter(
            models.InventoryTransaction.shipment_item_id == item.shipment_item_id
        ).delete()
    
    # Delete shipment items (this will cascade due to foreign key constraints)
    db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_id == shipment_id).delete()
    
    # Finally delete the shipment
    db.delete(db_shipment)
    db.commit()
    return db_shipment

# Shipment Item CRUD
def create_shipment_item(db: Session, shipment_item: schemas.ShipmentItemCreate, shipment_id: str):
    """Create shipment item"""
    db_shipment_item = models.ShipmentItem(
        shipment_item_id=generate_sequential_id(db, models.ShipmentItem, 'shipment_item_id', 'SI', 6),
        shipment_id=shipment_id,
        item_id=shipment_item.item_id,
        quantity=shipment_item.quantity,
        what_is_being_shipped=shipment_item.what_is_being_shipped,
        remove_from_inventory=shipment_item.remove_from_inventory,
        notes=shipment_item.notes
    )
    db.add(db_shipment_item)
    db.commit()
    db.refresh(db_shipment_item)
    return db_shipment_item

def get_shipment_items(db: Session, shipment_id: str):
    """Get all items for a shipment"""
    return db.query(models.ShipmentItem).options(
        joinedload(models.ShipmentItem.item)
    ).filter(models.ShipmentItem.shipment_id == shipment_id).all()

def update_shipment_item(db: Session, shipment_item_id: str, shipment_item: schemas.ShipmentItemCreate):
    """Update shipment item"""
    db_shipment_item = db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_item_id == shipment_item_id).first()
    if not db_shipment_item:
        return None
    
    for field, value in shipment_item.model_dump(exclude_unset=True).items():
        setattr(db_shipment_item, field, value)
    
    db.commit()
    db.refresh(db_shipment_item)
    return db_shipment_item

def delete_shipment_item(db: Session, shipment_item_id: str):
    """Delete shipment item"""
    db_shipment_item = db.query(models.ShipmentItem).filter(models.ShipmentItem.shipment_item_id == shipment_item_id).first()
    if not db_shipment_item:
        return None
    
    db.delete(db_shipment_item)
    db.commit()
    return db_shipment_item

# Field Tech Company CRUD
def create_field_tech_company(db: Session, company: schemas.FieldTechCompanyCreate):
    """Create company; region derived from state."""
    from region_utils import state_to_region
    region = state_to_region(company.state) if company.state else company.region
    company_id = generate_sequential_id(db, models.FieldTechCompany, 'company_id', 'FTC', 6)
    db_company = models.FieldTechCompany(
        company_id=company_id,
        company_name=company.company_name,
        company_number=company.company_number,
        business_phone=company.business_phone,
        other_phones=company.other_phones,
        address=company.address,
        city=company.city,
        state=company.state,
        zip=company.zip,
        region=region or company.region,
        notes=company.notes,
        service_radius_miles=company.service_radius_miles,
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def get_field_tech_company(db: Session, company_id: str):
    """Get company with techs."""
    return db.query(models.FieldTechCompany).options(
        selectinload(models.FieldTechCompany.techs)
    ).filter(models.FieldTechCompany.company_id == company_id).first()

def get_field_tech_companies(db: Session, skip: int = 0, limit: int = 100, region: Optional[str] = None, state: Optional[str] = None, city: Optional[str] = None, include_techs: bool = False):
    """List companies with optional region/state/city filter for map."""
    query = db.query(models.FieldTechCompany)
    if include_techs:
        query = query.options(selectinload(models.FieldTechCompany.techs))
    if region:
        query = query.filter(models.FieldTechCompany.region == region)
    if state:
        query = query.filter(models.FieldTechCompany.state == state)
    if city:
        query = query.filter(func.lower(models.FieldTechCompany.city) == city.lower())
    return query.order_by(models.FieldTechCompany.company_name).offset(skip).limit(limit).all()

def update_field_tech_company(db: Session, company_id: str, company: schemas.FieldTechCompanyCreate):
    """Update company; region derived from state."""
    from region_utils import state_to_region
    db_company = db.query(models.FieldTechCompany).filter(models.FieldTechCompany.company_id == company_id).first()
    if not db_company:
        return None
    data = company.model_dump(exclude_unset=True)
    region = state_to_region(data.get('state') or db_company.state)
    if region:
        data['region'] = region
    for field, value in data.items():
        if hasattr(db_company, field):
            setattr(db_company, field, value)
    db.commit()
    db.refresh(db_company)
    return db_company

def delete_field_tech_company(db: Session, company_id: str):
    """Delete company only if no techs."""
    db_company = db.query(models.FieldTechCompany).filter(models.FieldTechCompany.company_id == company_id).first()
    if not db_company:
        return None
    tech_count = db.query(models.FieldTech).filter(models.FieldTech.company_id == company_id).count()
    if tech_count > 0:
        raise ValueError(f"Cannot delete company with {tech_count} techs. Remove or reassign techs first.")
    db.delete(db_company)
    db.commit()
    return db_company

# Field Tech CRUD - Optimized
def create_field_tech(db: Session, tech: schemas.FieldTechCreate):
    """Create field tech; region from company if company_id set."""
    from region_utils import state_to_region
    db_tech = models.FieldTech(
        field_tech_id=str(uuid.uuid4()),
        company_id=getattr(tech, 'company_id', None),
        name=tech.name,
        tech_number=getattr(tech, 'tech_number', None),
        phone=tech.phone,
        email=tech.email,
        region=tech.region,
        city=tech.city,
        state=tech.state,
        zip=tech.zip,
        notes=tech.notes,
        service_radius_miles=getattr(tech, 'service_radius_miles', None),
    )
    if db_tech.company_id:
        comp = db.query(models.FieldTechCompany).filter(models.FieldTechCompany.company_id == db_tech.company_id).first()
        if comp:
            db_tech.region = db_tech.region or comp.region
            db_tech.city = db_tech.city or comp.city
            db_tech.state = db_tech.state or comp.state
            db_tech.zip = db_tech.zip or comp.zip
    db.add(db_tech)
    db.commit()
    db.refresh(db_tech)
    return db_tech

def get_field_tech(db: Session, field_tech_id: str):
    """Get field tech with company and tickets."""
    return db.query(models.FieldTech).options(
        joinedload(models.FieldTech.company),
        selectinload(models.FieldTech.onsite_tickets)
    ).filter(models.FieldTech.field_tech_id == field_tech_id).first()

def get_field_techs(db: Session, skip: int = 0, limit: int = 100, region: Optional[str] = None, company_id: Optional[str] = None, search: Optional[str] = None):
    """Get field techs with optional region, company, and search (tech name, company name, city, state, phone)."""
    query = db.query(models.FieldTech).options(joinedload(models.FieldTech.company))
    if region:
        query = query.filter(models.FieldTech.region == region)
    if company_id:
        query = query.filter(models.FieldTech.company_id == company_id)
    if search:
        like = f"%{search}%"
        query = query.outerjoin(models.FieldTech.company).filter(or_(
            models.FieldTech.name.ilike(like),
            models.FieldTech.phone.ilike(like),
            models.FieldTech.city.ilike(like),
            models.FieldTech.state.ilike(like),
            models.FieldTechCompany.company_name.ilike(like),
        ))
    return query.order_by(models.FieldTech.name).offset(skip).limit(limit).all()

def update_field_tech(db: Session, field_tech_id: str, tech: schemas.FieldTechCreate):
    """Update field tech with optimized query."""
    db_tech = db.query(models.FieldTech).filter(models.FieldTech.field_tech_id == field_tech_id).first()
    if not db_tech:
        return None
    data = tech.model_dump(exclude_unset=True)
    for field, value in data.items():
        if hasattr(db_tech, field):
            setattr(db_tech, field, value)
    if db_tech.company_id and (db_tech.region is None or db_tech.state):
        comp = db.query(models.FieldTechCompany).filter(models.FieldTechCompany.company_id == db_tech.company_id).first()
        if comp:
            if not db_tech.region:
                db_tech.region = comp.region
            if not db_tech.city:
                db_tech.city = comp.city
            if not db_tech.state:
                db_tech.state = comp.state
            if not db_tech.zip:
                db_tech.zip = comp.zip
    db.commit()
    db.refresh(db_tech)
    return db_tech

def delete_field_tech(db: Session, field_tech_id: str):
    """Delete field tech (check for dependencies first)"""
    db_tech = db.query(models.FieldTech).filter(models.FieldTech.field_tech_id == field_tech_id).first()
    if not db_tech:
        return None
    
    # Check for dependencies
    ticket_count = db.query(models.Ticket).filter(models.Ticket.onsite_tech_id == field_tech_id).count()
    if ticket_count > 0:
        raise ValueError(f"Cannot delete field tech with {ticket_count} associated tickets")
    
    db.delete(db_tech)
    db.commit()
    return db_tech

# Task CRUD - Optimized
def create_task(db: Session, task: schemas.TaskCreate):
    """Create task with optimized query"""
    now = datetime.now(timezone.utc)
    db_task = models.Task(
        task_id=generate_sequential_id(db, models.Task, 'task_id', 'TASK', 6),
        ticket_id=task.ticket_id,
        description=task.description,
        status=task.status if task.status else models.TaskStatus.open,
        assigned_user_id=task.assigned_user_id,
        due_date=task.due_date,
        created_at=now,
        updated_at=now,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_task(db: Session, task_id: str):
    """Get task with related data eager loaded"""
    return db.query(models.Task).options(
        joinedload(models.Task.ticket),
        joinedload(models.Task.assigned_user)
    ).filter(models.Task.task_id == task_id).first()

def get_tasks(db: Session, skip: int = 0, limit: int = 100, 
              ticket_id: Optional[str] = None,
              assigned_user_id: Optional[str] = None,
              status: Optional[str] = None):
    """Get tasks with filtering and eager loading"""
    query = db.query(models.Task).options(
        joinedload(models.Task.ticket),
        joinedload(models.Task.assigned_user)
    )
    
    if ticket_id:
        query = query.filter(models.Task.ticket_id == ticket_id)
    if assigned_user_id:
        query = query.filter(models.Task.assigned_user_id == assigned_user_id)
    if status:
        query = query.filter(models.Task.status == status)
    
    return query.order_by(desc(models.Task.created_at)).offset(skip).limit(limit).all()

def update_task(db: Session, task_id: str, task: schemas.TaskCreate):
    """Update task with optimized query"""
    db_task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not db_task:
        return None
    
    # Optional FK fields that can be cleared (set to None)
    nullable_fks = frozenset({'ticket_id', 'assigned_user_id'})
    for field, value in task.model_dump(exclude_unset=True).items():
        if not hasattr(db_task, field):
            continue
        if value is not None or (field in nullable_fks):
            setattr(db_task, field, value)
    
    db_task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: str):
    """Delete task with optimized query"""
    db_task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if not db_task:
        return None
    
    db.delete(db_task)
    db.commit()
    return db_task

# Equipment CRUD - Optimized
def create_equipment(db: Session, equipment: schemas.EquipmentCreate):
    """Create equipment with optimized query"""
    db_equipment = models.Equipment(
        equipment_id=generate_sequential_id(db, models.Equipment, 'equipment_id', 'EQUIP', 6),
        site_id=equipment.site_id,
        type=equipment.type,
        make_model=equipment.make_model,
        serial_number=equipment.serial_number,
        install_date=equipment.install_date,
        notes=equipment.notes
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

def get_equipment(db: Session, equipment_id: str):
    """Get equipment with related site data eager loaded"""
    return db.query(models.Equipment).options(
        joinedload(models.Equipment.site)
    ).filter(models.Equipment.equipment_id == equipment_id).first()

def get_equipments(db: Session, skip: int = 0, limit: int = 100, 
                   site_id: Optional[str] = None,
                   equipment_type: Optional[str] = None):
    """Get equipment with filtering and eager loading"""
    query = db.query(models.Equipment).options(
        joinedload(models.Equipment.site)
    )
    
    if site_id:
        query = query.filter(models.Equipment.site_id == site_id)
    if equipment_type:
        query = query.filter(models.Equipment.type == equipment_type)
    
    return query.offset(skip).limit(limit).all()

def update_equipment(db: Session, equipment_id: str, equipment: schemas.EquipmentCreate):
    """Update equipment with optimized query"""
    db_equipment = db.query(models.Equipment).filter(models.Equipment.equipment_id == equipment_id).first()
    if not db_equipment:
        return None
    
    # Update fields dynamically
    for field, value in equipment.model_dump(exclude_unset=True).items():
        if hasattr(db_equipment, field) and value is not None:
            setattr(db_equipment, field, value)
    
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

def delete_equipment(db: Session, equipment_id: str):
    """Delete equipment with optimized query"""
    db_equipment = db.query(models.Equipment).filter(models.Equipment.equipment_id == equipment_id).first()
    if not db_equipment:
        return None
    
    db.delete(db_equipment)
    db.commit()
    return db_equipment

# Inventory CRUD - Optimized
def create_inventory_item(db: Session, item: schemas.InventoryItemCreate):
    """Create inventory item with optimized query"""
    db_item = models.InventoryItem(
        item_id=generate_sequential_id(db, models.InventoryItem, 'item_id', 'INV', 6),
        name=item.name,
        sku=item.sku,
        description=item.description,
        quantity_on_hand=item.quantity_on_hand,
        cost=item.cost,
        location=item.location,
        barcode=item.barcode
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_inventory_item(db: Session, item_id: str):
    """Get inventory item with related transactions eager loaded"""
    return db.query(models.InventoryItem).options(
        selectinload(models.InventoryItem.inventory_transactions)
    ).filter(models.InventoryItem.item_id == item_id).first()

def get_inventory_items(db: Session, skip: int = 0, limit: int = 100, 
                        category: Optional[str] = None,
                        location: Optional[str] = None):
    """Get inventory items with filtering and eager loading"""
    query = db.query(models.InventoryItem)
    
    if category:
        query = query.filter(models.InventoryItem.category == category)
    if location:
        query = query.filter(models.InventoryItem.location == location)
    
    return query.offset(skip).limit(limit).all()

def update_inventory_item(db: Session, item_id: str, item: schemas.InventoryItemCreate):
    """Update inventory item with optimized query"""
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_id == item_id).first()
    if not db_item:
        return None
    
    # Update fields dynamically
    for field, value in item.model_dump(exclude_unset=True).items():
        if hasattr(db_item, field) and value is not None:
            setattr(db_item, field, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_inventory_item(db: Session, item_id: str):
    """Delete inventory item (check for dependencies first)"""
    db_item = db.query(models.InventoryItem).filter(models.InventoryItem.item_id == item_id).first()
    if not db_item:
        return None
    
    # Check for dependencies
    transaction_count = db.query(models.InventoryTransaction).filter(models.InventoryTransaction.item_id == item_id).count()
    if transaction_count > 0:
        raise ValueError(f"Cannot delete inventory item with {transaction_count} associated transactions")
    
    db.delete(db_item)
    db.commit()
    return db_item

def get_transactions_by_item(db: Session, item_id: str):
    """Get all transactions for an inventory item"""
    return db.query(models.InventoryTransaction).options(
        joinedload(models.InventoryTransaction.user),
        joinedload(models.InventoryTransaction.shipment),
        joinedload(models.InventoryTransaction.ticket)
    ).filter(models.InventoryTransaction.item_id == item_id).order_by(desc(models.InventoryTransaction.date)).all()

def get_inventory_item_by_barcode(db: Session, barcode: str):
    """Get inventory item by barcode"""
    return db.query(models.InventoryItem).filter(models.InventoryItem.barcode == barcode).first()

# Audit CRUD - Optimized
def create_ticket_audit(db: Session, audit: schemas.TicketAuditCreate):
    """Create audit log entry with optimized query"""
    db_audit = models.TicketAudit(
        audit_id=str(uuid.uuid4()),
        ticket_id=audit.ticket_id,
        user_id=audit.user_id,
        change_time=audit.change_time,
        field_changed=audit.field_changed,
        old_value=audit.old_value,
        new_value=audit.new_value
    )
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit

def get_ticket_audit(db: Session, audit_id: str):
    """Get audit log entry with related data eager loaded"""
    return db.query(models.TicketAudit).options(
        joinedload(models.TicketAudit.user),
        joinedload(models.TicketAudit.ticket)
    ).filter(models.TicketAudit.audit_id == audit_id).first()

def get_ticket_audits(db: Session, skip: int = 0, limit: int = 100,
                      ticket_id: Optional[str] = None,
                      user_id: Optional[str] = None,
                      field_changed: Optional[str] = None):
    """Get audit logs with filtering and eager loading"""
    query = db.query(models.TicketAudit).options(
        joinedload(models.TicketAudit.user),
        joinedload(models.TicketAudit.ticket)
    )
    
    if ticket_id:
        query = query.filter(models.TicketAudit.ticket_id == ticket_id)
    if user_id:
        query = query.filter(models.TicketAudit.user_id == user_id)
    if field_changed:
        query = query.filter(models.TicketAudit.field_changed == field_changed)
    
    return query.order_by(desc(models.TicketAudit.change_time)).offset(skip).limit(limit).all()

# SLA Rule CRUD - Optimized
def create_sla_rule(db: Session, rule: schemas.SLARuleCreate):
    """Create SLA rule with optimized query"""
    db_rule = models.SLARule(
        rule_id=str(uuid.uuid4()),
        name=rule.name,
        description=rule.description,
        ticket_type=rule.ticket_type,
        customer_impact=rule.customer_impact,
        business_priority=rule.business_priority,
        sla_target_hours=rule.sla_target_hours,
        sla_breach_hours=rule.sla_breach_hours,
        escalation_levels=rule.escalation_levels,
        is_active=rule.is_active,
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def get_sla_rule(db: Session, rule_id: str):
    """Get SLA rule with optimized query"""
    return db.query(models.SLARule).filter(models.SLARule.rule_id == rule_id).first()

def get_sla_rules(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None):
    """Get SLA rules with filtering and eager loading"""
    query = db.query(models.SLARule)
    if is_active is not None:
        query = query.filter(models.SLARule.is_active == is_active)
    return query.order_by(desc(models.SLARule.created_at)).offset(skip).limit(limit).all()

def update_sla_rule(db: Session, rule_id: str, rule: schemas.SLARuleUpdate):
    """Update SLA rule with optimized query"""
    db_rule = db.query(models.SLARule).filter(models.SLARule.rule_id == rule_id).first()
    if not db_rule:
        return None
    
    # Update fields dynamically
    for field, value in rule.model_dump(exclude_unset=True).items():
        if hasattr(db_rule, field) and value is not None:
            setattr(db_rule, field, value)
    
    db_rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def delete_sla_rule(db: Session, rule_id: str):
    """Delete SLA rule with optimized query"""
    db_rule = db.query(models.SLARule).filter(models.SLARule.rule_id == rule_id).first()
    if not db_rule:
        return None
    
    db.delete(db_rule)
    db.commit()
    return db_rule

def get_matching_sla_rule(db: Session, ticket_type, customer_impact, business_priority):
    """Get the most specific SLA rule that matches the ticket criteria - Optimized"""
    # Use a single query with proper ordering
    return db.query(models.SLARule).filter(
        models.SLARule.is_active == True,
        or_(
            and_(
                models.SLARule.ticket_type == ticket_type,
                models.SLARule.customer_impact == customer_impact,
                models.SLARule.business_priority == business_priority
            ),
            and_(
                models.SLARule.ticket_type == ticket_type,
                models.SLARule.customer_impact == customer_impact,
                models.SLARule.business_priority.is_(None)
            ),
            and_(
                models.SLARule.ticket_type == ticket_type,
                models.SLARule.customer_impact.is_(None),
                models.SLARule.business_priority.is_(None)
            )
        )
    ).order_by(
        desc(models.SLARule.business_priority.isnot(None)),
        desc(models.SLARule.customer_impact.isnot(None))
    ).first()

# Time Entry CRUD - Optimized
def create_time_entry(db: Session, time_entry_data: dict):
    """Create time entry with optimized query"""
    db_time_entry = models.TimeEntry(
        entry_id=str(uuid.uuid4()),
        ticket_id=time_entry_data['ticket_id'],
        user_id=time_entry_data['user_id'],
        start_time=time_entry_data['start_time'],
        end_time=time_entry_data.get('end_time'),
        description=time_entry_data.get('description'),
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_time_entry)
    db.commit()
    db.refresh(db_time_entry)
    return db_time_entry

def get_time_entry(db: Session, entry_id: str):
    """Get time entry with related data eager loaded"""
    return db.query(models.TimeEntry).options(
        joinedload(models.TimeEntry.ticket),
        joinedload(models.TimeEntry.user)
    ).filter(models.TimeEntry.entry_id == entry_id).first()

def get_time_entries_by_ticket(db: Session, ticket_id: str):
    """Get time entries for a ticket with eager loading"""
    return db.query(models.TimeEntry).options(
        joinedload(models.TimeEntry.user)
    ).filter(models.TimeEntry.ticket_id == ticket_id).order_by(desc(models.TimeEntry.created_at)).all()

def update_time_entry(db: Session, entry_id: str, time_entry_data: dict):
    """Update time entry with optimized query"""
    db_time_entry = db.query(models.TimeEntry).filter(models.TimeEntry.entry_id == entry_id).first()
    if not db_time_entry:
        return None
    
    # Update fields dynamically
    for field, value in time_entry_data.items():
        if hasattr(db_time_entry, field) and value is not None:
            setattr(db_time_entry, field, value)
    
    db.commit()
    db.refresh(db_time_entry)
    return db_time_entry

def delete_time_entry(db: Session, entry_id: str):
    """Delete time entry with optimized query"""
    db_time_entry = db.query(models.TimeEntry).filter(models.TimeEntry.entry_id == entry_id).first()
    if not db_time_entry:
        return None
    
    db.delete(db_time_entry)
    db.commit()
    return db_time_entry

# Ticket Comment CRUD - Optimized
def create_ticket_comment(db: Session, comment_data: dict):
    """Create ticket comment with optimized query"""
    db_comment = models.TicketComment(
        comment_id=str(uuid.uuid4()),
        ticket_id=comment_data['ticket_id'],
        user_id=comment_data['user_id'],
        comment=comment_data['comment'],
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def get_ticket_comment(db: Session, comment_id: str):
    """Get ticket comment with related data eager loaded"""
    return db.query(models.TicketComment).options(
        joinedload(models.TicketComment.ticket),
        joinedload(models.TicketComment.user)
    ).filter(models.TicketComment.comment_id == comment_id).first()

def get_comments_by_ticket(db: Session, ticket_id: str):
    """Get comments for a ticket with eager loading"""
    return db.query(models.TicketComment).options(
        joinedload(models.TicketComment.user)
    ).filter(models.TicketComment.ticket_id == ticket_id).order_by(desc(models.TicketComment.created_at)).all()

def update_ticket_comment(db: Session, comment_id: str, comment_data: dict):
    """Update ticket comment with optimized query"""
    db_comment = db.query(models.TicketComment).filter(models.TicketComment.comment_id == comment_id).first()
    if not db_comment:
        return None
    
    # Update fields dynamically
    for field, value in comment_data.items():
        if hasattr(db_comment, field) and value is not None:
            setattr(db_comment, field, value)
    
    db_comment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def delete_ticket_comment(db: Session, comment_id: str):
    """Delete ticket comment with optimized query"""
    db_comment = db.query(models.TicketComment).filter(models.TicketComment.comment_id == comment_id).first()
    if not db_comment:
        return None
    
    db.delete(db_comment)
    db.commit()
    return db_comment

# Site Equipment CRUD - Optimized
def create_site_equipment(db: Session, equipment: schemas.SiteEquipmentCreate):
    """Create site equipment with optimized query"""
    db_equipment = models.SiteEquipment(
        equipment_id=str(uuid.uuid4()),
        site_id=equipment.site_id,
        name=equipment.name,
        type=equipment.type,
        make_model=equipment.make_model,
        serial_number=equipment.serial_number,
        install_date=equipment.install_date,
        status=equipment.status,
        notes=equipment.notes,
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

def get_site_equipment(db: Session, equipment_id: str):
    """Get site equipment with related site data eager loaded"""
    return db.query(models.SiteEquipment).options(
        joinedload(models.SiteEquipment.site)
    ).filter(models.SiteEquipment.equipment_id == equipment_id).first()

def get_site_equipment_by_site(db: Session, site_id: str):
    """Get all equipment for a site with eager loading"""
    return db.query(models.SiteEquipment).options(
        joinedload(models.SiteEquipment.site)
    ).filter(models.SiteEquipment.site_id == site_id).order_by(desc(models.SiteEquipment.created_at)).all()

def update_site_equipment(db: Session, equipment_id: str, equipment: schemas.SiteEquipmentUpdate):
    """Update site equipment with optimized query"""
    db_equipment = db.query(models.SiteEquipment).filter(models.SiteEquipment.equipment_id == equipment_id).first()
    if not db_equipment:
        return None
    
    # Update fields dynamically
    for field, value in equipment.model_dump(exclude_unset=True).items():
        if hasattr(db_equipment, field) and value is not None:
            setattr(db_equipment, field, value)
    
    db_equipment.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

def delete_site_equipment(db: Session, equipment_id: str):
    """Delete site equipment with optimized query"""
    db_equipment = db.query(models.SiteEquipment).filter(models.SiteEquipment.equipment_id == equipment_id).first()
    if not db_equipment:
        return None
    
    db.delete(db_equipment)
    db.commit()
    return db_equipment

# Ticket Attachment CRUD - Optimized
def create_ticket_attachment(db: Session, attachment: schemas.TicketAttachmentCreate):
    """Create ticket attachment with optimized query"""
    db_attachment = models.TicketAttachment(
        attachment_id=str(uuid.uuid4()),
        ticket_id=attachment.ticket_id,
        filename=attachment.filename,
        file_path=attachment.file_path,
        file_size=attachment.file_size,
        mime_type=attachment.mime_type,
        uploaded_by=attachment.uploaded_by,
        uploaded_at=datetime.now(timezone.utc)
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

def get_ticket_attachment(db: Session, attachment_id: str):
    """Get ticket attachment with related data eager loaded"""
    return db.query(models.TicketAttachment).options(
        joinedload(models.TicketAttachment.ticket),
        joinedload(models.TicketAttachment.uploader)
    ).filter(models.TicketAttachment.attachment_id == attachment_id).first()

def get_ticket_attachments(db: Session, ticket_id: str):
    """Get attachments for a ticket with eager loading"""
    return db.query(models.TicketAttachment).options(
        joinedload(models.TicketAttachment.uploader)
    ).filter(models.TicketAttachment.ticket_id == ticket_id).order_by(desc(models.TicketAttachment.uploaded_at)).all()

def update_ticket_attachment(db: Session, attachment_id: str, attachment: schemas.TicketAttachmentUpdate):
    """Update ticket attachment with optimized query"""
    db_attachment = db.query(models.TicketAttachment).filter(models.TicketAttachment.attachment_id == attachment_id).first()
    if not db_attachment:
        return None
    
    # Update fields dynamically
    for field, value in attachment.model_dump(exclude_unset=True).items():
        if hasattr(db_attachment, field) and value is not None:
            setattr(db_attachment, field, value)
    
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

def delete_ticket_attachment(db: Session, attachment_id: str):
    """Delete ticket attachment with optimized query"""
    db_attachment = db.query(models.TicketAttachment).filter(models.TicketAttachment.attachment_id == attachment_id).first()
    if not db_attachment:
        return None
    
    db.delete(db_attachment)
    db.commit()
    return db_attachment

# Daily Operations Dashboard - Highly Optimized
def get_daily_tickets(db: Session, date: date = None, ticket_type: str = None, 
                     priority: str = None, status: str = None, assigned_user_id: str = None):
    """
    Get tickets for daily operations dashboard
    Shows:
    - Tickets scheduled for this date
    - Unscheduled tickets created today
    - Overdue tickets from previous days (not completed/approved)
    """
    query = db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech),
        selectinload(models.Ticket.comments).joinedload(models.TicketComment.user),
        selectinload(models.Ticket.time_entries),
        selectinload(models.Ticket.tasks)
    )
    
    # Filter by date: Show tickets scheduled for this date OR overdue from past
    if date:
        query = query.filter(
            or_(
                # Tickets scheduled for this date
                models.Ticket.date_scheduled == date,
                # Unscheduled tickets created today
                and_(
                    models.Ticket.date_created == date,
                    models.Ticket.date_scheduled.is_(None)
                ),
                # Overdue tickets from previous days (not completed/approved)
                and_(
                    or_(
                        models.Ticket.date_scheduled < date,
                        and_(
                            models.Ticket.date_created < date,
                            models.Ticket.date_scheduled.is_(None)
                        )
                    ),
                    models.Ticket.status.notin_(['completed', 'closed', 'approved'])
                )
            )
        )
    
    # Apply additional filters
    if ticket_type:
        query = query.filter(models.Ticket.type == ticket_type)
    if priority:
        query = query.filter(models.Ticket.priority == priority)
    if status:
        query = query.filter(models.Ticket.status == status)
    if assigned_user_id:
        query = query.filter(models.Ticket.assigned_user_id == assigned_user_id)
    
    # Order by: overdue first, then by scheduled date, then by creation
    return query.order_by(
        models.Ticket.date_scheduled.asc().nullsfirst(),
        desc(models.Ticket.created_at)
    ).all()

# Ticket Cost Management - Optimized
def update_ticket_costs(db: Session, ticket_id: str, cost_data: dict):
    """Update ticket cost information with optimized query"""
    db_ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not db_ticket:
        return None
    
    # Update cost fields (using billing_rate and total_cost from the model)
    if 'billing_rate' in cost_data:
        db_ticket.billing_rate = cost_data['billing_rate']
    if 'total_cost' in cost_data:
        db_ticket.total_cost = cost_data['total_cost']
    
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

# Search and Filtering - Optimized
def search_tickets(db: Session, search_term: str, skip: int = 0, limit: int = 100):
    """Search tickets with full-text search and eager loading"""
    query = db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech)
    ).filter(
        or_(
            models.Ticket.notes.ilike(f'%{search_term}%'),
            models.Ticket.ticket_id.ilike(f'%{search_term}%'),
            models.Site.location.ilike(f'%{search_term}%'),
            models.Site.brand.ilike(f'%{search_term}%')
        )
    )
    
    return query.order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

def get_tickets_by_status(db: Session, status: str, skip: int = 0, limit: int = 100):
    """Get tickets by status with eager loading"""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech)
    ).filter(models.Ticket.status == status).order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

def get_tickets_by_priority(db: Session, priority: str, skip: int = 0, limit: int = 100):
    """Get tickets by priority with eager loading"""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech)
    ).filter(models.Ticket.priority == priority).order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

def get_tickets_by_user(db: Session, user_id: str, skip: int = 0, limit: int = 100):
    """Get tickets assigned to a user with eager loading"""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech)
    ).filter(models.Ticket.assigned_user_id == user_id).order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

def get_tickets_by_site(db: Session, site_id: str, skip: int = 0, limit: int = 100):
    """Get tickets for a specific site with eager loading"""
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.site),
        joinedload(models.Ticket.assigned_user),
        joinedload(models.Ticket.onsite_tech)
    ).filter(models.Ticket.site_id == site_id).order_by(desc(models.Ticket.created_at)).offset(skip).limit(limit).all()

# Statistics and Analytics - Optimized
def get_ticket_statistics(db: Session, start_date: date = None, end_date: date = None):
    """Get ticket statistics with optimized queries"""
    query = db.query(models.Ticket)
    
    if start_date:
        query = query.filter(models.Ticket.date_created >= start_date)
    if end_date:
        query = query.filter(models.Ticket.date_created <= end_date)
    
    # Get counts by status
    status_counts = {}
    for status in ['open', 'in_progress', 'pending', 'closed', 'cancelled']:
        status_counts[status] = query.filter(models.Ticket.status == status).count()
    
    # Get counts by priority
    priority_counts = {}
    for priority in ['low', 'medium', 'high', 'urgent']:
        priority_counts[priority] = query.filter(models.Ticket.priority == priority).count()
    
    # Get counts by type
    type_counts = {}
    for ticket_type in ['inhouse', 'onsite', 'projects', 'misc']:
        type_counts[ticket_type] = query.filter(models.Ticket.type == ticket_type).count()
    
    return {
        'status_counts': status_counts,
        'priority_counts': priority_counts,
        'type_counts': type_counts,
        'total_tickets': query.count()
    }

def get_user_statistics(db: Session, user_id: str, start_date: date = None, end_date: date = None):
    """Get user statistics with optimized queries"""
    query = db.query(models.Ticket).filter(models.Ticket.assigned_user_id == user_id)
    
    if start_date:
        query = query.filter(models.Ticket.date_created >= start_date)
    if end_date:
        query = query.filter(models.Ticket.date_created <= end_date)
    
    return {
        'total_tickets': query.count(),
        'closed_tickets': query.filter(models.Ticket.status == 'closed').count(),
        'open_tickets': query.filter(models.Ticket.status.in_(['open', 'in_progress', 'pending'])).count(),
        'average_resolution_time': db.query(models.Ticket).filter(
            models.Ticket.assigned_user_id == user_id,
            models.Ticket.resolution_time.isnot(None)
        ).with_entities(
            db.func.avg(models.Ticket.resolution_time)
        ).scalar() or 0
    }

# =============================================================================
# AUDIT CRUD OPERATIONS
# =============================================================================

def create_ticket_audit(db: Session, audit: schemas.TicketAuditCreate):
    """Create an audit log entry"""
    db_audit = models.TicketAudit(
        audit_id=str(uuid.uuid4()),
        ticket_id=audit.ticket_id,
        user_id=audit.user_id,
        change_time=audit.change_time or datetime.now(timezone.utc),
        field_changed=audit.field_changed,
        old_value=audit.old_value,
        new_value=audit.new_value
    )
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit

def get_audit(db: Session, audit_id: str):
    """Get a specific audit log entry with user details"""
    return db.query(models.TicketAudit)\
        .options(joinedload(models.TicketAudit.user))\
        .filter(models.TicketAudit.audit_id == audit_id)\
        .first()

def get_audits(db: Session, skip: int = 0, limit: int = 100):
    """Get all audit log entries with user details, ordered by most recent"""
    return db.query(models.TicketAudit)\
        .options(joinedload(models.TicketAudit.user))\
        .order_by(desc(models.TicketAudit.change_time))\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_ticket_audits(db: Session, ticket_id: str):
    """Get audit log entries for a specific ticket"""
    return db.query(models.TicketAudit)\
        .options(joinedload(models.TicketAudit.user))\
        .filter(models.TicketAudit.ticket_id == ticket_id)\
        .order_by(desc(models.TicketAudit.change_time))\
        .all()

# =============================================================================
# OPTIMIZED INVENTORY OPERATIONS
# =============================================================================

def bulk_update_inventory_for_shipment(
    db: Session, 
    shipment_id: str, 
    user_id: str, 
    ticket_id: Optional[str] = None
) -> dict:
    """
    Optimized bulk inventory update for shipment status changes.
    Uses single queries instead of O(N) individual lookups.
    Returns summary of changes made.
    """
    try:
        # Get all shipment items that need inventory removal in one query
        shipment_items = db.query(models.ShipmentItem)\
            .filter(
                models.ShipmentItem.shipment_id == shipment_id,
                models.ShipmentItem.remove_from_inventory == True,
                models.ShipmentItem.item_id.isnot(None)
            )\
            .all()
        
        if not shipment_items:
            return {"updated_items": 0, "transactions_created": 0, "errors": []}
        
        # Get all affected inventory items in one query
        item_ids = [item.item_id for item in shipment_items]
        inventory_items = db.query(models.InventoryItem)\
            .filter(models.InventoryItem.item_id.in_(item_ids))\
            .all()
        
        # Create lookup dict for fast access
        inventory_lookup = {item.item_id: item for item in inventory_items}
        
        # Prepare bulk operations
        inventory_transactions = []
        inventory_updates = []
        errors = []
        
        for shipment_item in shipment_items:
            inventory_item = inventory_lookup.get(shipment_item.item_id)
            if not inventory_item:
                errors.append(f"Inventory item {shipment_item.item_id} not found")
                continue
            
            # Calculate new quantity
            qty = shipment_item.quantity or 1
            old_qty = inventory_item.quantity_on_hand or 0
            new_qty = max(0, old_qty - qty)
            
            # Create inventory transaction
            transaction = models.InventoryTransaction(
                transaction_id=str(uuid.uuid4()),
                item_id=shipment_item.item_id,
                user_id=user_id,
                shipment_item_id=shipment_item.shipment_item_id,
                ticket_id=ticket_id,
                date=date.today(),
                quantity=qty,
                type=models.InventoryTransactionType.out,
                notes=f"Shipped for ticket {ticket_id}" if ticket_id else "Shipped"
            )
            inventory_transactions.append(transaction)
            
            # Prepare inventory update
            inventory_updates.append({
                'item_id': inventory_item.item_id,
                'quantity_on_hand': new_qty,
                'old_quantity': old_qty
            })
        
        # Bulk insert transactions
        if inventory_transactions:
            db.bulk_save_objects(inventory_transactions)
        
        # Bulk update inventory quantities
        for update_data in inventory_updates:
            db.execute(
                update(models.InventoryItem)
                .where(models.InventoryItem.item_id == update_data['item_id'])
                .values(quantity_on_hand=update_data['quantity_on_hand'])
            )
        
        db.commit()
        
        return {
            "updated_items": len(inventory_updates),
            "transactions_created": len(inventory_transactions),
            "errors": errors,
            "changes": [
                {
                    "item_id": update_data['item_id'],
                    "old_quantity": update_data['old_quantity'],
                    "new_quantity": update_data['quantity_on_hand']
                }
                for update_data in inventory_updates
            ]
        }
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Bulk inventory update failed: {str(e)}")

def get_shipment_with_items(db: Session, shipment_id: str):
    """Get shipment with all related data in one query"""
    return db.query(models.Shipment)\
        .options(
            joinedload(models.Shipment.site),
            joinedload(models.Shipment.ticket),
            selectinload(models.Shipment.shipment_items)
        )\
        .filter(models.Shipment.shipment_id == shipment_id)\
        .first()

def create_audit_log(
    db: Session,
    user_id: str,
    field_changed: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    ticket_id: Optional[str] = None
):
    """Create audit log entry with proper old/new value tracking"""
    audit = models.TicketAudit(
        audit_id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        user_id=user_id,
        change_time=datetime.now(timezone.utc),
        field_changed=field_changed,
        old_value=old_value,
        new_value=new_value
    )
    db.add(audit)
    return audit

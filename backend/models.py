from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime, timezone

class UserRole(enum.Enum):
    tech = 'tech'
    dispatcher = 'dispatcher'
    billing = 'billing'
    admin = 'admin'

class ImpactLevel(enum.Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    critical = 'critical'

class BusinessPriority(enum.Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    urgent = 'urgent'

class User(Base):
    __tablename__ = 'users'
    user_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    phone = Column(String)
    # region removed per product requirement
    preferences = Column(Text)
    hashed_password = Column(String)  # Dedicated password field
    must_change_password = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    tickets = relationship('Ticket', back_populates='assigned_user', foreign_keys='Ticket.assigned_user_id')
    last_updated_tickets = relationship('Ticket', foreign_keys='Ticket.last_updated_by')
    claimed_tickets = relationship('Ticket', foreign_keys='Ticket.claimed_by')
    tasks = relationship('Task', back_populates='assigned_user')
    audits = relationship('TicketAudit', back_populates='user')
    inventory_transactions = relationship('InventoryTransaction', back_populates='user')

class FieldTech(Base):
    __tablename__ = 'field_techs'
    field_tech_id = Column(String, primary_key=True, index=True)
    company_id = Column(String, ForeignKey('field_tech_companies.company_id'))
    name = Column(String, nullable=False)
    tech_number = Column(String)
    phone = Column(String)
    email = Column(String)
    # Legacy / fallback when no company: region, city, state, zip (map uses company address when company_id set)
    region = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)
    notes = Column(Text)
    service_radius_miles = Column(Integer)
    onsite_tickets = relationship('Ticket', back_populates='onsite_tech')
    company = relationship('FieldTechCompany', back_populates='techs', foreign_keys=[company_id])

class FieldTechCompany(Base):
    """One company address; techs under this company use this address for map."""
    __tablename__ = 'field_tech_companies'
    company_id = Column(String, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    company_number = Column(String)
    business_phone = Column(String)
    other_phones = Column(Text)
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)
    region = Column(String)
    notes = Column(Text)
    service_radius_miles = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    techs = relationship('FieldTech', back_populates='company', foreign_keys='FieldTech.company_id')

class Site(Base):
    __tablename__ = 'sites'
    site_id = Column(String, primary_key=True, index=True)
    ip_address = Column(String)
    location = Column(String)
    brand = Column(String)
    main_number = Column(String)
    mp = Column(String)
    service_address = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)
    region = Column(String)
    timezone = Column(String)
    notes = Column(Text)
    # Equipment fields
    equipment_notes = Column(Text)
    phone_system = Column(String)
    phone_types = Column(String)
    network_equipment = Column(String)
    additional_equipment = Column(String)
    equipment = relationship('Equipment', back_populates='site')
    site_equipment = relationship('SiteEquipment', back_populates='site')
    tickets = relationship('Ticket', back_populates='site')
    shipments = relationship('Shipment', back_populates='site')

class Equipment(Base):
    __tablename__ = 'equipment'
    equipment_id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey('sites.site_id'))
    type = Column(String)
    make_model = Column(String)
    serial_number = Column(String)
    install_date = Column(Date)
    notes = Column(Text)
    site = relationship('Site', back_populates='equipment')

class TicketType(enum.Enum):
    inhouse = 'inhouse'
    onsite = 'onsite'
    nro = 'nro'
    projects = 'projects'
    misc = 'misc'

class TicketStatus(enum.Enum):
    open = 'open'
    scheduled = 'scheduled'
    checked_in = 'checked_in'
    in_progress = 'in_progress'
    pending = 'pending'
    needs_parts = 'needs_parts'
    go_back_scheduled = 'go_back_scheduled'
    completed = 'completed'
    closed = 'closed'
    approved = 'approved'  # Final approval - moves to history
    archived = 'archived'  # Archived after approval - hidden from main lists

class TicketPriority(enum.Enum):
    normal = 'normal'
    critical = 'critical'
    emergency = 'emergency'

class TicketWorkflowState(enum.Enum):
    new = 'new'
    scheduled = 'scheduled'
    claimed = 'claimed'
    onsite = 'onsite'
    offsite = 'offsite'
    followup_required = 'followup_required'
    needstech = 'needstech'
    goback_required = 'goback_required'
    pending_dispatch_review = 'pending_dispatch_review'
    pending_approval = 'pending_approval'
    ready_to_archive = 'ready_to_archive'
    nro_phase1_scheduled = 'nro_phase1_scheduled'
    nro_phase1_complete_pending_phase2 = 'nro_phase1_complete_pending_phase2'
    nro_phase1_goback_required = 'nro_phase1_goback_required'
    nro_phase2_scheduled = 'nro_phase2_scheduled'
    nro_phase2_goback_required = 'nro_phase2_goback_required'
    nro_ready_for_completion = 'nro_ready_for_completion'

class Ticket(Base):
    __tablename__ = 'tickets'
    ticket_id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey('sites.site_id'), nullable=False)
    inc_number = Column(String)
    so_number = Column(String)
    type = Column(Enum(TicketType), nullable=False, default=TicketType.onsite)
    status = Column(Enum(TicketStatus), default=TicketStatus.open)
    workflow_state = Column(String, nullable=False, default=TicketWorkflowState.new.value)
    ticket_version = Column(Integer, nullable=False, default=1)
    priority = Column(Enum(TicketPriority), default=TicketPriority.normal)
    category = Column(String)
    assigned_user_id = Column(String, ForeignKey('users.user_id'))
    onsite_tech_id = Column(String, ForeignKey('field_techs.field_tech_id'))
    date_created = Column(Date, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)  # Timestamp when created
    date_scheduled = Column(Date)
    date_closed = Column(Date)
    time_spent = Column(Integer)
    notes = Column(Text)
    color_flag = Column(String)
    special_flag = Column(String)
    last_updated_by = Column(String, ForeignKey('users.user_id'))
    last_updated_at = Column(DateTime)
    
    # New Ticket Type System Fields
    claimed_by = Column(String, ForeignKey('users.user_id'))  # In-house tech who claimed ticket
    claimed_at = Column(DateTime(timezone=True))  # When ticket was claimed
    check_in_time = Column(DateTime(timezone=True))  # When field tech checked in
    check_out_time = Column(DateTime(timezone=True))  # When field tech checked out
    onsite_duration_minutes = Column(Integer)  # Calculated onsite time
    billing_rate = Column(Float, default=0.0)  # Billing rate per hour for this ticket
    total_cost = Column(Float, default=0.0)  # Total cost including time, parts, shipping
    
    # Enhanced Workflow Fields
    estimated_hours = Column(Integer)  # Estimated time to complete
    actual_hours = Column(Integer)     # Actual time spent
    start_time = Column(DateTime)      # When work actually started
    end_time = Column(DateTime)        # When work was completed
    is_billable = Column(Boolean, default=True)  # Whether time is billable
    requires_approval = Column(Boolean, default=False)  # Whether approval is needed
    approved_by = Column(String, ForeignKey('users.user_id'))  # Who approved
    approved_at = Column(DateTime)     # When approved
    rejection_reason = Column(Text)    # Reason if rejected
    
    # Enhanced SLA Management Fields
    sla_target_hours = Column(Integer, default=24)  # Target response time in hours
    sla_breach_hours = Column(Integer, default=48)  # Escalation time in hours
    first_response_time = Column(DateTime)  # When first response was made
    resolution_time = Column(DateTime)  # When ticket was resolved
    escalation_level = Column(Integer, default=0)  # Current escalation level
    escalation_notified = Column(Boolean, default=False)  # Whether escalation was notified
    customer_impact = Column(Enum(ImpactLevel), default=ImpactLevel.medium)
    business_priority = Column(Enum(BusinessPriority), default=BusinessPriority.medium)
    
    # New Workflow Fields
    workflow_step = Column(String, default='created')  # Current workflow step
    next_action_required = Column(String)  # What needs to happen next
    due_date = Column(DateTime)  # When action is due
    # NRO two-phase scheduling fields
    nro_phase1_scheduled_date = Column(Date)
    nro_phase1_completed_at = Column(DateTime(timezone=True))
    nro_phase1_state = Column(String)
    nro_phase2_scheduled_date = Column(Date)
    nro_phase2_completed_at = Column(DateTime(timezone=True))
    nro_phase2_state = Column(String)
    is_urgent = Column(Boolean, default=False)  # Urgent flag
    is_vip = Column(Boolean, default=False)  # VIP customer flag
    customer_name = Column(String)  # Customer contact name
    customer_phone = Column(String)  # Customer contact phone
    customer_email = Column(String)  # Customer contact email
    
    # Equipment and Parts
    equipment_affected = Column(Text)  # Equipment involved
    parts_needed = Column(Text)  # Parts required
    parts_ordered = Column(Boolean, default=False)  # Whether parts were ordered
    parts_received = Column(Boolean, default=False)  # Whether parts were received
    
    # Quality and Follow-up
    quality_score = Column(Integer)  # Quality rating (1-5)
    customer_satisfaction = Column(Integer)  # Customer rating (1-5)
    tech_rating = Column(Integer)  # Onsite tech rating (1-5), stored per ticket, aggregated per tech
    follow_up_required = Column(Boolean, default=False)  # Whether follow-up is needed
    follow_up_date = Column(Date)  # When to follow up
    follow_up_notes = Column(Text)  # Follow-up notes
    
    # Relationships
    site = relationship('Site', back_populates='tickets')
    assigned_user = relationship('User', foreign_keys=[assigned_user_id], back_populates='tickets')
    last_updated_user = relationship('User', foreign_keys=[last_updated_by], back_populates='last_updated_tickets')
    approved_user = relationship('User', foreign_keys=[approved_by])
    claimed_user = relationship('User', foreign_keys=[claimed_by], overlaps="claimed_tickets")
    onsite_tech = relationship('FieldTech', back_populates='onsite_tickets')
    audits = relationship('TicketAudit', back_populates='ticket')
    tasks = relationship('Task', back_populates='ticket')
    shipments = relationship('Shipment', back_populates='ticket')
    inventory_transactions = relationship('InventoryTransaction', back_populates='ticket')
    comments = relationship('TicketComment', back_populates='ticket')
    time_entries = relationship('TimeEntry', back_populates='ticket')
    attachments = relationship('TicketAttachment', back_populates='ticket')

class TicketAudit(Base):
    __tablename__ = 'ticket_audits'
    audit_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    user_id = Column(String, ForeignKey('users.user_id'))
    change_time = Column(DateTime)
    field_changed = Column(String)
    old_value = Column(String)
    new_value = Column(String)
    ticket = relationship('Ticket', back_populates='audits')
    user = relationship('User', back_populates='audits')

class Shipment(Base):
    __tablename__ = 'shipments'
    shipment_id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey('sites.site_id'), nullable=False)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    item_id = Column(String, ForeignKey('inventory_items.item_id'))
    what_is_being_shipped = Column(String, nullable=False)
    shipping_preference = Column(String)
    charges_out = Column(Float)
    charges_in = Column(Float)
    tracking_number = Column(String)
    return_tracking = Column(String)
    date_created = Column(DateTime, default=lambda: datetime.now(timezone.utc))  # Auto-filled when created
    date_shipped = Column(DateTime)  # Auto-filled when marked as shipped
    date_returned = Column(Date)
    notes = Column(Text)
    
    # Enhanced Shipping Integration Fields
    source_ticket_type = Column(String)  # Type of ticket that requested shipping
    shipping_priority = Column(String, default='normal')  # normal, urgent, critical
    parts_cost = Column(Float, default=0.0)  # Cost of parts being shipped
    total_cost = Column(Float, default=0.0)  # Total cost including shipping
    status = Column(String, default='pending')  # pending, shipped, delivered, returned
    quantity = Column(Integer, default=1)  # Quantity shipped
    archived = Column(Boolean, default=False)  # Hide from daily/global lists when true
    remove_from_inventory = Column(Boolean, default=False)  # Whether to remove item from inventory
    site = relationship('Site', back_populates='shipments')
    ticket = relationship('Ticket', back_populates='shipments')
    item = relationship('InventoryItem', back_populates='shipments')
    shipment_items = relationship('ShipmentItem', back_populates='shipment', cascade='all, delete-orphan')

class ShipmentItem(Base):
    __tablename__ = 'shipment_items'
    shipment_item_id = Column(String, primary_key=True, index=True)
    shipment_id = Column(String, ForeignKey('shipments.shipment_id'), nullable=False)
    item_id = Column(String, ForeignKey('inventory_items.item_id'), nullable=False)
    quantity = Column(Integer, default=1)
    what_is_being_shipped = Column(String, nullable=False)
    remove_from_inventory = Column(Boolean, default=True)
    notes = Column(Text)
    date_created = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    shipment = relationship('Shipment', back_populates='shipment_items')
    item = relationship('InventoryItem')
    inventory_transactions = relationship('InventoryTransaction', back_populates='shipment_item')

class InventoryItem(Base):
    __tablename__ = 'inventory_items'
    item_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sku = Column(String)
    description = Column(Text)
    quantity_on_hand = Column(Integer, default=0)
    cost = Column(Float)
    location = Column(String)
    barcode = Column(String)
    shipments = relationship('Shipment', back_populates='item')
    inventory_transactions = relationship('InventoryTransaction', back_populates='item')

class InventoryTransactionType(enum.Enum):
    in_ = 'in'
    out = 'out'
    adjust = 'adjust'

class InventoryTransaction(Base):
    __tablename__ = 'inventory_transactions'
    transaction_id = Column(String, primary_key=True, index=True)
    item_id = Column(String, ForeignKey('inventory_items.item_id'))
    user_id = Column(String, ForeignKey('users.user_id'))
    shipment_item_id = Column(String, ForeignKey('shipment_items.shipment_item_id'))
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    date = Column(Date)
    quantity = Column(Integer)
    type = Column(Enum(InventoryTransactionType))
    notes = Column(Text)
    item = relationship('InventoryItem', back_populates='inventory_transactions')
    user = relationship('User', back_populates='inventory_transactions')
    shipment_item = relationship('ShipmentItem', back_populates='inventory_transactions')
    ticket = relationship('Ticket', back_populates='inventory_transactions')

class TaskStatus(enum.Enum):
    open = 'open'
    in_progress = 'in_progress'
    completed = 'completed'

class Task(Base):
    __tablename__ = 'tasks'
    task_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    assigned_user_id = Column(String, ForeignKey('users.user_id'))
    description = Column(Text, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.open)
    due_date = Column(Date)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    ticket = relationship('Ticket', back_populates='tasks')
    assigned_user = relationship('User', back_populates='tasks')

class TicketComment(Base):
    __tablename__ = 'ticket_comments'
    comment_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    user_id = Column(String, ForeignKey('users.user_id'))
    comment = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal note vs customer visible
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    ticket = relationship('Ticket', back_populates='comments')
    user = relationship('User')

class TimeEntry(Base):
    __tablename__ = 'time_entries'
    entry_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    user_id = Column(String, ForeignKey('users.user_id'))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)  # Calculated duration
    description = Column(Text)  # What was done during this time
    is_billable = Column(Boolean, default=True)
    hourly_rate = Column(Float, default=0.0)  # Hourly rate for billing
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ticket = relationship('Ticket', back_populates='time_entries')
    user = relationship('User')

class SLARule(Base):
    __tablename__ = 'sla_rules'
    rule_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    ticket_type = Column(Enum(TicketType))
    customer_impact = Column(Enum(ImpactLevel))
    business_priority = Column(Enum(BusinessPriority))
    sla_target_hours = Column(Integer, default=24)
    sla_breach_hours = Column(Integer, default=48)
    escalation_levels = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)) 

class SiteEquipment(Base):
    __tablename__ = 'site_equipment'
    equipment_id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey('sites.site_id'))
    equipment_type = Column(String)  # Phone System, Phones, Network Equipment, etc.
    model = Column(String)
    part_number = Column(String)
    serial_number = Column(String)
    installation_date = Column(Date)
    maintenance_notes = Column(Text)
    rack_location = Column(String)
    additional_details = Column(Text)  # Flexible field for any additional info
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    site = relationship('Site', back_populates='site_equipment')

class TicketAttachment(Base):
    __tablename__ = 'ticket_attachments'
    attachment_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey('tickets.ticket_id'))
    file_name = Column(String, nullable=False)
    file_type = Column(String)  # email, photo, document, etc.
    file_size = Column(Integer)  # Size in bytes
    external_url = Column(String)  # URL to external storage (Google Drive, Dropbox, etc.)
    uploaded_by = Column(String, ForeignKey('users.user_id'))
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    description = Column(Text)  # Optional description of the attachment
    ticket = relationship('Ticket', back_populates='attachments')
    user = relationship('User')

class RevokedToken(Base):
    __tablename__ = 'revoked_tokens'
    jti = Column(String, primary_key=True, index=True)  # JWT ID
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    token_type = Column(String, nullable=False)  # 'access' or 'refresh'
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)  # When the token would have expired
    reason = Column(String)  # Optional reason for revocation (logout, security, etc.)
    user = relationship('User')

class FrontendLog(Base):
    __tablename__ = 'frontend_logs'
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    level = Column(String, nullable=False)  # ERROR, WARN, INFO, DEBUG
    context = Column(String, nullable=False)  # frontend, api, component, etc.
    message = Column(Text, nullable=False)
    data = Column(Text)  # JSON string of additional data
    url = Column(String)
    user_agent = Column(Text)
    client_ip = Column(String)
    error_id = Column(String)  # For correlating related errors

class FrontendError(Base):
    __tablename__ = 'frontend_errors'
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    error_id = Column(String, unique=True, index=True)  # Unique identifier for the error
    message = Column(Text, nullable=False)
    stack = Column(Text)  # JavaScript stack trace
    component_stack = Column(Text)  # React component stack
    url = Column(String)
    user_agent = Column(Text)
    client_ip = Column(String)
    additional_data = Column(Text)  # JSON string of additional error data 
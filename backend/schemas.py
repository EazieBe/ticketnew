from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
import re
from typing import Optional, List, Dict
from datetime import date, datetime
import enum

class UserRole(str, enum.Enum):
    tech = 'tech'
    dispatcher = 'dispatcher'
    billing = 'billing'
    admin = 'admin'

class ImpactLevel(str, enum.Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    critical = 'critical'

class BusinessPriority(str, enum.Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    urgent = 'urgent'

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    phone: Optional[str] = None
    
    preferences: Optional[str] = None
    must_change_password: Optional[bool] = False
    active: Optional[bool] = True

class UserCreate(UserBase):
    password: Optional[str] = None

class AdminUserCreate(UserBase):
    """Schema for admin-created users with proper password handling"""
    password: Optional[str] = None
    hashed_password: Optional[str] = None

class UserOut(UserBase):
    user_id: str
    temp_password: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class FieldTechCompanyBase(BaseModel):
    company_name: str
    company_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    region: Optional[str] = None
    notes: Optional[str] = None
    service_radius_miles: Optional[int] = None  # Default service area radius from address (e.g. 50, 100)

class FieldTechCompanyCreate(FieldTechCompanyBase):
    pass

class FieldTechCompanyOut(FieldTechCompanyBase):
    company_id: str
    created_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    techs: Optional[List['FieldTechOutNested']] = None
    model_config = ConfigDict(from_attributes=True)

class FieldTechBase(BaseModel):
    company_id: Optional[str] = None
    name: str
    tech_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    region: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    notes: Optional[str] = None
    service_radius_miles: Optional[int] = None

class FieldTechCreate(FieldTechBase):
    pass

class FieldTechOutNested(FieldTechBase):
    """Tech payload when nested under a company (no company back-reference to avoid recursion)."""
    field_tech_id: str
    model_config = ConfigDict(from_attributes=True)

class FieldTechOut(FieldTechBase):
    field_tech_id: str
    company: Optional['FieldTechCompanyOut'] = None
    model_config = ConfigDict(from_attributes=True)

class FieldTechCompanyBase(BaseModel):
    company_name: str
    company_number: Optional[str] = None
    business_phone: Optional[str] = None
    other_phones: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    region: Optional[str] = None
    notes: Optional[str] = None
    service_radius_miles: Optional[int] = None

class FieldTechCompanyCreate(FieldTechCompanyBase):
    pass

class FieldTechOutNested(FieldTechBase):
    field_tech_id: str
    model_config = ConfigDict(from_attributes=True)

class FieldTechCompanyOut(FieldTechCompanyBase):
    company_id: str
    created_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    techs: Optional[List[FieldTechOutNested]] = None
    model_config = ConfigDict(from_attributes=True)

class SiteBase(BaseModel):
    site_id: str
    ip_address: Optional[str] = None
    location: Optional[str] = None
    brand: Optional[str] = None
    main_number: Optional[str] = None
    mp: Optional[str] = None
    service_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    region: Optional[str] = None
    timezone: Optional[str] = None
    notes: Optional[str] = None
    # Equipment fields
    equipment_notes: Optional[str] = None
    phone_system: Optional[str] = None
    phone_types: Optional[str] = None
    network_equipment: Optional[str] = None
    additional_equipment: Optional[str] = None

class SiteCreate(SiteBase):
    pass

class SiteOut(SiteBase):
    model_config = ConfigDict(from_attributes=True)

class EquipmentBase(BaseModel):
    type: str
    make_model: Optional[str] = None
    serial_number: Optional[str] = None
    install_date: Optional[date] = None
    notes: Optional[str] = None

class EquipmentCreate(EquipmentBase):
    site_id: str

class EquipmentOut(EquipmentBase):
    equipment_id: str
    site_id: Optional[str] = None

class TicketType(str, enum.Enum):
    inhouse = 'inhouse'
    onsite = 'onsite'
    nro = 'nro'
    projects = 'projects'
    misc = 'misc'

class TicketStatus(str, enum.Enum):
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

class TicketPriority(str, enum.Enum):
    normal = 'normal'
    critical = 'critical'
    emergency = 'emergency'

class TicketWorkflowState(str, enum.Enum):
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

class TicketBase(BaseModel):
    site_id: str
    inc_number: Optional[str] = None
    so_number: Optional[str] = None
    type: TicketType = TicketType.onsite
    status: Optional[TicketStatus] = TicketStatus.open
    workflow_state: Optional[TicketWorkflowState] = TicketWorkflowState.new
    ticket_version: Optional[int] = 1
    priority: Optional[TicketPriority] = TicketPriority.normal
    category: Optional[str] = None
    assigned_user_id: Optional[str] = None
    onsite_tech_id: Optional[str] = None
    date_created: Optional[date] = None
    date_scheduled: Optional[date] = None
    date_closed: Optional[date] = None
    time_spent: Optional[int] = None
    notes: Optional[str] = None
    color_flag: Optional[str] = None
    special_flag: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    # New Ticket Type System Fields
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    onsite_duration_minutes: Optional[int] = None
    billing_rate: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    
    # Enhanced Workflow Fields
    estimated_hours: Optional[int] = None
    actual_hours: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_billable: Optional[bool] = True
    requires_approval: Optional[bool] = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Enhanced SLA Management Fields
    sla_target_hours: Optional[int] = 24
    sla_breach_hours: Optional[int] = 48
    first_response_time: Optional[datetime] = None
    resolution_time: Optional[datetime] = None
    escalation_level: Optional[int] = 0
    escalation_notified: Optional[bool] = False
    customer_impact: Optional[ImpactLevel] = ImpactLevel.medium
    business_priority: Optional[BusinessPriority] = BusinessPriority.medium
    
    # New Workflow Fields
    workflow_step: Optional[str] = 'created'
    next_action_required: Optional[str] = None
    due_date: Optional[datetime] = None
    nro_phase1_scheduled_date: Optional[date] = None
    nro_phase1_completed_at: Optional[datetime] = None
    nro_phase1_state: Optional[str] = None
    nro_phase2_scheduled_date: Optional[date] = None
    nro_phase2_completed_at: Optional[datetime] = None
    nro_phase2_state: Optional[str] = None
    is_urgent: Optional[bool] = False
    is_vip: Optional[bool] = False
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    
    # Equipment and Parts
    equipment_affected: Optional[str] = None
    parts_needed: Optional[str] = None
    parts_ordered: Optional[bool] = False
    parts_received: Optional[bool] = False
    
    # Quality and Follow-up
    quality_score: Optional[int] = None
    customer_satisfaction: Optional[int] = None
    tech_rating: Optional[int] = None  # Onsite tech rating (1-5), aggregated per tech
    follow_up_required: Optional[bool] = False
    follow_up_date: Optional[date] = None
    follow_up_notes: Optional[str] = None

    @field_validator(
        "inc_number",
        "so_number",
        "category",
        "notes",
        "special_flag",
        "next_action_required",
        "customer_name",
        "customer_phone",
        "customer_email",
        "equipment_affected",
        "parts_needed",
        "follow_up_notes",
        mode="before",
    )
    @classmethod
    def normalize_text_fields(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            return v
        # Remove control chars except tabs/newlines and trim overall whitespace.
        cleaned = re.sub(r"[^\x20-\x7E\t\r\n]", "", v).strip()
        # Collapse repeated internal spaces on short identifier/category fields.
        return cleaned

class TicketCreate(TicketBase):
    model_config = ConfigDict(extra="forbid")

class TicketUpdate(BaseModel):
    site_id: Optional[str] = None
    inc_number: Optional[str] = None
    so_number: Optional[str] = None
    type: Optional[TicketType] = None
    status: Optional[TicketStatus] = None
    workflow_state: Optional[TicketWorkflowState] = None
    ticket_version: Optional[int] = None
    expected_ticket_version: Optional[int] = None
    priority: Optional[TicketPriority] = None
    category: Optional[str] = None
    assigned_user_id: Optional[str] = None
    onsite_tech_id: Optional[str] = None
    date_created: Optional[date] = None
    date_scheduled: Optional[date] = None
    date_closed: Optional[date] = None
    time_spent: Optional[int] = None
    notes: Optional[str] = None
    color_flag: Optional[str] = None
    special_flag: Optional[str] = None
    last_updated_by: Optional[str] = None
    last_updated_at: Optional[datetime] = None
    
    # New Ticket Type System Fields
    claimed_by: Optional[str] = None
    claimed_at: Optional[datetime] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    onsite_duration_minutes: Optional[int] = None
    billing_rate: Optional[float] = None
    total_cost: Optional[float] = None
    
    # Enhanced Workflow Fields
    estimated_hours: Optional[int] = None
    actual_hours: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_billable: Optional[bool] = None
    requires_approval: Optional[bool] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Enhanced SLA Management Fields
    sla_target_hours: Optional[int] = None
    sla_breach_hours: Optional[int] = None
    first_response_time: Optional[datetime] = None
    resolution_time: Optional[datetime] = None
    escalation_level: Optional[int] = None
    escalation_notified: Optional[bool] = None
    customer_impact: Optional[ImpactLevel] = None
    business_priority: Optional[BusinessPriority] = None
    
    # New Workflow Fields
    workflow_step: Optional[str] = None
    next_action_required: Optional[str] = None
    due_date: Optional[datetime] = None
    nro_phase1_scheduled_date: Optional[date] = None
    nro_phase1_completed_at: Optional[datetime] = None
    nro_phase1_state: Optional[str] = None
    nro_phase2_scheduled_date: Optional[date] = None
    nro_phase2_completed_at: Optional[datetime] = None
    nro_phase2_state: Optional[str] = None
    is_urgent: Optional[bool] = None
    is_vip: Optional[bool] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    
    # Equipment and Parts
    equipment_affected: Optional[str] = None
    parts_needed: Optional[str] = None
    parts_ordered: Optional[bool] = None
    parts_received: Optional[bool] = None
    
    # Quality and Follow-up
    quality_score: Optional[int] = None
    customer_satisfaction: Optional[int] = None
    tech_rating: Optional[int] = None
    follow_up_required: Optional[bool] = None
    follow_up_date: Optional[date] = None
    follow_up_notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator(
        "inc_number",
        "so_number",
        "category",
        "notes",
        "special_flag",
        "next_action_required",
        "customer_name",
        "customer_phone",
        "customer_email",
        "equipment_affected",
        "parts_needed",
        "follow_up_notes",
        mode="before",
    )
    @classmethod
    def normalize_text_fields(cls, v):
        if v is None or not isinstance(v, str):
            return v
        return re.sub(r"[^\x20-\x7E\t\r\n]", "", v).strip()

    @field_validator("expected_ticket_version", mode="before")
    @classmethod
    def validate_expected_version(cls, v):
        if v is None:
            return v
        iv = int(v)
        if iv < 1:
            raise ValueError("expected_ticket_version must be >= 1")
        return iv

class TicketOut(TicketBase):
    ticket_id: str
    created_at: Optional[datetime] = None  # Timestamp when ticket was created
    site: Optional['SiteOut'] = None
    assigned_user: Optional['UserOut'] = None
    claimed_user: Optional['UserOut'] = None
    onsite_tech: Optional['FieldTechOut'] = None
    
    model_config = ConfigDict(from_attributes=True)

class TicketAuditBase(BaseModel):
    ticket_id: Optional[str] = None
    user_id: Optional[str] = None
    change_time: datetime
    field_changed: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class TicketAuditCreate(TicketAuditBase):
    pass

class TicketAuditOut(TicketAuditBase):
    audit_id: str
    user: Optional['UserOut'] = None
    model_config = ConfigDict(from_attributes=True)

class ShipmentBase(BaseModel):
    site_id: str
    ticket_id: Optional[str] = None
    item_id: Optional[str] = None
    what_is_being_shipped: str
    shipping_preference: Optional[str] = None
    charges_out: Optional[float] = None
    charges_in: Optional[float] = None
    tracking_number: Optional[str] = None
    return_tracking: Optional[str] = None
    date_shipped: Optional[datetime] = None
    date_returned: Optional[date] = None
    notes: Optional[str] = None
    
    # Enhanced Shipping Integration Fields
    source_ticket_type: Optional[str] = None
    shipping_priority: Optional[str] = 'normal'
    parts_cost: Optional[float] = 0.0
    total_cost: Optional[float] = 0.0
    status: Optional[str] = 'pending'
    quantity: Optional[int] = 1
    archived: Optional[bool] = False
    remove_from_inventory: Optional[bool] = False

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentWithItemsCreate(BaseModel):
    site_id: str
    ticket_id: Optional[str] = None
    what_is_being_shipped: str
    shipping_preference: Optional[str] = None
    charges_out: Optional[float] = None
    charges_in: Optional[float] = None
    tracking_number: Optional[str] = None
    return_tracking: Optional[str] = None
    date_shipped: Optional[datetime] = None
    date_returned: Optional[date] = None
    notes: Optional[str] = None
    source_ticket_type: Optional[str] = None
    shipping_priority: Optional[str] = 'normal'
    parts_cost: Optional[float] = 0
    total_cost: Optional[float] = 0
    status: Optional[str] = 'pending'
    quantity: Optional[int] = 1
    archived: Optional[bool] = False
    remove_from_inventory: Optional[bool] = False
    # Multiple items support
    items: List['ShipmentItemCreate'] = []

class ShipmentOut(ShipmentBase):
    shipment_id: str
    date_created: Optional[datetime] = None
    # Include related item when eager-loaded (for backward compatibility)
    item: Optional['InventoryItemOut'] = None
    # Include related site when eager-loaded
    site: Optional['SiteOut'] = None
    # Include shipment items for multiple items support
    shipment_items: Optional[List['ShipmentItemOut']] = []

    model_config = ConfigDict(from_attributes=True)

class ShipmentStatusUpdate(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    return_tracking: Optional[str] = None
    remove_from_inventory: Optional[bool] = None
    charges_out: Optional[float] = None
    charges_in: Optional[float] = None

class ShipmentItemBase(BaseModel):
    item_id: str
    quantity: int = 1
    what_is_being_shipped: str
    remove_from_inventory: bool = True
    notes: Optional[str] = None

class ShipmentItemCreate(ShipmentItemBase):
    pass

class ShipmentItemOut(ShipmentItemBase):
    shipment_item_id: str
    date_created: Optional[datetime] = None
    item: Optional['InventoryItemOut'] = None

    model_config = ConfigDict(from_attributes=True)

class InventoryItemBase(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity_on_hand: Optional[int] = 0
    cost: Optional[float] = None
    location: Optional[str] = None
    barcode: Optional[str] = None

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemOut(InventoryItemBase):
    item_id: str

    model_config = ConfigDict(from_attributes=True)

class InventoryTransactionType(str, enum.Enum):
    in_ = 'in'
    out = 'out'
    adjust = 'adjust'

class InventoryTransactionBase(BaseModel):
    item_id: str
    user_id: str
    shipment_id: Optional[str] = None
    ticket_id: Optional[str] = None
    date: date
    quantity: int
    type: InventoryTransactionType
    notes: Optional[str] = None

class InventoryTransactionCreate(InventoryTransactionBase):
    pass

class InventoryTransactionOut(InventoryTransactionBase):
    transaction_id: str

class TaskStatus(str, enum.Enum):
    open = 'open'
    in_progress = 'in_progress'
    completed = 'completed'

class TaskBase(BaseModel):
    ticket_id: Optional[str] = None
    assigned_user_id: Optional[str] = None
    description: str
    status: Optional[TaskStatus] = TaskStatus.open
    due_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass


class TaskAssignedUserOut(BaseModel):
    """Minimal user info for task list."""
    user_id: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class TaskOut(TaskBase):
    task_id: str
    assigned_user: Optional[TaskAssignedUserOut] = None
    model_config = ConfigDict(from_attributes=True) 

class TicketCommentBase(BaseModel):
    comment: str
    is_internal: Optional[bool] = False

class TicketCommentCreate(TicketCommentBase):
    pass

class TicketCommentUpdate(BaseModel):
    comment: Optional[str] = None
    is_internal: Optional[bool] = None

class TicketCommentOut(TicketCommentBase):
    comment_id: str
    ticket_id: str
    user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user: Optional['UserOut'] = None
    
    model_config = ConfigDict(from_attributes=True)

class TimeEntryBase(BaseModel):
    ticket_id: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    is_billable: Optional[bool] = True
    created_at: Optional[datetime] = None

class TimeEntryCreate(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    is_billable: Optional[bool] = True

class TimeEntryUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    is_billable: Optional[bool] = None
    hourly_rate: Optional[float] = None

class TimeEntryOut(TimeEntryBase):
    entry_id: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int  # seconds until access token expires
    must_change_password: Optional[bool] = False

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, description="New password (min 8 characters)")

class StatusUpdate(BaseModel):
    status: TicketStatus

class BulkTicketStatusUpdate(BaseModel):
    ticket_ids: List[str]
    status: TicketStatus

class WorkflowTransitionRequest(BaseModel):
    """Required for workflow-transition and return_received; ensures optimistic locking."""
    workflow_state: TicketWorkflowState
    expected_ticket_version: int = Field(..., ge=1, description="Current ticket version; 409 if stale")
    convert_to_type: Optional[TicketType] = None
    notes: Optional[str] = None
    schedule_date: Optional[date] = None
    follow_up_date: Optional[date] = None
    follow_up_notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("notes", "follow_up_notes", mode="before")
    @classmethod
    def clean_notes(cls, v):
        if v is None or not isinstance(v, str):
            return v
        return re.sub(r"[^\x20-\x7E\t\r\n]", "", v).strip()

    @field_validator("expected_ticket_version", mode="before")
    @classmethod
    def validate_expected_version(cls, v):
        if v is None:
            return v
        iv = int(v)
        if iv < 1:
            raise ValueError("expected_ticket_version must be >= 1")
        return iv


class ReturnReceiptRequest(BaseModel):
    expected_ticket_version: int = Field(..., ge=1, description="Current ticket version; 409 if stale")
    notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("notes", mode="before")
    @classmethod
    def clean_notes(cls, v):
        if v is None or not isinstance(v, str):
            return v
        return re.sub(r"[^\x20-\x7E\t\r\n]", "", v).strip()


class QueueAgingMetric(BaseModel):
    queue: str
    count: int
    avg_age_hours: float
    max_age_hours: float


class TimeSpentByUserMetric(BaseModel):
    user_id: str
    user_name: str
    minutes: int


class WorkflowSummaryReport(BaseModel):
    generated_at: datetime
    lookback_days: int
    status_counts: Dict[str, int]
    workflow_state_counts: Dict[str, int]
    queue_aging: List[QueueAgingMetric]
    onsite_too_long_count: int
    onsite_too_long_ticket_ids: List[str]
    returns_outstanding_count: int
    returns_outstanding_ticket_ids: List[str]
    nro_phase1_pending_count: int
    nro_phase2_pending_count: int
    nro_ready_for_completion_count: int
    top_categories: Dict[str, int]
    time_spent_by_user: List[TimeSpentByUserMetric]
    field_tech_avg_onsite_minutes: float

class TicketClaim(BaseModel):
    claimed_by: str

class TicketCheckIn(BaseModel):
    check_in_time: datetime
    onsite_tech_id: str

class TicketCheckOut(BaseModel):
    check_out_time: datetime
    time_spent: Optional[int] = None
    parts_used: Optional[str] = None
    notes: Optional[str] = None
    needs_shipping: Optional[bool] = False
    is_completed: Optional[bool] = True

class DailyTicketFilter(BaseModel):
    date: Optional[date] = None
    ticket_type: Optional[TicketType] = None
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_user_id: Optional[str] = None

class TicketCostUpdate(BaseModel):
    billing_rate: Optional[float] = None
    total_cost: Optional[float] = None

class BulkTicketStatusUpdate(BaseModel):
    ticket_ids: List[str]
    status: TicketStatus

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[UserRole] = None

class SLARuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    ticket_type: Optional[TicketType] = None
    customer_impact: Optional[ImpactLevel] = None
    business_priority: Optional[BusinessPriority] = None
    sla_target_hours: Optional[int] = 24
    sla_breach_hours: Optional[int] = 48
    escalation_levels: Optional[int] = 3
    is_active: Optional[bool] = True

class SLARuleCreate(SLARuleBase):
    pass

class SLARuleUpdate(SLARuleBase):
    name: Optional[str] = None

class SLARuleOut(SLARuleBase):
    rule_id: str
    created_at: datetime
    updated_at: datetime

# Site Equipment Schemas
class SiteEquipmentBase(BaseModel):
    site_id: str
    equipment_type: Optional[str] = None
    model: Optional[str] = None
    part_number: Optional[str] = None
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    maintenance_notes: Optional[str] = None
    rack_location: Optional[str] = None
    additional_details: Optional[str] = None

class SiteEquipmentCreate(SiteEquipmentBase):
    pass

class SiteEquipmentUpdate(BaseModel):
    equipment_type: Optional[str] = None
    model: Optional[str] = None
    part_number: Optional[str] = None
    serial_number: Optional[str] = None
    installation_date: Optional[date] = None
    maintenance_notes: Optional[str] = None
    rack_location: Optional[str] = None
    additional_details: Optional[str] = None

class SiteEquipmentOut(SiteEquipmentBase):
    equipment_id: str
    created_at: datetime
    updated_at: datetime

# Ticket Attachment Schemas
class TicketAttachmentBase(BaseModel):
    ticket_id: str
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    external_url: Optional[str] = None
    description: Optional[str] = None

class TicketAttachmentCreate(TicketAttachmentBase):
    pass

class TicketAttachmentUpdate(BaseModel):
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    description: Optional[str] = None

class TicketAttachmentOut(TicketAttachmentBase):
    attachment_id: str
    uploaded_by: str
    uploaded_at: datetime 
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Tooltip,
  Breadcrumbs,
  Link,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment,
  Business,
  Person,
  LocalShipping,
  Build,
  Settings,
  Logout,
  Notifications,
  Brightness4,
  Brightness7,
  ExpandLess,
  ExpandMore,
  ChevronRight,
  Home,
  Map,
  Assessment,
  Speed,
  Security,
  AdminPanelSettings,
  Engineering,
  AccountCircle,
  KeyboardArrowDown,
  Palette,
  Clear,
  CheckCircle,
  Warning,
  Error,
  Info
} from '@mui/icons-material';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationProvider';
import { DataSyncProvider } from './contexts/DataSyncContext';
import ThemePreview from './components/ThemePreview';
import Logo from './components/Logo';
import Login from './Login';
// COMPACT COMPONENTS - New high-density UI
import CompactOperationsDashboard from './components/CompactOperationsDashboard';
import CompactTickets from './CompactTickets';
import CompactTicketDetail from './CompactTicketDetail';
import CompactTicketFormComplete from './CompactTicketFormComplete';
import CompactSites from './CompactSites';
import CompactSiteDetail from './CompactSiteDetail';
import CompactSiteForm from './CompactSiteForm';
import CompactShipments from './CompactShipments';
import CompactShipmentForm from './CompactShipmentForm';
import CompactInventory from './CompactInventory';
import CompactInventoryForm from './CompactInventoryForm';
import CompactFieldTechs from './CompactFieldTechs';
import CompactFieldTechForm from './CompactFieldTechForm';
import CompactFieldTechCompanies from './CompactFieldTechCompanies';
import CompactFieldTechCompanyForm from './CompactFieldTechCompanyForm';
import CompactTasks from './CompactTasks';
import CompactTaskForm from './CompactTaskForm';
import CompactUsers from './CompactUsers';
import CompactUserForm from './CompactUserForm';
// OLD COMPONENTS (still used for Equipment only)
import EquipmentForm from './EquipmentForm';
// OTHER COMPONENTS
import { getApiPath } from './apiPaths';
import SLAManagement from './SLAManagement';
import ErrorBoundary from './components/ErrorBoundary';
import Equipment from './Equipment';
import Audit from './Audit';
import FieldTechMap from './FieldTechMap';
import TicketClaim from './TicketClaim';
import DispatchQueue from './DispatchQueue';
import CompactSidebar from './components/CompactSidebar';
import CompactNewTicketStepper from './components/CompactNewTicketStepper';
import SettingsPage from './Settings';
import Profile from './Profile';

import ChangePassword from './ChangePassword';
import useApi from './hooks/useApi';
import { useToast } from './contexts/ToastContext';
import { createAppTheme, colorThemes } from './theme';

// Lazy-loaded routes (code splitting) - FieldTechMap eager: Leaflet needs sync load
const ModernDashboard = lazy(() => import('./components/ModernDashboard'));
const Reports = lazy(() => import('./Reports'));

const drawerWidthOpen = 260;
const drawerWidthCollapsed = 72;

// SiteFormWrapper component to handle form submission
function SiteFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/sites/', values);
      success('Site created successfully');
      navigate('/sites');
    } catch (err) {
      console.error('Error creating site:', err);
      error('Error creating site');
    }
  };

  return null;
}

// UserFormWrapper component to handle form submission
function UserFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/users/', cleanFormData(values));
      success('User created successfully');
      navigate('/users');
    } catch (err) {
      console.error('Error creating user:', err);
      error('Error creating user');
    }
  };

  return null;
}

// EquipmentFormWrapper component to handle form submission
function EquipmentFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/equipment/', values);
      success('Equipment created successfully');
      navigate('/equipment');
    } catch (err) {
      console.error('Error creating equipment:', err);
      error('Error creating equipment');
    }
  };

  return <EquipmentForm onSubmit={handleSubmit} />;
}

// InventoryFormWrapper component to handle form submission
function InventoryFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/inventory/', cleanFormData(values));
      success('Inventory item created successfully');
      navigate('/inventory');
    } catch (err) {
      console.error('Error creating inventory item:', err);
      error('Error creating inventory item');
    }
  };

  return null;
}

// TaskFormWrapper component to handle form submission
function TaskFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/tasks/', cleanFormData(values));
      success('Task created successfully');
      navigate('/tasks');
    } catch (err) {
      console.error('Error creating task:', err);
      error('Error creating task');
    }
  };

  return null;
}

// ShipmentFormWrapper component to handle form submission
function ShipmentFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    try {
      await api.post('/shipments/', cleanFormData(values));
      success('Shipment created successfully');
      navigate('/shipments');
    } catch (err) {
      console.error('Error creating shipment:', err);
      error('Error creating shipment');
    }
  };

  const handleClose = () => {
    navigate('/shipments');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Add New Shipment</Typography>
      {/* Legacy ShipmentForm removed */}
    </Box>
  );
}

// Edit wrapper components
function TicketEditWrapper() {
  const navigate = useNavigate();
  const { ticket_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = useCallback(async () => {
    try {
      const response = await api.get(`/tickets/${ticket_id}`);
      setTicket(response);
    } catch (err) {
      console.error('Error fetching ticket:', err);
      error('Error loading ticket');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  }, [ticket_id, api, navigate, error]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/tickets/${ticket_id}`, values);
      success('Ticket updated successfully');
      navigate('/tickets');
    } catch (err) {
      console.error('Error updating ticket:', err);
      error('Error updating ticket');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!ticket) return <div>Ticket not found</div>;

  return null;
}

function SiteEditWrapper() {
  const navigate = useNavigate();
  const { site_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSite = useCallback(async () => {
    try {
      const response = await api.get(`/sites/${site_id}`);
      setSite(response);
    } catch (err) {
      console.error('Error fetching site:', err);
      error('Error loading site');
      navigate('/sites');
    } finally {
      setLoading(false);
    }
  }, [site_id, api, navigate, error]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/sites/${site_id}`, values);
      success('Site updated successfully');
      navigate('/sites');
    } catch (err) {
      console.error('Error updating site:', err);
      error('Error updating site');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!site) return <div>Site not found</div>;

  return null;
}

function UserEditWrapper() {
  const navigate = useNavigate();
  const { user_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get(`/users/${user_id}`);
      setUser(response);
    } catch (err) {
      console.error('Error fetching user:', err);
      error('Error loading user');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  }, [user_id, api, navigate, error]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/users/${user_id}`, values);
      success('User updated successfully');
      navigate('/users');
    } catch (err) {
      console.error('Error updating user:', err);
      error('Error updating user');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return null;
}

function EquipmentEditWrapper() {
  const navigate = useNavigate();
  const { equipment_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        const response = await api.get(`/equipment/${equipment_id}`);
        setEquipment(response);
      } catch (err) {
        console.error('Error fetching equipment:', err);
        error('Error loading equipment');
        navigate('/equipment');
      } finally {
        setLoading(false);
      }
    };
    fetchEquipment();
  }, [equipment_id, api, navigate, error]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/equipment/${equipment_id}`, values);
      success('Equipment updated successfully');
      navigate('/equipment');
    } catch (err) {
      console.error('Error updating equipment:', err);
      error('Error updating equipment');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!equipment) return <div>Equipment not found</div>;

  return <EquipmentForm onSubmit={handleSubmit} initialValues={equipment} isEdit={true} />;
}

function InventoryEditWrapper() {
  const navigate = useNavigate();
  const { item_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchItem = useCallback(async () => {
      try {
        const response = await api.get(`/inventory/${item_id}`);
        setItem(response);
      } catch (err) {
        console.error('Error fetching inventory item:', err);
        error('Error loading inventory item');
        navigate('/inventory');
      } finally {
        setLoading(false);
      }
  }, [item_id, api, navigate, error]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/inventory/${item_id}`, values);
      success('Inventory item updated successfully');
      navigate('/inventory');
    } catch (err) {
      console.error('Error updating inventory item:', err);
      error('Error updating inventory item');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!item) return <div>Inventory item not found</div>;

  return null;
}

function TaskEditWrapper() {
  const navigate = useNavigate();
  const { task_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await api.get(`/tasks/${task_id}`);
        setTask(response);
      } catch (err) {
        console.error('Error fetching task:', err);
        error('Error loading task');
        navigate('/tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [task_id, api, navigate, error]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/tasks/${task_id}`, values);
      success('Task updated successfully');
      navigate('/tasks');
    } catch (err) {
      console.error('Error updating task:', err);
      error('Error updating task');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!task) return <div>Task not found</div>;

  return null;
}

function ShipmentEditWrapper() {
  const navigate = useNavigate();
  const { shipment_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchShipment = useCallback(async () => {
    try {
      const response = await api.get(`/shipments/${shipment_id}`);
      setShipment(response);
    } catch (err) {
      console.error('Error fetching shipment:', err);
      error('Error loading shipment');
      navigate('/shipments');
    } finally {
      setLoading(false);
    }
  }, [shipment_id, api, navigate, error]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleSubmit = async (values) => {
    try {
      await api.put(`/shipments/${shipment_id}`, values);
      success('Shipment updated successfully');
      navigate('/shipments');
    } catch (err) {
      console.error('Error updating shipment:', err);
      error('Error updating shipment');
    }
  };

  const handleClose = () => {
    navigate('/shipments');
  };

  if (loading) return <div>Loading...</div>;
  if (!shipment) return <div>Shipment not found</div>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Edit Shipment</Typography>
      {/* Legacy ShipmentForm removed */}
    </Box>
  );
}

// ========================================
// COMPACT FORM WRAPPERS - High Density UI
// ========================================

// Utility function to clean form data - removes empty strings for optional fields
const cleanFormData = (data) => {
  const cleaned = {};
  // Ticket date/numeric fields: send null when empty so backend validation is consistent
  const ticketNullIfEmpty = [
    'item_id', 'ticket_id', 'assigned_user_id', 'charges_out', 'charges_in', 'parts_cost', 'total_cost',
    'date_shipped', 'date_returned', 'date_created', 'date_scheduled', 'date_closed', 'due_date',
    'time_spent', 'sla_target_hours', 'sla_breach_hours', 'escalation_level',
    'estimated_hours', 'actual_hours', 'billing_rate', 'quality_score',
    'follow_up_date', 'nro_phase1_scheduled_date', 'nro_phase2_scheduled_date'
  ];
  for (const [key, value] of Object.entries(data)) {
    if (ticketNullIfEmpty.includes(key)) {
      cleaned[key] = (value === '' || value === null || value === undefined) ? null : value;
      continue;
    }
    if (value === '' || value === null || value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
};

// Ticket update/create payloads must exclude relation-only fields returned by GET /tickets/{id}
// because backend write schemas use extra="forbid".
const stripTicketReadOnlyFields = (data) => {
  const cleaned = { ...(data || {}) };
  const forbidden = [
    'ticket_id',
    'created_at',
    'site',
    'assigned_user',
    'claimed_user',
    'onsite_tech',
    'last_updated_user',
    'approved_user',
    'audits',
    'tasks',
    'shipments',
    'inventory_transactions',
    'comments',
    'time_entries',
    'attachments',
  ];
  for (const key of forbidden) {
    if (key in cleaned) delete cleaned[key];
  }
  return cleaned;
};

function CompactTicketFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();

  const handleSubmit = async (values) => {
    const cleanedData = stripTicketReadOnlyFields(cleanFormData(values));
    await api.post('/tickets/', cleanedData);
    success('Ticket created');
    navigate('/tickets');
  };

  const handleSubmitForStepper = async (values) => {
    try {
      const cleanedData = stripTicketReadOnlyFields(cleanFormData(values));
      await api.post('/tickets/', cleanedData);
      success('Ticket created');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to create ticket';
      error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      throw err;
    }
  };

  return <CompactNewTicketStepper onSubmit={handleSubmitForStepper} />;
}

function CompactTicketEditWrapper() {
  const navigate = useNavigate();
  const { ticket_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await api.get(`/tickets/${ticket_id}`);
        setTicket(response);
      } catch {
        error('Error loading ticket');
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [ticket_id, api, error]);
  
  const handleSubmit = async (values) => {
    try {
      const cleanedData = stripTicketReadOnlyFields(cleanFormData(values));
      // Optimistic concurrency: prevent silent overwrites from stale edit forms.
      cleanedData.expected_ticket_version = ticket?.ticket_version ?? values?.ticket_version ?? 1;
      await api.put(`/tickets/${ticket_id}`, cleanedData);
      success('Ticket updated');
      navigate(`/tickets/${ticket_id}`);
    } catch (err) {
      const isConflict = err?.response?.status === 409;
      const msg = isConflict
        ? 'This ticket was updated by another user. Refresh and retry your changes.'
        : (err?.response?.data?.detail || err?.message || 'Failed to update ticket');
      error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  // Normalize ticket for form: date inputs need YYYY-MM-DD; strip undefined/readonly API fields
  const normalizedTicket = ticket ? (() => {
    const toDateOnly = (v) => {
      if (v == null || v === '') return '';
      const s = typeof v === 'string' ? v : (v && v.toISOString?.()) || '';
      return s.slice(0, 10) || '';
    };
    return {
      ...ticket,
      date_created: toDateOnly(ticket.date_created),
      date_scheduled: toDateOnly(ticket.date_scheduled),
      date_closed: toDateOnly(ticket.date_closed),
      due_date: ticket.due_date ? (typeof ticket.due_date === 'string' && ticket.due_date.length > 10 ? ticket.due_date.slice(0, 16) : ticket.due_date) : '',
      check_in_time: ticket.check_in_time || '',
      check_out_time: ticket.check_out_time || '',
      claimed_at: ticket.claimed_at || '',
      approved_at: ticket.approved_at || '',
      start_time: ticket.start_time || '',
      end_time: ticket.end_time || '',
    };
  })() : null;

  if (loading) return <div>Loading...</div>;
  if (!ticket) return <div>Not found</div>;
  return <CompactTicketFormComplete onSubmit={handleSubmit} initialValues={normalizedTicket} isEdit={true} />;
}

function CompactSiteFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const handleSubmit = async (values) => {
    try {
      await api.post('/sites/', cleanFormData(values));
      success('Site created');
      navigate('/sites');
    } catch {
      error('Failed');
    }
  };
  return <CompactSiteForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} />;
}

function CompactSiteEditWrapper() {
  const navigate = useNavigate();
  const { site_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchSite = async () => {
      try {
        const response = await api.get(`/sites/${site_id}`);
        setSite(response);
      } catch {
        error('Error loading');
      } finally {
        setLoading(false);
      }
    };
    fetchSite();
  }, [site_id, api, error]);
  const handleSubmit = async (values) => {
    try {
      await api.put(`/sites/${site_id}`, cleanFormData(values));
      success('Site updated');
      navigate(`/sites/${site_id}`);
    } catch {
      error('Failed');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!site) return <div>Not found</div>;
  return <CompactSiteForm onSubmit={handleSubmit} initialValues={site} isEdit={true} />;
}

function CompactUserFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const handleSubmit = async (values) => {
    try {
      await api.post('/users/', cleanFormData(values));
      success('User created');
      navigate('/users');
    } catch {
      error('Failed');
    }
  };
  return <CompactUserForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} />;
}

function CompactUserEditWrapper() {
  const navigate = useNavigate();
  const { user_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${user_id}`);
        setUser(response);
      } catch {
        error('Error loading');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [user_id, api, error]);
  const handleSubmit = async (values) => {
    try {
      await api.put(`/users/${user_id}`, cleanFormData(values));
      success('User updated');
      navigate('/users');
    } catch {
      error('Failed');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not found</div>;
  return <CompactUserForm onSubmit={handleSubmit} initialValues={user} isEdit={true} />;
}

function CompactInventoryFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const handleSubmit = async (values) => {
    try {
      await api.post('/inventory/', cleanFormData(values));
      success('Item created');
      navigate('/inventory');
    } catch {
      error('Failed');
    }
  };
  return <CompactInventoryForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} />;
}

function CompactInventoryEditWrapper() {
  const navigate = useNavigate();
  const { item_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchItem = useCallback(async () => {
    try {
      const response = await api.get(`/inventory/${item_id}`);
      setItem(response);
    } catch {
      error('Error loading');
    } finally {
      setLoading(false);
    }
  }, [item_id, api, error]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);
  const handleSubmit = async (values) => {
    try {
      await api.put(`/inventory/${item_id}`, cleanFormData(values));
      success('Item updated');
      navigate('/inventory');
    } catch {
      error('Failed');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!item) return <div>Not found</div>;
  return <CompactInventoryForm onSubmit={handleSubmit} initialValues={item} isEdit={true} />;
}

function CompactTaskFormWrapper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApi();
  const { success, error } = useToast();
  const ticketId = searchParams.get('ticket_id') || '';
  const handleSubmit = async (values) => {
    try {
      await api.post('/tasks/', cleanFormData(values));
      success('Task created');
      navigate('/tasks');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to create task';
      error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };
  return <CompactTaskForm onSubmit={handleSubmit} initialValues={{ ticket_id: ticketId }} isEdit={false} />;
}

function CompactTaskEditWrapper() {
  const navigate = useNavigate();
  const { task_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await api.get(`/tasks/${task_id}`);
        setTask(response);
      } catch {
        error('Error loading');
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [task_id, api, error]);
  const handleSubmit = async (values) => {
    try {
      await api.put(`/tasks/${task_id}`, cleanFormData(values));
      success('Task updated');
      navigate('/tasks');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to update task';
      error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!task) return <div>Not found</div>;
  return <CompactTaskForm onSubmit={handleSubmit} initialValues={task} isEdit={true} taskId={task_id} onDeleted={() => navigate('/tasks')} />;
}

function CompactFieldTechFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const handleSubmit = async (values) => {
    try {
      await api.post('/fieldtechs/', cleanFormData(values));
      success('Field tech created');
      navigate('/fieldtechs');
    } catch {
      error('Failed');
    }
  };
  return <CompactFieldTechForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} />;
}

function CompactFieldTechEditWrapper() {
  const navigate = useNavigate();
  const { field_tech_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [fieldTech, setFieldTech] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchTech = async () => {
      try {
        const response = await api.get(`/fieldtechs/${field_tech_id}`);
        setFieldTech(response);
      } catch {
        error('Error loading');
      } finally {
        setLoading(false);
      }
    };
    fetchTech();
  }, [field_tech_id, api, error]);
  const handleSubmit = async (values) => {
    try {
      await api.put(`/fieldtechs/${field_tech_id}`, cleanFormData(values));
      success('Field tech updated');
      navigate('/fieldtechs');
    } catch {
      error('Failed');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!fieldTech) return <div>Not found</div>;
  return <CompactFieldTechForm onSubmit={handleSubmit} initialValues={fieldTech} isEdit={true} />;
}

function CompactShipmentFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const handleSubmit = async (values) => {
    try {
      await api.post('/shipments/', cleanFormData(values));
      success('Shipment created');
      navigate('/shipments');
    } catch {
      error('Failed');
    }
  };
  return <CompactShipmentForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} />;
}

function CompactShipmentEditWrapper() {
  const navigate = useNavigate();
  const { shipment_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchShipment = useCallback(async () => {
    try {
      const response = await api.get(`/shipments/${shipment_id}`);
      setShipment(response);
    } catch {
      error('Error loading');
    } finally {
      setLoading(false);
    }
  }, [shipment_id, api, error]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);
  const handleSubmit = async (values) => {
    try {
      console.log('Raw form values before cleaning:', values);
      const cleanData = cleanFormData(values);
      
      console.log('Form submission data:', cleanData);
      console.log('Current shipment status:', shipment?.status);
      console.log('New status:', cleanData.status);
      console.log('Remove from inventory in form:', cleanData.remove_from_inventory);
      console.log('Item ID in form:', cleanData.item_id);
      console.log('Status change detected:', cleanData.status === 'shipped' && shipment?.status !== 'shipped');
      
      // If status is being changed to 'shipped', use the status update endpoint
      // to ensure inventory is properly decremented
      if (cleanData.status === 'shipped' && shipment?.status !== 'shipped') {
        console.log('Status changing to shipped, using status update endpoint');
        console.log('Current shipment status:', shipment?.status);
        console.log('New status:', cleanData.status);
        console.log('Remove from inventory:', cleanData.remove_from_inventory);
        await api.patch(`/shipments/${shipment_id}/status`, {
          status: 'shipped',
          tracking_number: cleanData.tracking_number,
          return_tracking: cleanData.return_tracking,
          remove_from_inventory: cleanData.remove_from_inventory
        });
        // Update other fields that aren't handled by status update
        const { status, tracking_number, return_tracking, ...otherFields } = cleanData;
        if (Object.keys(otherFields).length > 0) {
          await api.put(`/shipments/${shipment_id}`, otherFields);
        }
      } else {
        console.log('Using regular PUT endpoint for update');
        // For all other updates, use the regular PUT endpoint
        await api.put(`/shipments/${shipment_id}`, cleanData);
      }
      
      success('Shipment updated');
      navigate('/shipments');
    } catch {
      error('Failed');
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!shipment) return <div>Not found</div>;
  return <CompactShipmentForm onSubmit={handleSubmit} initialValues={shipment} isEdit={true} />;
}

const COMPANY_SCHEMA_FIELDS = [
  'company_name', 'company_number', 'business_phone', 'other_phones',
  'address', 'city', 'state', 'zip', 'region', 'notes', 'service_radius_miles'
];
function cleanCompanyPayload(data) {
  const { techs, lat, lng, company_id, created_at, ...rest } = data;
  const cleaned = {};
  for (const key of COMPANY_SCHEMA_FIELDS) {
    const value = rest[key];
    if (value === undefined) continue;
    if (key === 'service_radius_miles') {
      cleaned[key] = (value === '' || value === null || value === undefined) ? null : Number(value);
    } else if (value === '' || value === null || value === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

async function runWithConcurrency(tasks, worker, maxConcurrent = 5) {
  if (!tasks.length) return;
  let idx = 0;
  const runners = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, async () => {
    while (idx < tasks.length) {
      const current = tasks[idx++];
      // eslint-disable-next-line no-await-in-loop
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function CompactFieldTechCompanyFormWrapper() {
  const navigate = useNavigate();
  const api = useApi();
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const handleSubmit = async (values) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { techs = [] } = values;
      const companyPayload = cleanCompanyPayload(values);
      const company = await api.post(`${getApiPath('fieldtechCompanies')}/`, companyPayload);
      const companyId = company?.company_id;
      if (companyId && techs.length) {
        const techCreates = techs.filter(t => (t.name || '').trim());
        await runWithConcurrency(techCreates, (t) => api.post(`${getApiPath('fieldtechs')}/`, {
          company_id: companyId,
          name: t.name?.trim(),
          tech_number: t.tech_number || null,
          phone: t.phone || null,
          email: t.email || null,
          service_radius_miles: t.service_radius_miles ? Number(t.service_radius_miles) : null
        }), 5);
      }
      success('Company created');
      navigate('/companies');
    } catch (err) {
      error(err?.response?.data?.detail || err?.message || 'Failed to create company');
    } finally {
      setIsSaving(false);
    }
  };
  return <CompactFieldTechCompanyForm onSubmit={handleSubmit} initialValues={{}} isEdit={false} isSaving={isSaving} />;
}

function CompactFieldTechCompanyEditWrapper() {
  const navigate = useNavigate();
  const { company_id } = useParams();
  const api = useApi();
  const { error, success } = useToast();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await api.get(`${getApiPath('fieldtechCompanies')}/${company_id}`);
        setCompany(response);
      } catch (err) {
        error(err?.response?.data?.detail || err?.message || 'Error loading company');
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [company_id, api, error]);
  const handleSubmit = async (values) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { techs = [] } = values;
      const companyPayload = cleanCompanyPayload(values);
      await api.put(`${getApiPath('fieldtechCompanies')}/${company_id}`, companyPayload);
      const existingTechIds = (company?.techs || []).map(t => t.field_tech_id);
      const submittedTechs = techs.filter(t => (t.name || '').trim());
      const submittedIds = submittedTechs.filter(t => t.field_tech_id).map(t => t.field_tech_id);
      const deleteIds = existingTechIds.filter((id) => !submittedIds.includes(id));
      await runWithConcurrency(deleteIds, (id) => api.delete(`${getApiPath('fieldtechs')}/${id}`).catch(() => null), 5);

      await runWithConcurrency(submittedTechs, (t) => {
        const payload = {
          company_id,
          name: t.name?.trim(),
          tech_number: t.tech_number || null,
          phone: t.phone || null,
          email: t.email || null,
          service_radius_miles: t.service_radius_miles ? Number(t.service_radius_miles) : null
        };
        if (t.field_tech_id) {
          return api.put(`${getApiPath('fieldtechs')}/${t.field_tech_id}`, payload);
        }
        return api.post(`${getApiPath('fieldtechs')}/`, payload);
      }, 5);
      success('Company updated');
      navigate('/companies');
    } catch (err) {
      error(err?.response?.data?.detail || err?.message || 'Failed to update company');
    } finally {
      setIsSaving(false);
    }
  };
  if (loading) return <div>Loading...</div>;
  if (!company) return <div>Not found</div>;
  return <CompactFieldTechCompanyForm onSubmit={handleSubmit} initialValues={company} isEdit={true} isSaving={isSaving} />;
}

// Theme: createAppTheme + colorThemes from ./theme.ts

const navigationItems = [
  { title: 'Daily Operations', path: '/', icon: <DashboardIcon />, badge: null },
  { title: 'Tickets', path: '/tickets', icon: <Assignment />, badge: null },
  { title: 'Sites', path: '/sites', icon: <Business />, badge: null },
  { title: 'Shipping', path: '/shipments', icon: <LocalShipping />, badge: null },
  { title: 'Inventory', path: '/inventory', icon: <Build />, badge: null },
  { title: 'Companies', path: '/companies', icon: <Business />, badge: null },
  { title: 'Tasks', path: '/tasks', icon: <Assessment />, badge: null },
  { title: 'Audit', path: '/audit', icon: <Security />, badge: null },
  { title: 'Users', path: '/users', icon: <Person />, badge: null },
  { title: 'Field Tech Map', path: '/map', icon: <Map />, badge: null },
  { title: 'SLA Management', path: '/sla', icon: <Speed />, badge: null }
];

const adminItems = [
  { title: 'Dispatcher Queue', path: '/dispatch-queue', icon: <Assignment />, badge: null },
  { title: 'Reports', path: '/reports', icon: <Assessment />, badge: null },
  { title: 'Settings', path: '/settings', icon: <Settings />, badge: null }
];

const canUseDispatchTools = (user) => user?.role === 'admin' || user?.role === 'dispatcher';

function AppLayout() {
  const { user, logout, loading } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, clearNotification } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') ?? 'false'); } catch { return false; }
  });
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set(['main']));
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const drawerWidth = sidebarCollapsed ? drawerWidthCollapsed : drawerWidthOpen;
  
  // Load theme preferences from localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [selectedColorTheme, setSelectedColorTheme] = useState(() => {
    const saved = localStorage.getItem('colorTheme');
    return saved || 'blue';
  });

  const location = useLocation();
  const navigate = useNavigate();
  const runtimeModeLabel = process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD';
  const runtimeModeColor = process.env.NODE_ENV === 'development' ? 'success' : 'warning';

  const theme = createAppTheme(darkMode, selectedColorTheme);

  // Save theme preferences to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('colorTheme', selectedColorTheme);
  }, [selectedColorTheme]);

  // When Settings page changes theme (writes localStorage + dispatches event), sync state so UI updates
  useEffect(() => {
    const onThemeChange = (e) => e?.detail && setSelectedColorTheme(e.detail);
    window.addEventListener('colorThemeChange', onThemeChange);
    return () => window.removeEventListener('colorThemeChange', onThemeChange);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  const handleClearAllNotifications = () => {
    clearAll();
    setNotificationsAnchor(null);
  };

  const handleMarkAsRead = (notificationId) => {
    markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleThemeChange = (newTheme) => {
    setSelectedColorTheme(newTheme);
    setThemeDialogOpen(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleExpanded = (section) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedItems(newExpanded);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
    handleUserMenuClose();
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/tickets/')) return 'Ticket Details';
    if (path.startsWith('/sites/')) return 'Site Details';
    if (path.startsWith('/users/')) return 'User Details';
    
    const item = [...navigationItems, ...adminItems].find(item => item.path === path);
    return item ? item.title : 'Page Not Found';
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const breadcrumbs = [{ title: 'Home', path: '/' }];
    
    if (path === '/') return breadcrumbs;
    
    if (path.startsWith('/tickets')) {
      breadcrumbs.push({ title: 'Tickets', path: '/tickets' });
      if (path !== '/tickets') {
        breadcrumbs.push({ title: 'Details', path: path });
      }
    } else if (path.startsWith('/sites')) {
      breadcrumbs.push({ title: 'Sites', path: '/sites' });
      if (path !== '/sites') {
        breadcrumbs.push({ title: 'Details', path: path });
      }
    } else if (path.startsWith('/users')) {
      breadcrumbs.push({ title: 'Users', path: '/users' });
      if (path !== '/users') {
        breadcrumbs.push({ title: 'Details', path: path });
      }
    } else {
      const item = [...navigationItems, ...adminItems].find(item => item.path === path);
      if (item) {
        breadcrumbs.push({ title: item.title, path: item.path });
      }
    }
    
    return breadcrumbs;
  };

  const drawerContent = (
    <CompactSidebar
      open={!sidebarCollapsed}
      onToggle={() => setSidebarCollapsed((s) => { const next = !s; localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); return next; })}
    />
  );

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Only redirect to login if we're not loading AND there's no user AND no tokens in sessionStorage
  if (!user && !sessionStorage.getItem('access_token')) {
    return <Navigate to="/login" replace />;
  }

  // If we have tokens but no user yet, show loading (this handles the refresh case)
  if (!user && sessionStorage.getItem('access_token')) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        display: 'flex', 
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}>
        <CssBaseline />
        
        {/* App Bar */}
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
            backgroundColor: 'background.paper',
            color: 'text.primary',
            boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
            zIndex: theme.zIndex.drawer + 1
          }}
        >
          <Toolbar sx={{ minHeight: 48 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                {getPageTitle()}
              </Typography>
              <Breadcrumbs separator={<ChevronRight fontSize="small" />}>
                {getBreadcrumbs().map((crumb, index) => (
                  <Link
                    key={index}
                    color={index === getBreadcrumbs().length - 1 ? 'text.primary' : 'inherit'}
                    href={crumb.path}
                    underline="hover"
                    sx={{ 
                      cursor: 'pointer',
                      fontSize: '0.8125rem'
                    }}
                  >
                    {crumb.title}
                  </Link>
                ))}
              </Breadcrumbs>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={`Runtime mode: ${runtimeModeLabel}`}>
                <Chip
                  label={runtimeModeLabel}
                  size="small"
                  color={runtimeModeColor}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              </Tooltip>

              {/* Notifications */}
              <Tooltip title="Notifications">
                <IconButton
                  color="inherit"
                  onClick={handleNotificationsOpen}
                  sx={{ position: 'relative' }}
                >
                  <Badge badgeContent={unreadCount} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Theme Customization */}
              <Tooltip title="Customize theme">
                <IconButton
                  color="inherit"
                  onClick={() => setThemeDialogOpen(true)}
                >
                  <Palette />
                </IconButton>
              </Tooltip>

              {/* Dark Mode Toggle */}
              <Tooltip title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}>
                <IconButton
                  color="inherit"
                  onClick={toggleDarkMode}
                >
                  {darkMode ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
              </Tooltip>

              {/* User Menu */}
              <Tooltip title="User menu">
                <IconButton
                  color="inherit"
                  onClick={handleUserMenuOpen}
                  sx={{ ml: 1 }}
                >
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                    {user?.name?.charAt(0) || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Drawer */}
        <Box
          component="nav"
          sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                transition: 'width 0.2s ease',
                backgroundColor: 'background.paper',
                borderRight: 1,
                borderColor: 'divider'
              },
            }}
          >
            {drawerContent}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerWidth,
                transition: 'width 0.2s ease',
                backgroundColor: 'background.paper',
                borderRight: 1,
                borderColor: 'divider'
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            mt: 6,
            backgroundColor: 'background.default',
            minHeight: 'calc(100vh - 48px)'
          }}
        >
          <Suspense fallback={<Box display="flex" justifyContent="center" alignItems="center" minHeight={300}><CircularProgress /></Box>}>
          <Routes>
            <Route path="/" element={<ModernDashboard />} />
            
            {/* Ticket Routes - ALL COMPACT */}
            <Route path="/tickets" element={<CompactTickets />} />
            <Route path="/tickets/new" element={<CompactTicketFormWrapper />} />
            <Route path="/tickets/:ticket_id" element={<CompactTicketDetail />} />
            <Route path="/tickets/:ticket_id/edit" element={<CompactTicketEditWrapper />} />
            <Route path="/tickets/:ticket_id/claim" element={<TicketClaim />} />
            
            {/* Site Routes - ALL COMPACT */}
            <Route path="/sites" element={<CompactSites />} />
            <Route path="/sites/new" element={<CompactSiteFormWrapper />} />
            <Route path="/sites/:site_id" element={<CompactSiteDetail />} />
            <Route path="/sites/:site_id/edit" element={<CompactSiteEditWrapper />} />
            
            {/* User Routes - ALL COMPACT */}
            <Route path="/users" element={<CompactUsers />} />
            <Route path="/users/new" element={<CompactUserFormWrapper />} />
            <Route path="/users/:user_id/edit" element={<CompactUserEditWrapper />} />
            
            {/* Equipment Routes */}
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/equipment/new" element={<EquipmentFormWrapper />} />
            <Route path="/equipment/:equipment_id/edit" element={<EquipmentEditWrapper />} />
            
            {/* Inventory Routes - ALL COMPACT */}
            <Route path="/inventory" element={<CompactInventory />} />
            <Route path="/inventory/new" element={<CompactInventoryFormWrapper />} />
            <Route path="/inventory/:item_id/edit" element={<CompactInventoryEditWrapper />} />
            
            {/* Task Routes - ALL COMPACT */}
            <Route path="/tasks" element={<CompactTasks />} />
            <Route path="/tasks/new" element={<CompactTaskFormWrapper />} />
            <Route path="/tasks/:task_id/edit" element={<CompactTaskEditWrapper />} />
            
            {/* Shipment Routes - ALL COMPACT */}
            <Route path="/shipments" element={<CompactShipments />} />
            <Route path="/shipments/new" element={<CompactShipmentFormWrapper />} />
            <Route path="/shipments/:shipment_id/edit" element={<CompactShipmentEditWrapper />} />
            
            {/* Field Tech Routes - ALL COMPACT */}
            <Route path="/fieldtechs" element={<CompactFieldTechs />} />
            <Route path="/fieldtechs/new" element={<CompactFieldTechFormWrapper />} />
            <Route path="/fieldtechs/:field_tech_id/edit" element={<CompactFieldTechEditWrapper />} />

            {/* Company Routes - ALL COMPACT */}
            <Route path="/companies" element={<CompactFieldTechCompanies />} />
            <Route path="/companies/new" element={<CompactFieldTechCompanyFormWrapper />} />
            <Route path="/companies/:company_id/edit" element={<CompactFieldTechCompanyEditWrapper />} />
            
            {/* Other Routes */}
            <Route path="/audit" element={<Audit />} />
            <Route path="/map" element={<FieldTechMap />} />
            <Route path="/sla" element={<SLAManagement />} />
            <Route path="/reports" element={canUseDispatchTools(user) ? <Reports /> : <Navigate to="/" replace />} />
            <Route path="/dispatch-queue" element={canUseDispatchTools(user) ? <DispatchQueue /> : <Navigate to="/" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/change-password" element={<ChangePassword userId={location.state?.userId || (user && user.user_id)} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Box>

        {/* User Menu */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          PaperProps={{
            sx: { minWidth: 200, mt: 1 }
          }}
        >
          <MenuItem onClick={() => {
            handleUserMenuClose();
            navigate('/profile');
          }}>
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem onClick={() => {
            handleUserMenuClose();
            navigate('/settings');
          }}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>

        {/* Notifications Menu */}
        <Menu
          anchorEl={notificationsAnchor}
          open={Boolean(notificationsAnchor)}
          onClose={handleNotificationsClose}
          PaperProps={{
            sx: { minWidth: 350, mt: 1, maxHeight: 400 }
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Notifications</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {unreadCount > 0 && (
                  <Button size="small" onClick={handleMarkAllAsRead}>
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <IconButton size="small" onClick={handleClearAllNotifications}>
                    <Clear fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Box>
          
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => (
              <MenuItem 
                key={notification.id}
                onClick={() => handleMarkAsRead(notification.id)}
                sx={{ 
                  opacity: notification.read ? 0.6 : 1,
                  borderBottom: 1, 
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 }
                }}
              >
                <ListItemIcon>
                  {notification.type === 'info' && <Info color="primary" />}
                  {notification.type === 'warning' && <Warning color="warning" />}
                  {notification.type === 'error' && <Error color="error" />}
                  {notification.type === 'success' && <CheckCircle color="success" />}
                </ListItemIcon>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {notification.timestamp ? new Date(notification.timestamp).toLocaleString([], { 
                      month: 'short', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'Just now'} • {notification.read ? 'Read' : 'Unread'}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Menu>

        {/* Theme Customization Dialog */}
        <Dialog 
          open={themeDialogOpen} 
          onClose={() => setThemeDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Palette />
              Customize Theme
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose your preferred color theme for the application
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(colorThemes).map(([themeName, colors]) => (
                <Grid item xs={6} sm={4} key={themeName}>
                  <ThemePreview
                    themeName={themeName}
                    colors={colors}
                    isSelected={selectedColorTheme === themeName}
                    onClick={() => handleThemeChange(themeName)}
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setThemeDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DataSyncProvider>
          <NotificationProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={
                  <RequireAuth>
                    <ErrorBoundary>
                      <AppLayout />
                    </ErrorBoundary>
                  </RequireAuth>
                } />
              </Routes>
            </Router>
          </NotificationProvider>
        </DataSyncProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

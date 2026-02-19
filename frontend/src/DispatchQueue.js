import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Stack,
  Tabs,
  Tab,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material';
import { Refresh, Search } from '@mui/icons-material';
import useApi from './hooks/useApi';
import { useToast } from './contexts/ToastContext';
import StatusChip from './components/StatusChip';
import TypeChip from './components/TypeChip';

const QUEUES = [
  { key: 'all', label: 'All' },
  { key: 'approval', label: 'Pending Approval' },
  { key: 'needstech', label: 'Needs Tech' },
  { key: 'goback', label: 'Go Back' },
  { key: 'returns', label: 'Returns/Follow Up' },
];

function DispatchQueue() {
  const api = useApi();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [queue, setQueue] = useState('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState({
    open: false,
    ticket: null,
    title: '',
    workflow_state: '',
    requireDate: false,
    convert_to_type: null,
    defaultNotes: '',
    approve: false
  });
  const [actionDate, setActionDate] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tickets/dispatch/queue?queue=${encodeURIComponent(queue)}&limit=300&skip=0`);
      setItems(res || []);
    } catch (e) {
      showError('Failed to load dispatcher queue');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      String(t.ticket_id || '').toLowerCase().includes(q) ||
      String(t.site_id || '').toLowerCase().includes(q) ||
      String(t.inc_number || '').toLowerCase().includes(q) ||
      String(t.so_number || '').toLowerCase().includes(q) ||
      String(t.workflow_state || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const transition = async (ticket, payload) => {
    try {
      await api.post(`/tickets/${ticket.ticket_id}/workflow-transition`, {
        ...payload,
        expected_ticket_version: ticket.ticket_version || 1
      });
      success('Queue action applied');
      load();
    } catch (e) {
      const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message || 'Queue action failed';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const approveArchive = async (ticket) => {
    try {
      await api.post(`/tickets/${ticket.ticket_id}/approve?approve=true`);
      success('Ticket approved and archived');
      load();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Approval failed';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const openTransitionDialog = (ticket, cfg) => {
    setActionDialog({
      open: true,
      ticket,
      title: cfg.title,
      workflow_state: cfg.workflow_state || '',
      requireDate: Boolean(cfg.requireDate),
      convert_to_type: cfg.convert_to_type || null,
      defaultNotes: cfg.defaultNotes || '',
      approve: Boolean(cfg.approve)
    });
    setActionDate(ticket?.date_scheduled || '');
    setActionNotes(cfg.defaultNotes || '');
  };

  const closeActionDialog = () => {
    setActionDialog({
      open: false,
      ticket: null,
      title: '',
      workflow_state: '',
      requireDate: false,
      convert_to_type: null,
      defaultNotes: '',
      approve: false
    });
    setActionDate('');
    setActionNotes('');
  };

  const submitActionDialog = async () => {
    const ticket = actionDialog.ticket;
    if (!ticket) return;
    if (actionDialog.approve) {
      await approveArchive(ticket);
      closeActionDialog();
      return;
    }
    if (actionDialog.requireDate && !actionDate) {
      showError('Please select a date before applying this action.');
      return;
    }
    const payload = {
      workflow_state: actionDialog.workflow_state
    };
    if (actionDialog.convert_to_type) payload.convert_to_type = actionDialog.convert_to_type;
    if (actionDialog.requireDate) payload.schedule_date = actionDate;
    if (actionNotes && actionNotes.trim()) payload.notes = actionNotes.trim();
    await transition(ticket, payload);
    closeActionDialog();
  };

  const runQueueAction = async (ticket) => {
    const ws = ticket.workflow_state;
    if (ws === 'pending_approval') {
      return openTransitionDialog(ticket, {
        title: `Approve ticket ${ticket.ticket_id}?`,
        approve: true
      });
    }

    if (ws === 'needstech') {
      return openTransitionDialog(ticket, {
        title: `Convert and schedule ${ticket.ticket_id}`,
        workflow_state: 'scheduled',
        convert_to_type: 'onsite',
        requireDate: true,
        defaultNotes: 'Converted from inhouse needstech to onsite scheduled'
      });
    }

    if (ws === 'goback_required') {
      return openTransitionDialog(ticket, {
        title: `Set go-back date for ${ticket.ticket_id}`,
        workflow_state: 'scheduled',
        requireDate: true,
        defaultNotes: 'Go-back date scheduled'
      });
    }

    if (ws === 'followup_required') {
      return transition(ticket, { workflow_state: 'pending_dispatch_review', notes: 'Follow-up reviewed by dispatcher' });
    }

    // NRO phase actions
    if (ws === 'nro_phase1_scheduled') {
      return transition(ticket, { workflow_state: 'nro_phase1_complete_pending_phase2', notes: 'Phase 1 marked complete' });
    }
    if (ws === 'nro_phase1_complete_pending_phase2') {
      return openTransitionDialog(ticket, {
        title: `Schedule NRO phase 2 for ${ticket.ticket_id}`,
        workflow_state: 'nro_phase2_scheduled',
        requireDate: true,
        defaultNotes: 'Phase 2 scheduled'
      });
    }
    if (ws === 'nro_phase1_goback_required') {
      return openTransitionDialog(ticket, {
        title: `Reschedule NRO phase 1 for ${ticket.ticket_id}`,
        workflow_state: 'nro_phase1_scheduled',
        requireDate: true,
        defaultNotes: 'Phase 1 go-back scheduled'
      });
    }
    if (ws === 'nro_phase2_goback_required') {
      return openTransitionDialog(ticket, {
        title: `Reschedule NRO phase 2 for ${ticket.ticket_id}`,
        workflow_state: 'nro_phase2_scheduled',
        requireDate: true,
        defaultNotes: 'Phase 2 go-back scheduled'
      });
    }
    if (ws === 'nro_phase2_scheduled') {
      return transition(ticket, { workflow_state: 'nro_ready_for_completion', notes: 'Phase 2 marked complete; ready for completion' });
    }
  };

  const actionLabel = (ticket) => {
    const ws = ticket.workflow_state;
    if (ws === 'pending_approval') return 'Approve';
    if (ws === 'needstech') return 'Convert/Schedule';
    if (ws === 'goback_required') return 'Set Go-Back';
    if (ws === 'followup_required') return 'Mark Reviewed';
    if (ws === 'nro_phase1_scheduled') return 'Phase 1 Done';
    if (ws === 'nro_phase1_complete_pending_phase2') return 'Schedule Phase 2';
    if (ws === 'nro_phase1_goback_required') return 'Reschedule P1';
    if (ws === 'nro_phase2_goback_required') return 'Reschedule P2';
    if (ws === 'nro_phase2_scheduled') return 'Phase 2 Done';
    return null;
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Paper sx={{ p: 1.5, mb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>Dispatcher Queue</Typography>
            <Typography variant="caption" color="text.secondary">
              Admin/dispatcher review for scheduling, approval, go-backs, and follow-ups
            </Typography>
          </Stack>
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={load} disabled={loading}>
                <Refresh fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tabs
            value={queue}
            onChange={(_, v) => setQueue(v)}
            sx={{ minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0, textTransform: 'none' } }}
          >
            {QUEUES.map((q) => <Tab key={q.key} value={q.key} label={q.label} />)}
          </Tabs>
          <TextField
            size="small"
            placeholder="Search ticket/site/INC/SO/state"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ ml: 'auto', width: 320, '& input': { fontSize: '0.85rem' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Stack>
      </Paper>

      <Paper>
        <Table size="small" sx={{ '& td, & th': { py: 0.6, px: 1, fontSize: '0.75rem' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Workflow</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell>Assigned</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.ticket_id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.ticket_id}`)}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{t.ticket_id}</TableCell>
                <TableCell>{t.site?.site_id || t.site_id || '-'}</TableCell>
                <TableCell><TypeChip type={t.type} size="small" /></TableCell>
                <TableCell><StatusChip status={t.status} entityType="ticket" size="small" /></TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={(t.workflow_state || '-').replace(/_/g, ' ')} />
                </TableCell>
                <TableCell>{t.date_scheduled || '-'}</TableCell>
                <TableCell>{t.assigned_user?.name || t.claimed_user?.name || '-'}</TableCell>
                <TableCell align="right">
                  {actionLabel(t) ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        runQueueAction(t);
                      }}
                    >
                      {actionLabel(t)}
                    </Button>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="caption" color="text.secondary">
                    {loading ? 'Loading queue...' : 'No tickets in this queue'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={actionDialog.open} onClose={closeActionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{actionDialog.title || 'Apply queue action'}</DialogTitle>
        <DialogContent>
          {actionDialog.requireDate && (
            <TextField
              margin="dense"
              label="Scheduled Date"
              type="date"
              fullWidth
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          )}
          {!actionDialog.approve && (
            <TextField
              margin="dense"
              label="Notes (optional)"
              fullWidth
              multiline
              minRows={2}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>Cancel</Button>
          <Button onClick={submitActionDialog} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DispatchQueue;

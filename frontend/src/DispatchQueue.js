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

  const promptDate = (label = 'Enter date (YYYY-MM-DD)') => {
    const v = window.prompt(label, '');
    if (!v) return null;
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      showError('Invalid date format. Use YYYY-MM-DD.');
      return null;
    }
    return s;
  };

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

  const runQueueAction = async (ticket) => {
    const ws = ticket.workflow_state;
    if (ws === 'pending_approval') return approveArchive(ticket);

    if (ws === 'needstech') {
      const date = promptDate('Schedule onsite date (YYYY-MM-DD)');
      if (!date) return;
      return transition(ticket, {
        workflow_state: 'scheduled',
        convert_to_type: 'onsite',
        schedule_date: date,
        notes: 'Converted from inhouse needstech to onsite scheduled'
      });
    }

    if (ws === 'goback_required') {
      const date = promptDate('Set go-back date (YYYY-MM-DD)');
      if (!date) return;
      return transition(ticket, { workflow_state: 'scheduled', schedule_date: date, notes: 'Go-back date scheduled' });
    }

    if (ws === 'followup_required') {
      return transition(ticket, { workflow_state: 'pending_dispatch_review', notes: 'Follow-up reviewed by dispatcher' });
    }

    // NRO phase actions
    if (ws === 'nro_phase1_scheduled') {
      return transition(ticket, { workflow_state: 'nro_phase1_complete_pending_phase2', notes: 'Phase 1 marked complete' });
    }
    if (ws === 'nro_phase1_complete_pending_phase2') {
      const date = promptDate('Schedule NRO phase 2 date (YYYY-MM-DD)');
      if (!date) return;
      return transition(ticket, { workflow_state: 'nro_phase2_scheduled', schedule_date: date, notes: 'Phase 2 scheduled' });
    }
    if (ws === 'nro_phase1_goback_required') {
      const date = promptDate('Schedule NRO phase 1 go-back date (YYYY-MM-DD)');
      if (!date) return;
      return transition(ticket, { workflow_state: 'nro_phase1_scheduled', schedule_date: date, notes: 'Phase 1 go-back scheduled' });
    }
    if (ws === 'nro_phase2_goback_required') {
      const date = promptDate('Schedule NRO phase 2 go-back date (YYYY-MM-DD)');
      if (!date) return;
      return transition(ticket, { workflow_state: 'nro_phase2_scheduled', schedule_date: date, notes: 'Phase 2 go-back scheduled' });
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
              Review tickets requiring scheduling, approval, go-backs, and follow-ups
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
    </Box>
  );
}

export default DispatchQueue;

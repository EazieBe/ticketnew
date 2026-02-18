import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Checkbox, Button, Stack, FormControl, Select, MenuItem,
  Typography, Tooltip, TextField, InputAdornment, Popover, FormControlLabel, Divider
} from '@mui/material';
import {
  Add, Visibility, Edit, Delete, PlayArrow, CheckCircle, LocalShipping, Search, Refresh, DoneAll, ViewColumn, UploadFile, Download
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import { useToast } from './contexts/ToastContext';
import useApi from './hooks/useApi';
import useThemeTokens from './hooks/useThemeTokens';
import StatusChip from './components/StatusChip';
import PriorityChip from './components/PriorityChip';
import TypeChip from './components/TypeChip';
import { useDataSync } from './contexts/DataSyncContext';
import { canDelete } from './utils/permissions';

function CompactTickets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const api = useApi();
  const { tableHeaderBg, rowHoverBg } = useThemeTokens();
  const { success, error: showError } = useToast();
  const apiRef = React.useRef(api);
  const { updateTrigger } = useDataSync('tickets');
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const urlType = searchParams.get('type');
  const urlStatus = searchParams.get('status');
  const urlWorkflowState = searchParams.get('workflow_state');
  const [filters, setFilters] = useState({
    type: urlType && ['onsite', 'inhouse', 'nro', 'projects', 'misc'].includes(urlType) ? urlType : 'all',
    status: urlStatus ? urlStatus : 'active',
    workflow_state: urlWorkflowState || 'all',
    priority: 'all',
    search: ''
  });
  // Sync filters when URL params change (e.g. from dashboard links)
  useEffect(() => {
    const t = searchParams.get('type');
    const s = searchParams.get('status');
    const ws = searchParams.get('workflow_state');
    setFilters(prev => ({
      ...prev,
      type: t && ['onsite', 'inhouse', 'nro', 'projects', 'misc'].includes(t) ? t : prev.type,
      status: s || prev.status,
      workflow_state: ws || prev.workflow_state
    }));
    setPage(0);
  }, [searchParams]);
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef(null);
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState({
    ticket_id: true,
    type: true,
    site: true,
    status: true,
    priority: true,
    assigned: true,
    date: true
  });

  // Keep API ref current
  React.useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', String(rowsPerPage));
      params.set('skip', String(page * rowsPerPage));
      if (filters.type !== 'all') params.set('ticket_type', filters.type);
      if (filters.status !== 'all') params.set('status', filters.status === 'active' ? '' : filters.status);
      if (filters.workflow_state && filters.workflow_state !== 'all') params.set('workflow_state', filters.workflow_state);
      if (filters.priority !== 'all') params.set('priority', filters.priority);
      if (filters.search) params.set('search', filters.search);
      // Fetch archived count first
      const archivedParams = new URLSearchParams();
      if (filters.type !== 'all') archivedParams.set('ticket_type', filters.type);
      if (filters.workflow_state && filters.workflow_state !== 'all') archivedParams.set('workflow_state', filters.workflow_state);
      if (filters.priority !== 'all') archivedParams.set('priority', filters.priority);
      if (filters.search) archivedParams.set('search', filters.search);
      archivedParams.set('status', 'archived');
      
      const archivedRes = await apiRef.current.get(`/tickets/count?${archivedParams.toString()}`);
      const archivedCount = archivedRes?.count ?? 0;
      setArchivedCount(archivedCount);
      
      // Fetch total count (all tickets)
      const countParams = new URLSearchParams();
      if (filters.type !== 'all') countParams.set('ticket_type', filters.type);
      if (filters.status !== 'all' && filters.status !== 'active') countParams.set('status', filters.status);
      if (filters.workflow_state && filters.workflow_state !== 'all') countParams.set('workflow_state', filters.workflow_state);
      if (filters.priority !== 'all') countParams.set('priority', filters.priority);
      if (filters.search) countParams.set('search', filters.search);
      const countRes = await apiRef.current.get(`/tickets/count?${countParams.toString()}`);
      const totalCount = countRes?.count ?? 0;
      
      // For active tickets, subtract archived count from total
      const activeCount = filters.status === 'active' ? totalCount - archivedCount : totalCount;
      setTotal(activeCount);
      
      const response = await apiRef.current.get(`/tickets/?${params.toString()}`);
      // When filtering by archived, keep them; otherwise exclude from list
      setTickets(
        filters.status === 'archived'
          ? (response || [])
          : (response || []).filter(t => t.status !== 'archived')
      );
    } catch (err) {
      showError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input -> filters.search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput.trim() }));
      setPage(0); // Reset to first page when search changes
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    fetchTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTrigger, page, rowsPerPage, filters.type, filters.status, filters.workflow_state, filters.priority, filters.search]);

  const filtered = useMemo(() => {
    let result = tickets;
    
    if (filters.type !== 'all') result = result.filter(t => t.type === filters.type);
    if (filters.status === 'active') result = result.filter(t => t.status !== 'archived');
    else if (filters.status === 'completed') result = result.filter(t => t.status === 'archived');
    else if (filters.status !== 'all') result = result.filter(t => t.status === filters.status);
    if (filters.workflow_state && filters.workflow_state !== 'all') result = result.filter(t => t.workflow_state === filters.workflow_state);
    if (filters.priority !== 'all') result = result.filter(t => t.priority === filters.priority);
    // server-side search now
    
    return result.sort((a, b) => {
      const pOrder = { emergency: 3, critical: 2, normal: 1 };
      return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
    });
  }, [tickets, filters]);

  const quickAction = async (ticketId, action, e) => {
    e.stopPropagation();
    try {
      if (action === 'claim') await api.put(`/tickets/${ticketId}/claim`, {});
      else if (action === 'complete') await api.put(`/tickets/${ticketId}/complete`, {});
      success('Updated');
      fetchTickets();
    } catch {
      showError('Failed');
    }
  };

  const bulkApprove = async () => {
    try {
      const results = await Promise.allSettled(Array.from(selected).map(id => api.post(`/tickets/${id}/approve?approve=true`)));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Unknown error');
        showError(`Approved ${succeeded}, failed ${failed}: ${errors[0]}`);
      } else {
        success(`Approved ${succeeded} ticket${succeeded !== 1 ? 's' : ''}`);
      }
      setSelected(new Set());
      fetchTickets();
    } catch (err) {
      showError(err?.message || 'Failed to approve tickets');
    }
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <Box sx={{ p: 1.5, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '0.95rem' }}>
          Tickets ({total ?? filtered.length}) • Archived ({archivedCount})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => navigate('/tickets/new')}>
            New Ticket
          </Button>
          <IconButton size="small" title="Export CSV" onClick={() => {
            const headers = ['ticket_id','type','site_id','status','priority','date_created','date_scheduled'];
            const rows = tickets.map(t => headers.map(h => (t[h] ?? '')).join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'tickets.csv'; a.click(); URL.revokeObjectURL(url);
          }}>
            <Download fontSize="small" />
          </IconButton>
          <IconButton size="small" component="label" title="Import CSV">
            <UploadFile fontSize="small" />
            <input type="file" accept=".csv" hidden onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const text = await file.text();
              const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
              const headers = headerLine.split(',');
              let imported = 0;
              for (const line of lines) {
                const cols = line.split(',');
                const record = Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
                try { await api.post('/tickets/', record); imported++; } catch {}
              }
              await fetchTickets();
              if (imported === 0) showError('No records imported');
            }} />
          </IconButton>
          <IconButton size="small" onClick={fetchTickets}><Refresh fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      {/* Compact Filters */}
      <Paper sx={{ p: 1, mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {selected.size > 0 ? (
            <>
              <Chip label={`${selected.size} selected`} size="small" onDelete={() => setSelected(new Set())} />
              <Button size="small" variant="contained" startIcon={<DoneAll />} onClick={bulkApprove}>Approve</Button>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">{total || filtered.length} tickets</Typography>
          )}
          
          <TextField
            size="small"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ width: 200, '& input': { py: 0.5, fontSize: '0.875rem' } }}
          />
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))} sx={{ fontSize: '0.875rem', height: 32 }}>
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="inhouse">Inhouse</MenuItem>
              <MenuItem value="onsite">Onsite</MenuItem>
              <MenuItem value="nro">NRO</MenuItem>
              <MenuItem value="projects">Projects</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} sx={{ fontSize: '0.875rem', height: 32 }}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select value={filters.workflow_state} onChange={(e) => setFilters(f => ({ ...f, workflow_state: e.target.value }))} sx={{ fontSize: '0.875rem', height: 32 }}>
              <MenuItem value="all">All Workflow</MenuItem>
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="claimed">Claimed</MenuItem>
              <MenuItem value="onsite">Onsite</MenuItem>
              <MenuItem value="offsite">Offsite</MenuItem>
              <MenuItem value="followup_required">Follow Up</MenuItem>
              <MenuItem value="needstech">Needs Tech</MenuItem>
              <MenuItem value="goback_required">Go Back</MenuItem>
              <MenuItem value="pending_dispatch_review">Pending Dispatch Review</MenuItem>
              <MenuItem value="pending_approval">Pending Approval</MenuItem>
              <MenuItem value="nro_phase1_scheduled">NRO Phase 1 Scheduled</MenuItem>
              <MenuItem value="nro_phase1_complete_pending_phase2">NRO Phase 1 Complete</MenuItem>
              <MenuItem value="nro_phase1_goback_required">NRO P1 Go Back</MenuItem>
              <MenuItem value="nro_phase2_scheduled">NRO Phase 2 Scheduled</MenuItem>
              <MenuItem value="nro_phase2_goback_required">NRO P2 Go Back</MenuItem>
              <MenuItem value="nro_ready_for_completion">NRO Ready Completion</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select value={filters.priority} onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))} sx={{ fontSize: '0.875rem', height: 32 }}>
              <MenuItem value="all">All Priority</MenuItem>
              <MenuItem value="emergency">Emergency</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
          
          <IconButton size="small" onClick={(e) => setColumnAnchor(e.currentTarget)} title="Show/Hide Columns">
            <ViewColumn fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      {/* Ultra-Compact Table */}
      <Paper sx={{ flex: 1, overflow: 'hidden' }}>
        <TableContainer sx={{ height: '100%' }}>
          <Table size="small" stickyHeader sx={{ '& td, & th': { py: 0.5, px: 1, fontSize: '0.75rem' } }}>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: tableHeaderBg, fontWeight: 'bold', borderBottom: 2, borderColor: 'primary.main' } }}>
                <TableCell padding="checkbox" sx={{ width: 40 }}>
                  <Checkbox size="small" onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map(t => t.ticket_id)) : new Set())} />
                </TableCell>
                {visibleColumns.ticket_id && <TableCell sx={{ width: 100 }}>ID</TableCell>}
                {visibleColumns.type && <TableCell sx={{ width: 60 }}>Type</TableCell>}
                {visibleColumns.site && <TableCell>Site</TableCell>}
                {visibleColumns.status && <TableCell sx={{ width: 100 }}>Status</TableCell>}
                {visibleColumns.priority && <TableCell sx={{ width: 70 }}>Priority</TableCell>}
                {visibleColumns.date && <TableCell sx={{ width: 80 }}>Date</TableCell>}
                {visibleColumns.assigned && <TableCell sx={{ width: 90 }}>Assigned</TableCell>}
                <TableCell sx={{ width: 120 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => {
                return (
                  <TableRow
                    key={t.ticket_id}
                    hover
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: rowHoverBg } }}
                    onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={selected.has(t.ticket_id)}
                        onChange={() => {
                          const s = new Set(selected);
                          s.has(t.ticket_id) ? s.delete(t.ticket_id) : s.add(t.ticket_id);
                          setSelected(s);
                        }}
                      />
                    </TableCell>
                    {visibleColumns.ticket_id && (
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>
                          {t.ticket_id}
                        </Typography>
                      </TableCell>
                    )}
                    {visibleColumns.type && (
                      <TableCell>
                        <TypeChip type={t.type} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                      </TableCell>
                    )}
                    {visibleColumns.site && (
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', minWidth: 160 }}>
                            {t.site_id}{t.site?.location ? ` - ${t.site.location}` : ''}
                          </Typography>
                          <Stack spacing={0} sx={{ lineHeight: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>C:{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>Cl:{t.claimed_at ? new Date(t.claimed_at).toLocaleString() : '-'}</Typography>
                          </Stack>
                          <Stack spacing={0} sx={{ lineHeight: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>Cm:{t.end_time || t.check_out_time ? new Date(t.end_time || t.check_out_time).toLocaleString() : '-'}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>Ap:{t.approved_at ? new Date(t.approved_at).toLocaleString() : '-'}</Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                    )}
                    {visibleColumns.status && (
                      <TableCell>
                        <StatusChip status={t.status} entityType="ticket" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                      </TableCell>
                    )}
                    {visibleColumns.priority && (
                      <TableCell>
                        <PriorityChip priority={t.priority} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                      </TableCell>
                    )}
                    {visibleColumns.date && (
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {t.date_scheduled ? new Date(t.date_scheduled).toLocaleDateString() : ''}
                        </Typography>
                      </TableCell>
                    )}
                    {visibleColumns.assigned && (
                      <TableCell>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                          {(t.claimed_user?.name || t.assigned_user?.name || '-')}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5}>
                        {!['completed','closed','approved'].includes(t.status) && (
                          <Tooltip title={t.claimed_at ? 'Complete' : 'Claim'}>
                            <IconButton size="small" color="success" onClick={(e) => quickAction(t.ticket_id, t.claimed_at ? 'complete' : 'claim', e)} sx={{ p: 0.3 }}>
                              {t.claimed_at ? <CheckCircle sx={{ fontSize: 16 }} /> : <PlayArrow sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                        {t.status === 'completed' && (user?.role === 'admin' || user?.role === 'dispatcher') && (
                          <Tooltip title="Approve"><IconButton size="small" color="primary" onClick={async (e) => { e.stopPropagation(); try { await api.post(`/tickets/${t.ticket_id}/approve?approve=true`); success('Approved'); fetchTickets(); } catch (err) { showError(err?.response?.data?.detail || err?.message || 'Approve failed'); } }} sx={{ p: 0.3 }}>
                            <DoneAll sx={{ fontSize: 16 }} />
                          </IconButton></Tooltip>
                        )}
                        <Tooltip title="View"><IconButton size="small" sx={{ p: 0.3 }}>
                          <Visibility sx={{ fontSize: 16 }} />
                        </IconButton></Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
          {total === 0 ? '0' : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, total)}`} of {total}
          {total > 0 && (
            <Box component="span" sx={{ ml: 1, color: 'text.secondary' }}>
              · Page {page + 1} of {Math.max(1, Math.ceil(total / rowsPerPage))}
            </Box>
          )}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Rows</Typography>
          <FormControl size="small" sx={{ minWidth: 72 }}>
            <Select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} sx={{ fontSize: '0.8125rem', height: 28 }}>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={200}>200</MenuItem>
              <MenuItem value={250}>250</MenuItem>
              <MenuItem value={500}>500</MenuItem>
            </Select>
          </FormControl>
          <Button size="small" disabled={page === 0} onClick={() => setPage(0)} sx={{ minWidth: 32, fontSize: '0.75rem' }}>First</Button>
          <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} sx={{ minWidth: 32, fontSize: '0.75rem' }}>Prev</Button>
          <Button size="small" disabled={(page + 1) * rowsPerPage >= total} onClick={() => setPage((p) => p + 1)} sx={{ minWidth: 32, fontSize: '0.75rem' }}>Next</Button>
          <Button size="small" disabled={total === 0 || (page + 1) * rowsPerPage >= total} onClick={() => setPage(Math.max(0, Math.ceil(total / rowsPerPage) - 1))} sx={{ minWidth: 32, fontSize: '0.75rem' }}>Last</Button>
        </Stack>
      </Box>

      {/* Column Visibility Popover */}
      <Popover
        open={Boolean(columnAnchor)}
        anchorEl={columnAnchor}
        onClose={() => setColumnAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            maxHeight: 500,
            overflow: 'auto'
          }
        }}
      >
        <Box sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2" fontWeight="bold" mb={1}>Show/Hide Columns</Typography>
          <Divider sx={{ mb: 1 }} />
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.ticket_id} onChange={() => toggleColumn('ticket_id')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Ticket ID</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.type} onChange={() => toggleColumn('type')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Type</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.site} onChange={() => toggleColumn('site')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Site</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.status} onChange={() => toggleColumn('status')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Status</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.priority} onChange={() => toggleColumn('priority')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Priority</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.date} onChange={() => toggleColumn('date')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Date</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={visibleColumns.assigned} onChange={() => toggleColumn('assigned')} size="small" />}
              label={<Typography sx={{ fontSize: '0.875rem' }}>Assigned</Typography>}
            />
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
}

export default CompactTickets;



import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Grid, Typography, Chip, Button, Stack, Tabs, Tab, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, DialogContentText, Select, MenuItem,
  InputLabel, FormControl, Checkbox, FormControlLabel
} from '@mui/material';
import { ArrowBack, Edit, AccessTime, CheckCircle, Warning, Delete, PanTool, Timer, Assignment } from '@mui/icons-material';
import { useToast } from './contexts/ToastContext';
import { useAuth } from './AuthContext';
import useApi from './hooks/useApi';
import useThemeTokens from './hooks/useThemeTokens';
import StatusChip from './components/StatusChip';
import PriorityChip from './components/PriorityChip';
import TypeChip from './components/TypeChip';
import useReadableChip from './hooks/useReadableChip';
import CompactShipmentForm from './CompactShipmentForm';
import { canDelete } from './utils/permissions';
import { sanitizeInput } from './utils/security';

/** Renders notes with preserved formatting (newlines, indents) and styled email blocks */
function NotesDisplay({ notes, codeBlockBg }) {
  if (!notes) return <Typography color="text.secondary">No notes</Typography>;
  const sanitized = sanitizeInput(notes);
  const chunks = sanitized.split(/\n\n---\s*From email\s*---\n*/i);
  return (
    <Stack spacing={2}>
      {chunks.map((chunk, i) => {
        const trimmed = chunk.trim();
        if (!trimmed) return null;
        const isEmailImport = i > 0 || /^(Subject|From|Date):/m.test(trimmed);
        return (
          <Box key={i}>
            {isEmailImport && (
              <Typography variant="caption" color="primary.main" fontWeight="600" sx={{ mb: 0.5, display: 'block' }}>
                Imported from email
              </Typography>
            )}
            <Box
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                margin: 0,
                p: isEmailImport ? 2 : 0,
                ...(isEmailImport && {
                  bgcolor: codeBlockBg,
                  borderRadius: 1,
                  borderLeft: '4px solid',
                  borderColor: 'primary.main'
                })
              }}
            >
              {trimmed}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

// Live Timer Component
function LiveTimer({ startTime }) {
  const [elapsed, setElapsed] = useState('');
  const { statusWarningBg } = useThemeTokens();

  useEffect(() => {
    const updateTimer = () => {
      if (!startTime) return;
      const start = new Date(startTime);
      const now = new Date();
      const diff = now - start;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsed(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: statusWarningBg, borderRadius: 1, border: '2px solid #ff9800' }}>
      <Timer sx={{ color: 'warning.main', fontSize: 28 }} />
      <Box>
        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', lineHeight: 1 }}>
          Tech Onsite
        </Typography>
        <Typography variant="h6" sx={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'warning.main', lineHeight: 1 }}>
          {elapsed}
        </Typography>
      </Box>
    </Box>
  );
}

function CompactTicketDetail() {
  const { ticket_id: ticketId } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { user } = useAuth();
  const { codeBlockBg } = useThemeTokens();
  const { getChipSx } = useReadableChip();
  const { success, error: showError } = useToast();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [tab, setTab] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [addShipmentOpen, setAddShipmentOpen] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const loadingRef = useRef(false);

  const load = async () => {
    if (loadingRef.current) return; // Prevent concurrent calls
    loadingRef.current = true;
    
    try {
      const [t, c, te, sh, inv, tk] = await Promise.all([
        api.get(`/tickets/${ticketId}`),
        api.get(`/tickets/${ticketId}/comments`),
        api.get(`/tickets/${ticketId}/time-entries/`),
        api.get(`/shipments?ticket_id=${ticketId}&limit=200&skip=0`),
        api.get('/inventory?limit=200&skip=0'),
        api.get(`/tasks?ticket_id=${ticketId}&limit=200`)
      ]);
      setTicket(t);
      setComments(c || []);
      setTimeEntries(te || []);
      setShipments(sh || []);
      setInventory(inv || []);
      setTasks(tk || []);
    } catch (err) {
      showError('Failed to load');
    } finally {
      loadingRef.current = false;
    }
  };

  // Only load when user and token are available so requests are authenticated
  useEffect(() => {
    const hasToken = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('access_token');
    if (user && ticketId && hasToken) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, user]);

  const handleQuickAction = async (action) => {
    try {
      if (action === 'check-in') await api.put(`/tickets/${ticketId}/check-in`, {});
      if (action === 'check-out') await api.put(`/tickets/${ticketId}/check-out`, {});
      if (action === 'complete') await api.patch(`/tickets/${ticketId}/status`, { status: 'completed' });
      success(`${action} success!`);
      window.location.reload();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Action failed';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleClaim = async () => {
    try {
      await api.put(`/tickets/${ticketId}/claim`, { claimed_by: user.user_id });
      success('Ticket claimed successfully!');
      window.location.reload();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to claim ticket';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/tickets/${ticketId}/comments`, { comment: newComment });
      setNewComment('');
      const c = await api.get(`/tickets/${ticketId}/comments`);
      setComments(c || []);
      success('Comment added');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to add comment';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tickets/${ticketId}`);
      success('Ticket deleted successfully');
      setDeleteDialogOpen(false);
      navigate('/tickets');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete ticket';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setDeleteDialogOpen(false);
    }
  };

  const handleShipmentSubmit = async (values) => {
    try {
      const siteId = ticket?.site?.site_id || ticket?.site_id;
      await api.post('/shipments/', {
        ...values,
        site_id: siteId,
        ticket_id: ticketId,
        source_ticket_type: ticket?.type
      });
      const sh = await api.get(`/shipments?ticket_id=${ticketId}&limit=200&skip=0`);
      setShipments(sh || []);
      setAddShipmentOpen(false);
      success('Shipment added');
    } catch (e) {
      showError('Failed to add shipment');
    }
  };

  const isAdmin = user?.role === 'admin';

  if (!ticket) return <Box sx={{ p: 2 }}><Typography>Loading...</Typography></Box>;

  const onsiteAlert = ticket.check_in_time && !ticket.check_out_time &&
    ((new Date() - new Date(ticket.check_in_time)) / (1000 * 60 * 60)) >= 2;

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate('/tickets')}>Back</Button>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{ticket.ticket_id}</Typography>
            <StatusChip status={ticket.status} entityType="ticket" size="small" sx={{ fontSize: '0.75rem' }} />
            <PriorityChip priority={ticket.priority} size="small" sx={{ fontSize: '0.75rem' }} />
            <TypeChip type={ticket.type} size="small" sx={{ fontSize: '0.75rem' }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            {!ticket.claimed_by && !['completed', 'closed', 'approved'].includes(ticket.status) && (
              <Button size="small" variant="contained" color="secondary" startIcon={<PanTool />} onClick={handleClaim}>Claim</Button>
            )}
            {ticket.type === 'onsite' && !ticket.check_in_time && (
              <Button size="small" variant="contained" color="success" onClick={() => handleQuickAction('check-in')}>Tech Arrived</Button>
            )}
            {ticket.type === 'onsite' && ticket.check_in_time && !ticket.check_out_time && (
              <Button size="small" variant="contained" color="info" onClick={() => handleQuickAction('check-out')}>Tech Done</Button>
            )}
            {!['completed', 'closed', 'approved'].includes(ticket.status) && (
              <Button size="small" variant="contained" color="primary" onClick={() => handleQuickAction('complete')}>Complete</Button>
            )}
            <Button size="small" variant="contained" startIcon={<Edit />} onClick={() => navigate(`/tickets/${ticketId}/edit`)}>Edit</Button>
            {canDelete(user) && (
              <Button size="small" variant="contained" color="error" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>Delete</Button>
            )}
          </Stack>
        </Stack>

        {onsiteAlert && (
          <Alert severity="error" icon={<Warning />} sx={{ mb: 2 }}>
            <strong>TECH ONSITE 2+ HOURS!</strong> Follow up immediately!
          </Alert>
        )}

        {/* Live Timer for Checked-In Techs */}
        {ticket.type === 'onsite' && ticket.check_in_time && !ticket.check_out_time && (
          <Box sx={{ mb: 2 }}>
            <LiveTimer startTime={ticket.check_in_time} />
          </Box>
        )}

        <Grid container spacing={1} sx={{ '& .MuiTypography-root': { fontSize: '0.85rem' } }}>
          <Grid item xs={6} md={3}><Typography><strong>Site:</strong> {ticket.site?.site_id} - {ticket.site?.location}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography><strong>INC:</strong> {ticket.inc_number || 'N/A'}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography><strong>SO:</strong> {ticket.so_number || 'N/A'}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography><strong>Assigned:</strong> {ticket.assigned_user?.name || 'Unassigned'}</Typography></Grid>
          {ticket.claimed_by && (
            <Grid item xs={6} md={3}><Typography><strong>Claimed By:</strong> {ticket.claimed_user?.name || ticket.claimed_by}</Typography></Grid>
          )}
          <Grid item xs={6} md={3}><Typography><strong>Field Tech:</strong> {ticket.onsite_tech?.name || 'N/A'}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography><strong>Created:</strong> {ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A'}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography><strong>Scheduled:</strong> {ticket.date_scheduled ? new Date(ticket.date_scheduled).toLocaleDateString() : 'N/A'}</Typography></Grid>
          {ticket.claimed_at && <Grid item xs={6} md={3}><Typography><strong>Claimed:</strong> {new Date(ticket.claimed_at).toLocaleString()}</Typography></Grid>}
          {ticket.check_in_time && <Grid item xs={6} md={3}><Typography><strong>Tech Arrived:</strong> {new Date(ticket.check_in_time).toLocaleString()}</Typography></Grid>}
          {ticket.check_out_time && <Grid item xs={6} md={3}><Typography><strong>Tech Done:</strong> {new Date(ticket.check_out_time).toLocaleString()}</Typography></Grid>}
          {(ticket.end_time || ticket.check_out_time) && <Grid item xs={6} md={3}><Typography><strong>Completed:</strong> {new Date(ticket.end_time || ticket.check_out_time).toLocaleString()}</Typography></Grid>}
          {ticket.approved_at && <Grid item xs={6} md={3}><Typography><strong>Approved:</strong> {new Date(ticket.approved_at).toLocaleString()}</Typography></Grid>}
          {(ticket.time_spent || ticket.onsite_duration_minutes) && (
            <Grid item xs={6} md={3}>
              <Typography>
                <strong>Time Spent:</strong> {
                  (() => {
                    const minutes = ticket.time_spent || ticket.onsite_duration_minutes || 0;
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                  })()
                }
              </Typography>
            </Grid>
          )}
          <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
          <Grid item xs={12}>
              <Typography sx={{ mb: 1 }}><strong>Notes:</strong></Typography>
              <NotesDisplay notes={ticket.notes} codeBlockBg={codeBlockBg} />
            </Grid>
          {ticket.parts_needed && <Grid item xs={12}><Typography><strong>Parts:</strong> {ticket.parts_needed}</Typography></Grid>}
          {ticket.equipment_affected && <Grid item xs={12}><Typography><strong>Equipment:</strong> {ticket.equipment_affected}</Typography></Grid>}
        </Grid>

        <Box sx={{ mt: 2 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab label={`Comments (${comments.length})`} sx={{ fontSize: '0.875rem', minHeight: 40 }} />
            <Tab label={`Time Entries (${timeEntries.length})`} sx={{ fontSize: '0.875rem', minHeight: 40 }} />
            <Tab label={`Tasks (${tasks.length})`} sx={{ fontSize: '0.875rem', minHeight: 40 }} />
            <Tab label={`Shipments (${shipments.length})`} sx={{ fontSize: '0.875rem', minHeight: 40 }} />
          </Tabs>

          {tab === 0 && (
            <Box sx={{ mt: 2 }}>
              <Stack spacing={1} mb={2}>
                {comments.map((c) => (
                  <Paper key={c.comment_id} sx={{ p: 1, bgcolor: codeBlockBg }}>
                    <Typography variant="caption" fontWeight="bold">{c.user?.name || 'Unknown'}</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{sanitizeInput(c.comment)}</Typography>
                    <Typography variant="caption" color="text.secondary">{new Date(c.created_at).toLocaleString()}</Typography>
                  </Paper>
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" placeholder="Add comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  sx={{ '& input': { fontSize: '0.875rem' } }} />
                <Button size="small" variant="contained" onClick={postComment}>Post</Button>
              </Stack>
            </Box>
          )}

          {tab === 1 && (
            <Table size="small" sx={{ mt: 2, '& td, & th': { py: 0.5, fontSize: '0.75rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Minutes</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>User</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {timeEntries.map((te) => (
                  <TableRow key={te.entry_id}>
                    <TableCell>{te.start_time ? new Date(te.start_time).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{te.end_time ? new Date(te.end_time).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{typeof te.duration_minutes === 'number' ? te.duration_minutes : (te.start_time && te.end_time ? Math.round((new Date(te.end_time)-new Date(te.start_time))/60000) : 0)}</TableCell>
                    <TableCell>{sanitizeInput(te.description) || ''}</TableCell>
                    <TableCell>{te.user?.name || 'N/A'}</TableCell>
                  </TableRow>
                ))}
                {timeEntries.length === 0 && <TableRow><TableCell colSpan={5} align="center">No entries</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}

          {tab === 2 && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" color="text.secondary">Tasks linked to this ticket</Typography>
                <Button size="small" variant="outlined" startIcon={<Assignment />} onClick={() => navigate(`/tasks/new?ticket_id=${ticketId}`)}>New Task</Button>
              </Stack>
              {tasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No tasks linked to this ticket.</Typography>
              ) : (
                <Table size="small" sx={{ '& td, & th': { py: 0.5, fontSize: '0.75rem' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Task ID</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Assigned</TableCell>
                      <TableCell>Due</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((tk) => (
                      <TableRow key={tk.task_id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${tk.task_id}/edit`)}>
                        <TableCell><Typography variant="caption" fontWeight="bold">{tk.task_id}</Typography></TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{tk.description?.slice(0, 60)}{(tk.description?.length || 0) > 60 ? '…' : ''}</Typography></TableCell>
                        <TableCell><StatusChip status={tk.status} entityType="ticket" size="small" /></TableCell>
                        <TableCell>{tk.assigned_user?.name || '—'}</TableCell>
                        <TableCell>{tk.due_date ? new Date(tk.due_date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell><Button size="small" onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${tk.task_id}/edit`); }}>Edit</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          )}

          {tab === 3 && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2">Shipments linked to ticket</Typography>
                <Button size="small" variant="contained" onClick={() => setAddShipmentOpen(true)}>Add Shipment</Button>
              </Stack>
              <Table size="small" sx={{ '& td, & th': { py: 0.5, fontSize: '0.75rem' } }}>
                  <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell>Item</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Tracking</TableCell>
                    <TableCell>Shipped</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shipments.map((s) => (
                    <TableRow key={s.shipment_id}>
                      <TableCell>{s.shipment_id}</TableCell>
                      <TableCell>{`${s.site?.site_id || s.site_id || ''}${s.site?.location ? ' - ' + s.site.location : ''}`}</TableCell>
                      <TableCell>{s.item?.name || s.item_id}</TableCell>
                        <TableCell>{s.quantity ?? 1}</TableCell>
                        <TableCell>{s.status}</TableCell>
                        <TableCell>
                          {s.tracking_number ? (
                            <a href={`https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(s.tracking_number)}`} target="_blank" rel="noreferrer">
                              {s.tracking_number}
                            </a>
                          ) : '-'}
                        </TableCell>
                      <TableCell>{s.date_shipped ? new Date(s.date_shipped).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {shipments.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center">No shipments yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Ticket</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete ticket <strong>{ticket.ticket_id}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Add Shipment Dialog */}
      <Dialog open={addShipmentOpen} onClose={() => setAddShipmentOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Shipment</DialogTitle>
        <DialogContent dividers>
          <CompactShipmentForm 
            onSubmit={handleShipmentSubmit} 
            initialValues={{ 
              site_id: ticket?.site?.site_id || ticket?.site_id,
              ticket_id: ticketId,
              source_ticket_type: ticket?.type 
            }} 
            isEdit={false}
            showHeader={false}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddShipmentOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default CompactTicketDetail;


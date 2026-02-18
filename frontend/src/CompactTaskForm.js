import React, { useState, useEffect } from 'react';
import { Paper, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem, Typography, Stack, Autocomplete } from '@mui/material';
import { Save, Cancel, Delete } from '@mui/icons-material';
import useApi from './hooks/useApi';
import { useAuth } from './AuthContext';
import { isAdmin } from './utils/permissions';
import { useToast } from './contexts/ToastContext';

function CompactTaskForm({ onSubmit, initialValues, isEdit, taskId, onDeleted }) {
  const api = useApi();
  const { user } = useAuth();
  const { error: showError, success } = useToast();
  const [values, setValues] = useState({
    ticket_id: '', assigned_user_id: '', description: '', status: 'open', due_date: '',
    ...initialValues
  });
  
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [u, t] = await Promise.all([
          api.get('/users/'),
          api.get('/tickets/?limit=100').catch(() => []),
        ]);
        setUsers(u || []);
        setTickets(Array.isArray(t) ? t : []);
      } catch {}
    };
    load();
  }, [api]);

  const c = (field, value) => setValues({ ...values, [field]: value });

  const handleDelete = async () => {
    if (!taskId || !window.confirm(`Delete task ${taskId}?`)) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      success('Task deleted');
      onDeleted?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete';
      showError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <Paper sx={{ p: 2, maxWidth: 800 }}>
      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{isEdit ? 'Edit' : 'New'} Task</Typography>
        <Stack direction="row" spacing={1}>
          {isEdit && isAdmin(user) && (
            <Button size="small" variant="outlined" color="error" startIcon={<Delete />} onClick={handleDelete}>Delete</Button>
          )}
          <Button size="small" variant="outlined" startIcon={<Cancel />} onClick={() => window.history.back()}>Cancel</Button>
          <Button size="small" variant="contained" startIcon={<Save />} onClick={() => onSubmit(values)} disabled={!values.description}>Save</Button>
        </Stack>
      </Stack>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Autocomplete
            size="small"
            options={tickets}
            getOptionLabel={(o) => o.ticket_id || ''}
            value={tickets.find(t => t.ticket_id === values.ticket_id) || null}
            onChange={(e, v) => c('ticket_id', v?.ticket_id || '')}
            isOptionEqualToValue={(opt, val) => opt?.ticket_id === val?.ticket_id}
            renderInput={(p) => (
              <TextField
                {...p}
                label="Ticket (optional)"
                placeholder="Link to ticket or leave blank"
                sx={{ '& input': { fontSize: '0.875rem' } }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Autocomplete size="small" options={users} getOptionLabel={(o) => o.name}
            value={users.find(u => u.user_id === values.assigned_user_id) || null}
            onChange={(e, v) => c('assigned_user_id', v?.user_id || '')}
            renderInput={(p) => <TextField {...p} label="Assigned To" sx={{ '& input': { fontSize: '0.875rem' } }} />}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '0.875rem' }}>Status</InputLabel>
            <Select value={values.status} onChange={(e) => c('status', e.target.value)} label="Status" sx={{ fontSize: '0.875rem' }}>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth size="small" label="Due Date" type="date" value={values.due_date}
            onChange={(e) => c('due_date', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: '0.875rem' } }} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth size="small" label="Description *" required multiline rows={3} value={values.description}
            onChange={(e) => c('description', e.target.value)} sx={{ '& textarea': { fontSize: '0.875rem' } }} />
        </Grid>
      </Grid>
    </Paper>
  );
}

export default CompactTaskForm;


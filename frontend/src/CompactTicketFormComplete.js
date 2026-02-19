import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Grid, TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Typography, Stack, Autocomplete, Tabs, Tab, Switch, FormControlLabel, Alert, Tooltip
} from '@mui/material';
import { Save, Cancel, Email } from '@mui/icons-material';
import useApi from './hooks/useApi';
import { parseEmailFile, emailToTicketFields } from './utils/emailParser';
import useThemeTokens from './hooks/useThemeTokens';

function CompactTicketFormComplete({ onSubmit, initialValues, isEdit }) {
  const api = useApi();
  const { optionalFieldBg, surfacePaper } = useThemeTokens();
  const [activeTab, setActiveTab] = useState(0);
  const [values, setValues] = useState({
    // Core fields
    site_id: '', inc_number: '', so_number: '', type: 'onsite', status: 'open', priority: 'normal',
    assigned_user_id: '', onsite_tech_id: '', date_created: '', date_scheduled: '',
    date_closed: '', time_spent: '', notes: '', special_flag: '',
    // Claim/Check fields
    claimed_by: '', claimed_at: '', check_in_time: '', check_out_time: '', onsite_duration_minutes: '',
    billing_rate: 0, total_cost: 0,
    // Workflow fields
    estimated_hours: '', actual_hours: '', start_time: '', end_time: '', is_billable: true,
    requires_approval: false, approved_by: '', approved_at: '', rejection_reason: '',
    workflow_step: 'created', workflow_state: 'new', next_action_required: '', due_date: '',
    nro_phase1_scheduled_date: '', nro_phase1_state: '',
    nro_phase2_scheduled_date: '', nro_phase2_state: '',
    // SLA fields
    sla_target_hours: '', sla_breach_hours: '', escalation_level: 0,
    // Equipment/Parts
    equipment_affected: '', parts_needed: '', parts_ordered: false, parts_received: false,
    // Quality
    quality_score: '', follow_up_required: false, follow_up_date: '', follow_up_notes: '',
    ...initialValues
  });
  
  const [sites, setSites] = useState([]);
  const [siteInput, setSiteInput] = useState('');
  const [siteLoading, setSiteLoading] = useState(false);
  const lastQueryRef = React.useRef('');
  const apiRef = React.useRef(api);
  const [siteOpen, setSiteOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [fieldTechs, setFieldTechs] = useState([]);
  const [emailDropOver, setEmailDropOver] = useState(false);
  const [emailParseError, setEmailParseError] = useState(null);

  // Keep API ref current
  React.useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const load = async () => {
    try {
      const [u, ft] = await Promise.all([apiRef.current.get('/users/'), apiRef.current.get('/fieldtechs/')]);
      setUsers(u || []); setFieldTechs(ft || []);
    } catch {}
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When editing with pre-filled site_id, fetch that site so Autocomplete can show label
  const fetchInitialSite = async () => {
    if (values.site_id && !sites.find(s => s.site_id === values.site_id)) {
      try {
        const s = await apiRef.current.get(`/sites/${values.site_id}`);
        if (s) setSites([s]);
      } catch {}
    }
  };

  useEffect(() => {
    fetchInitialSite();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.site_id]);

  // Debounced site search as user types
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = siteInput?.trim();
      if (!q || q.length < 1) return;
      
      // Don't search if the input looks like a selected site (contains " - ")
      if (q.includes(' - ')) return;
      
      setSiteLoading(true);
      lastQueryRef.current = q;
      // Ensure popup is visible while searching
      setSiteOpen(true);
      try {
        // If user typed a 4-digit numeric ID, fetch exact and prefer it, but don't early-return
        if (/^\d{4}$/.test(q)) {
          try {
            const exact = await apiRef.current.get(`/sites/${encodeURIComponent(q)}`);
            if (lastQueryRef.current === q && exact) {
              var exactResult = exact;
            }
          } catch {
            // fall through to prefix/broad search if exact not found
          }
        }
        const isNumeric = /^\d+$/.test(q);
        const limit = q.length >= 3 ? (isNumeric ? 500 : 200) : 50;
        // Prefer precise prefix lookup for site_id to surface exact matches
        const res = await apiRef.current.get(`/sites/lookup?prefix=${encodeURIComponent(q)}&limit=${limit}`);
        let options = Array.isArray(res) ? res : [];
        // If not enough, fall back to broader search
        if (options.length < Math.min(limit, 10)) {
          const broad = await apiRef.current.get(`/sites/?search=${encodeURIComponent(q)}&limit=${limit}`);
          if (Array.isArray(broad)) {
            const seen = new Set(options.map(o => o.site_id));
            options = options.concat(broad.filter(b => !seen.has(b.site_id)));
          }
        }
        // Merge exact to top and dedupe
        if (typeof exactResult === 'object' && exactResult?.site_id) {
          const seen = new Set();
          const merged = [exactResult, ...options].filter(o => {
            const id = o?.site_id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          options = merged;
        }
        if (lastQueryRef.current === q) {
          setSites(options);
        }
      } catch {}
      setSiteLoading(false);
    }, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteInput]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  const c = (field, value) => setValues({ ...values, [field]: value });

  const handleEmailDrop = async (e) => {
    e.preventDefault();
    setEmailDropOver(false);
    setEmailParseError(null);
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.eml') && !name.endsWith('.msg')) {
      setEmailParseError('Use .eml or .msg file. Save the email first, then drag it here.');
      return;
    }
    try {
      const parsed = await parseEmailFile(file);
      const fields = emailToTicketFields(parsed);
      setValues(prev => ({
        ...prev,
        notes: prev.notes ? `${prev.notes}\n\n--- From email ---\n${fields.notes}` : fields.notes,
        site_id: fields.site_id || prev.site_id,
        inc_number: fields.inc_number || prev.inc_number,
        so_number: fields.so_number || prev.so_number,
        date_scheduled: fields.date_scheduled || prev.date_scheduled
      }));
      if (fields.site_id) setSiteInput(`${fields.site_id} - `);
    } catch (err) {
      setEmailParseError(err?.message || 'Failed to parse email');
    }
  };

  return (
    <Paper sx={{ p: 2, maxHeight: '90vh', overflow: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
          {isEdit ? 'Edit Ticket' : 'New Ticket'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<Cancel />} onClick={() => window.history.back()}>Cancel</Button>
          <Button size="small" variant="contained" startIcon={<Save />} onClick={handleSubmit} disabled={!values.site_id}>Save</Button>
        </Stack>
      </Stack>

      {!isEdit && (
        <Tooltip title="Outlook doesn't expose emails when dragging directly. Save the email as .msg or .eml (File → Save As), then drag that file here.">
          <Box
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setEmailDropOver(true); }}
            onDragLeave={() => setEmailDropOver(false)}
            onDrop={handleEmailDrop}
            sx={{
              p: 2,
              mb: 2,
              border: '2px dashed',
              borderColor: emailDropOver ? 'primary.main' : 'divider',
              borderRadius: 1,
              bgcolor: emailDropOver ? 'action.hover' : 'action.selected',
              cursor: 'default',
              textAlign: 'center'
            }}
          >
            <Email sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drag .msg or .eml file here to load email (Subject, From, body → Notes; INC/SO numbers auto-detected)
            </Typography>
            {emailParseError && (
              <Alert severity="error" sx={{ mt: 1 }} onClose={() => setEmailParseError(null)}>
                {emailParseError}
              </Alert>
            )}
          </Box>
        </Tooltip>
      )}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Basic" sx={{ minWidth: 80, fontSize: '0.875rem' }} />
        <Tab label="Assignment" sx={{ minWidth: 80, fontSize: '0.875rem' }} />
        <Tab label="Parts/Billing" sx={{ minWidth: 80, fontSize: '0.875rem' }} />
        <Tab label="Quality" sx={{ minWidth: 80, fontSize: '0.875rem' }} />
      </Tabs>

      <form onSubmit={handleSubmit}>
        {/* TAB 0: BASIC INFO */}
        {activeTab === 0 && (
          <Grid container spacing={1.5}>
            <Grid item xs={6} md={4}>
              <Autocomplete
                size="small"
                freeSolo
                inputValue={siteInput}
                open={siteOpen}
                onOpen={() => {
                  // Show popup if there’s something to filter or we already have options
                  setSiteOpen(Boolean(siteInput?.trim()) || sites.length > 0);
                }}
                onClose={() => setSiteOpen(false)}
                selectOnFocus
                clearOnBlur={false}
                options={sites}
                getOptionLabel={(o) => (o && typeof o === 'object') ? `${o.site_id} - ${o.location || ''}` : String(o || '')}
                isOptionEqualToValue={(o, v) => (o?.site_id || o) === (v?.site_id || v)}
                value={sites.find(s => s.site_id === values.site_id) || values.site_id || null}
                onChange={(e, v) => {
                  if (v && typeof v === 'object') {
                    c('site_id', v.site_id || '');
                    setSiteInput(`${v.site_id} - ${v.location || ''}`);
                    setSiteOpen(false);
                  } else if (typeof v === 'string' && /^\d{4}$/.test(v) && !sites.find(s => s.site_id === v)) {
                    // Only fetch if it's a 4-digit string AND not already in our sites array
                    c('site_id', v);
                    // Fetch the site to populate label/options seamlessly
                    apiRef.current.get(`/sites/${encodeURIComponent(v)}`).then((s) => {
                      if (s) {
                        setSites((prev) => (prev.find(p => p.site_id === s.site_id) ? prev : [s, ...prev]));
                        setSiteInput(`${s.site_id} - ${s.location || ''}`);
                        setSiteOpen(false);
                      }
                    }).catch(() => {});
                  } else if (v == null) {
                    c('site_id', '');
                  }
                }}
                onInputChange={(e, input) => {
                  setSiteInput(input);
                  setSiteOpen(Boolean(input?.trim()));
                }}
                includeInputInList
                autoHighlight
                filterOptions={(options, state) => {
                  const q = (state.inputValue || '').toLowerCase().trim();
                  if (!q) return options;
                  const isDigits = /^\d+$/.test(q);
                  const starts = [];
                  const rest = [];
                  for (const o of options) {
                    const id = String(o?.site_id || '').toLowerCase();
                    const loc = String(o?.location || '').toLowerCase();
                    const hay = isDigits ? id : `${id} ${loc}`;
                    if (!hay.includes(q)) continue;
                    (id.startsWith(q) ? starts : rest).push(o);
                  }
                  return [...starts, ...rest].slice(0, 200);
                }}
                loading={siteLoading}
                loadingText="Searching sites..."
                noOptionsText={(siteInput && siteInput.length >= 1) ? 'No matches' : 'Type to search sites'}
                renderInput={(p) => (
                  <TextField {...p} label="Site *" required placeholder="Type site ID or location"
                    sx={{ '& input': { fontSize: '0.875rem' } }} />
                )}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small" required>
                <InputLabel sx={{ fontSize: '0.875rem' }}>Type</InputLabel>
                <Select value={values.type} onChange={(e) => c('type', e.target.value)} label="Type" sx={{ fontSize: '0.875rem' }}>
                  <MenuItem value="inhouse">Inhouse</MenuItem>
                  <MenuItem value="onsite">Onsite</MenuItem>
                  <MenuItem value="nro">NRO</MenuItem>
                  <MenuItem value="projects">Projects</MenuItem>
                  <MenuItem value="misc">Misc</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: '0.875rem' }}>Status</InputLabel>
                <Select value={values.status} onChange={(e) => c('status', e.target.value)} label="Status" sx={{ fontSize: '0.875rem' }}>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: '0.875rem' }}>Workflow</InputLabel>
                <Select value={values.workflow_state || 'new'} onChange={(e) => c('workflow_state', e.target.value)} label="Workflow" sx={{ fontSize: '0.875rem' }}>
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="claimed">Claimed</MenuItem>
                  <MenuItem value="onsite">Onsite</MenuItem>
                  <MenuItem value="offsite">Offsite</MenuItem>
                  <MenuItem value="followup_required">Follow-up Required</MenuItem>
                  <MenuItem value="needstech">Needs Tech</MenuItem>
                  <MenuItem value="goback_required">Go-back Required</MenuItem>
                  <MenuItem value="pending_dispatch_review">Pending Dispatch Review</MenuItem>
                  <MenuItem value="pending_approval">Pending Approval</MenuItem>
                  <MenuItem value="ready_to_archive">Ready to Archive</MenuItem>
                  <MenuItem value="nro_phase1_scheduled">NRO Phase 1 Scheduled</MenuItem>
                  <MenuItem value="nro_phase1_complete_pending_phase2">NRO P1 Complete</MenuItem>
                  <MenuItem value="nro_phase1_goback_required">NRO P1 Go-back</MenuItem>
                  <MenuItem value="nro_phase2_scheduled">NRO Phase 2 Scheduled</MenuItem>
                  <MenuItem value="nro_phase2_goback_required">NRO P2 Go-back</MenuItem>
                  <MenuItem value="nro_ready_for_completion">NRO Ready For Completion</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: '0.875rem' }}>Priority</InputLabel>
                <Select value={values.priority} onChange={(e) => c('priority', e.target.value)} label="Priority" sx={{ fontSize: '0.875rem' }}>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="emergency">Emergency</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="INC Number" value={values.inc_number} onChange={(e) => c('inc_number', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="SO Number" value={values.so_number} onChange={(e) => c('so_number', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            
            {values.type === 'onsite' && (
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Scheduled Date ⭐" type="date" value={values.date_scheduled}
                  onChange={(e) => c('date_scheduled', e.target.value)} InputLabelProps={{ shrink: true }}
                  sx={{ '& input': { fontSize: '0.875rem' }, bgcolor: !values.date_scheduled ? optionalFieldBg : surfacePaper }} />
                {!values.date_scheduled && <Alert severity="warning" sx={{ mt: 0.5, py: 0 }}><Typography variant="caption">Set scheduled date for onsite!</Typography></Alert>}
              </Grid>
            )}
            {values.type === 'nro' && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="NRO Phase 1 Date"
                    type="date"
                    value={values.nro_phase1_scheduled_date || ''}
                    onChange={(e) => c('nro_phase1_scheduled_date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& input': { fontSize: '0.875rem' } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.875rem' }}>NRO P1 State</InputLabel>
                    <Select value={values.nro_phase1_state || ''} onChange={(e) => c('nro_phase1_state', e.target.value)} label="NRO P1 State" sx={{ fontSize: '0.875rem' }}>
                      <MenuItem value="">Not Set</MenuItem>
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="goback_required">Go-back Required</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="NRO Phase 2 Date"
                    type="date"
                    value={values.nro_phase2_scheduled_date || ''}
                    onChange={(e) => c('nro_phase2_scheduled_date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& input': { fontSize: '0.875rem' } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: '0.875rem' }}>NRO P2 State</InputLabel>
                    <Select value={values.nro_phase2_state || ''} onChange={(e) => c('nro_phase2_state', e.target.value)} label="NRO P2 State" sx={{ fontSize: '0.875rem' }}>
                      <MenuItem value="">Not Set</MenuItem>
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="goback_required">Go-back Required</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Notes" multiline rows={3} value={values.notes}
                onChange={(e) => c('notes', e.target.value)} sx={{ '& textarea': { fontSize: '0.875rem' } }} />
            </Grid>
          </Grid>
        )}

        {/* TAB 1: ASSIGNMENT */}
        {activeTab === 1 && (
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <Autocomplete size="small" options={users} getOptionLabel={(o) => `${o.name} (${o.role})`}
                value={users.find(u => u.user_id === values.assigned_user_id) || null}
                onChange={(e, v) => c('assigned_user_id', v?.user_id || '')}
                renderInput={(p) => <TextField {...p} label="Assigned Internal User" sx={{ '& input': { fontSize: '0.875rem' } }} />}
              />
            </Grid>
            {(values.type === 'onsite' || values.type === 'nro') && (
              <Grid item xs={12} md={6}>
                <Autocomplete size="small" options={fieldTechs} getOptionLabel={(o) => `${o.name} - ${o.region}`}
                  value={fieldTechs.find(ft => ft.field_tech_id === values.onsite_tech_id) || null}
                  onChange={(e, v) => c('onsite_tech_id', v?.field_tech_id || '')}
                  renderInput={(p) => <TextField {...p} label="Field Tech" sx={{ '& input': { fontSize: '0.875rem' } }} />}
                />
              </Grid>
            )}
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Estimated Hours" type="number" value={values.estimated_hours}
                onChange={(e) => c('estimated_hours', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Actual Hours" type="number" value={values.actual_hours}
                onChange={(e) => c('actual_hours', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Time Spent (min)" type="number" value={values.time_spent}
                onChange={(e) => c('time_spent', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Due Date" type="datetime-local" value={values.due_date}
                onChange={(e) => c('due_date', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Next Action Required" value={values.next_action_required}
                onChange={(e) => c('next_action_required', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControlLabel control={<Switch size="small" checked={values.is_billable} onChange={(e) => c('is_billable', e.target.checked)} />}
                label={<Typography sx={{ fontSize: '0.875rem' }}>Billable</Typography>} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControlLabel control={<Switch size="small" checked={values.requires_approval} onChange={(e) => c('requires_approval', e.target.checked)} />}
                label={<Typography sx={{ fontSize: '0.875rem' }}>Requires Approval</Typography>} />
            </Grid>
            {/* SLA Fields */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1, mt: 1 }}>SLA Management</Typography>
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" label="SLA Target Hours" type="number" value={values.sla_target_hours}
                onChange={(e) => c('sla_target_hours', e.target.value)} 
                inputProps={{ min: 0 }} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" label="SLA Breach Hours" type="number" value={values.sla_breach_hours}
                onChange={(e) => c('sla_breach_hours', e.target.value)} 
                inputProps={{ min: 0 }} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth size="small" label="Escalation Level" type="number" value={values.escalation_level}
                onChange={(e) => c('escalation_level', e.target.value)} 
                inputProps={{ min: 0 }} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
          </Grid>
        )}

        {/* TAB 2: PARTS/BILLING */}
        {activeTab === 2 && (
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Equipment Affected" value={values.equipment_affected}
                onChange={(e) => c('equipment_affected', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Parts Needed" value={values.parts_needed}
                onChange={(e) => c('parts_needed', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControlLabel control={<Switch size="small" checked={values.parts_ordered} onChange={(e) => c('parts_ordered', e.target.checked)} />}
                label={<Typography sx={{ fontSize: '0.875rem' }}>Parts Ordered</Typography>} />
            </Grid>
            <Grid item xs={6} md={3}>
              <FormControlLabel control={<Switch size="small" checked={values.parts_received} onChange={(e) => c('parts_received', e.target.checked)} />}
                label={<Typography sx={{ fontSize: '0.875rem' }}>Parts Received</Typography>} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Billing Rate ($/hr)" type="number" value={values.billing_rate}
                onChange={(e) => c('billing_rate', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField fullWidth size="small" label="Total Cost ($)" type="number" value={values.total_cost}
                onChange={(e) => c('total_cost', e.target.value)} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
          </Grid>
        )}

        {/* TAB 3: QUALITY */}
        {activeTab === 3 && (
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth size="small" label="Quality Score" type="number" value={values.quality_score}
                onChange={(e) => c('quality_score', e.target.value)} inputProps={{ min: 1, max: 10 }} sx={{ '& input': { fontSize: '0.875rem' } }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel control={<Switch size="small" checked={values.follow_up_required} onChange={(e) => c('follow_up_required', e.target.checked)} />}
                label={<Typography sx={{ fontSize: '0.875rem' }}>Follow-up Required</Typography>} />
            </Grid>
            {values.follow_up_required && (
              <>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth size="small" label="Follow-up Date" type="date" value={values.follow_up_date}
                    onChange={(e) => c('follow_up_date', e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& input': { fontSize: '0.875rem' } }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Follow-up Notes" multiline rows={2} value={values.follow_up_notes}
                    onChange={(e) => c('follow_up_notes', e.target.value)} sx={{ '& textarea': { fontSize: '0.875rem' } }} />
                </Grid>
              </>
            )}
          </Grid>
        )}
      </form>
    </Paper>
  );
}

export default CompactTicketFormComplete;

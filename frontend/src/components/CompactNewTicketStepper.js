import React, { useState, useEffect, useRef } from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Typography,
  Paper,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';

const steps = ['Basic Info', 'Type & Schedule', 'Assignment', 'Notes & Review'];

const defaultValues = {
  site_id: '',
  inc_number: '',
  so_number: '',
  type: 'onsite',
  status: 'open',
  priority: 'normal',
  date_scheduled: '',
  nro_phase1_scheduled_date: '',
  nro_phase2_scheduled_date: '',
  assigned_user_id: '',
  onsite_tech_id: '',
  notes: '',
};

function Step1BasicInfo({ values, setValues, sites, setSiteInput, siteInput, siteLoading, onSiteSearch }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Autocomplete
          size="small"
          freeSolo
          inputValue={siteInput}
          onInputChange={(e, v) => setSiteInput(v)}
          options={sites}
          getOptionLabel={(o) => (o && typeof o === 'object' ? `${o.site_id} - ${o.location || ''}` : String(o || ''))}
          value={sites.find((s) => s.site_id === values.site_id) || null}
          onChange={(e, v) => {
            if (v && typeof v === 'object') setValues((prev) => ({ ...prev, site_id: v.site_id || '' }));
            else if (v == null) setValues((prev) => ({ ...prev, site_id: '' }));
          }}
          renderInput={(params) => (
            <TextField {...params} label="Site *" required placeholder="Type site ID or location" />
          )}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Type</InputLabel>
          <Select
            value={values.type}
            onChange={(e) => setValues((prev) => ({ ...prev, type: e.target.value }))}
            label="Type"
          >
            <MenuItem value="inhouse">Inhouse</MenuItem>
            <MenuItem value="onsite">Onsite</MenuItem>
            <MenuItem value="nro">NRO</MenuItem>
            <MenuItem value="projects">Projects</MenuItem>
            <MenuItem value="misc">Misc</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Priority</InputLabel>
          <Select
            value={values.priority}
            onChange={(e) => setValues((prev) => ({ ...prev, priority: e.target.value }))}
            label="Priority"
          >
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
            <MenuItem value="emergency">Emergency</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          size="small"
          label="INC Number"
          value={values.inc_number}
          onChange={(e) => setValues((prev) => ({ ...prev, inc_number: e.target.value }))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          fullWidth
          size="small"
          label="SO Number"
          value={values.so_number}
          onChange={(e) => setValues((prev) => ({ ...prev, so_number: e.target.value }))}
        />
      </Grid>
    </Grid>
  );
}

function Step2TypeSchedule({ values, setValues }) {
  return (
    <Grid container spacing={2}>
      {values.type === 'onsite' && (
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            label="Scheduled Date"
            type="date"
            value={values.date_scheduled || ''}
            onChange={(e) => setValues((prev) => ({ ...prev, date_scheduled: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      )}
      {values.type === 'nro' && (
        <>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="NRO Phase 1 Date"
              type="date"
              value={values.nro_phase1_scheduled_date || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, nro_phase1_scheduled_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="NRO Phase 2 Date"
              type="date"
              value={values.nro_phase2_scheduled_date || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, nro_phase2_scheduled_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </>
      )}
      {(values.type === 'inhouse' || values.type === 'projects' || values.type === 'misc') && (
        <Grid item xs={12}>
          <Typography color="text.secondary">No extra dates for this type. Continue to Assignment.</Typography>
        </Grid>
      )}
    </Grid>
  );
}

function Step3Assignment({ values, setValues, users, fieldTechs }) {
  const showFieldTech = values.type === 'onsite' || values.type === 'nro';
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Autocomplete
          size="small"
          options={users}
          getOptionLabel={(o) => `${o.name} (${o.role})`}
          value={users.find((u) => u.user_id === values.assigned_user_id) || null}
          onChange={(e, v) => setValues((prev) => ({ ...prev, assigned_user_id: v?.user_id || '' }))}
          renderInput={(params) => <TextField {...params} label="Assigned User" />}
        />
      </Grid>
      {showFieldTech && (
        <Grid item xs={12} md={6}>
          <Autocomplete
            size="small"
            options={fieldTechs}
            getOptionLabel={(o) => `${o.name} - ${o.region}`}
            value={fieldTechs.find((ft) => ft.field_tech_id === values.onsite_tech_id) || null}
            onChange={(e, v) => setValues((prev) => ({ ...prev, onsite_tech_id: v?.field_tech_id || '' }))}
            renderInput={(params) => <TextField {...params} label="Field Tech" />}
          />
        </Grid>
      )}
    </Grid>
  );
}

function Step4NotesReview({ values, setValues }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          size="small"
          label="Notes"
          multiline
          rows={4}
          value={values.notes || ''}
          onChange={(e) => setValues((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </Grid>
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" gutterBottom>Summary</Typography>
          <Typography variant="body2">Site: {values.site_id} · Type: {values.type} · Priority: {values.priority}</Typography>
          {values.date_scheduled && <Typography variant="body2">Scheduled: {values.date_scheduled}</Typography>}
          {values.notes && <Typography variant="body2" sx={{ mt: 1 }}>Notes: {values.notes.slice(0, 100)}{values.notes.length > 100 ? '…' : ''}</Typography>}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default function CompactNewTicketStepper({ onSubmit }) {
  const navigate = useNavigate();
  const api = useApi();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState(defaultValues);
  const [sites, setSites] = useState([]);
  const [siteInput, setSiteInput] = useState('');
  const [siteLoading, setSiteLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [fieldTechs, setFieldTechs] = useState([]);
  const lastQueryRef = useRef('');

  useEffect(() => {
    const load = async () => {
      try {
        const [u, ft] = await Promise.all([api.get('/users/'), api.get('/fieldtechs/')]);
        setUsers(u || []);
        setFieldTechs(ft || []);
      } catch {}
    };
    load();
  }, [api]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = (siteInput || '').trim();
      if (!q || q.length < 1 || q.includes(' - ')) return;
      setSiteLoading(true);
      lastQueryRef.current = q;
      try {
        if (/^\d{4}$/.test(q)) {
          try {
            const exact = await api.get(`/sites/${encodeURIComponent(q)}`);
            if (lastQueryRef.current === q && exact) setSites([exact]);
          } catch {}
        }
        const res = await api.get(`/sites/lookup?prefix=${encodeURIComponent(q)}&limit=50`);
        const list = Array.isArray(res) ? res : [];
        if (lastQueryRef.current === q) setSites(list);
      } catch {}
      setSiteLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [siteInput]);

  const canNext = () => {
    if (activeStep === 0) return !!values.site_id;
    return true;
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      setLoading(true);
      onSubmit(values)
        .then(() => navigate('/tickets'))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => Math.max(0, prev - 1));

  return (
    <Paper elevation={0} sx={{ p: 4, maxWidth: 920, mx: 'auto', mt: 2, borderRadius: 3 }}>
      <Typography variant="h5" gutterBottom align="center" fontWeight={600}>
        Create New Ticket
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, mt: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ minHeight: 320 }}>
        {activeStep === 0 && (
          <Step1BasicInfo
            values={values}
            setValues={setValues}
            sites={sites}
            siteInput={siteInput}
            setSiteInput={setSiteInput}
            siteLoading={siteLoading}
          />
        )}
        {activeStep === 1 && <Step2TypeSchedule values={values} setValues={setValues} />}
        {activeStep === 2 && (
          <Step3Assignment values={values} setValues={setValues} users={users} fieldTechs={fieldTechs} />
        )}
        {activeStep === 3 && <Step4NotesReview values={values} setValues={setValues} />}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button disabled={activeStep === 0} onClick={handleBack} variant="outlined" size="large">
          Back
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={handleNext}
          disabled={loading || (activeStep === 0 && !canNext())}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {activeStep === steps.length - 1 ? 'Create Ticket' : 'Continue'}
        </Button>
      </Box>
    </Paper>
  );
}

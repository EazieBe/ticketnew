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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useApi from '../hooks/useApi';
import { Step1BasicInfo, Step2TypeSchedule, Step3Assignment, Step4NotesReview } from './CompactNewTicketStepper/steps';

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

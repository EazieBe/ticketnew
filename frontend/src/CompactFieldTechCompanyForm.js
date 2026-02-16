import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, TextField, Paper, Stack, Typography,
  FormControl, InputLabel, Select, MenuItem, Divider
} from '@mui/material';
import useApi from './hooks/useApi';
import { useToast } from './contexts/ToastContext';

function CompactFieldTechCompanyForm({ initialValues, onSubmit, isEdit }) {
  const api = useApi();
  const { error: showError } = useToast();
  const [states, setStates] = useState([]);
  const [values, setValues] = useState({
    company_name: '',
    company_number: '',
    business_phone: '',
    other_phones: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    region: '',
    notes: '',
    service_radius_miles: '',
  });

  useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await api.get('/fieldtech-companies/states');
        setStates(response || []);
      } catch {
        showError('Failed to load states');
      }
    };
    fetchStates();
  }, [api, showError]);

  const stateValue = useMemo(() => {
    if (values.state && states.some((s) => s.value === values.state)) {
      return values.state;
    }
    return '';
  }, [values.state, states]);

  const set = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const lookupZip = async () => {
    if (!values.zip) return;
    try {
      const result = await api.get(`/fieldtech-companies/zip/${values.zip}`);
      if (result?.city && !values.city) set('city', result.city);
      if (result?.state && !values.state) set('state', result.state);
    } catch {
      showError('ZIP lookup failed');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...values,
      service_radius_miles: values.service_radius_miles ? Number(values.service_radius_miles) : null,
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {isEdit ? 'Edit Company' : 'New Company'}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Company name"
              value={values.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              required
              size="small"
            />
            <TextField
              label="Company number"
              value={values.company_number || ''}
              onChange={(e) => set('company_number', e.target.value)}
              size="small"
            />
            <Divider />
            <TextField
              label="Business phone"
              value={values.business_phone || ''}
              onChange={(e) => set('business_phone', e.target.value)}
              size="small"
            />
            <TextField
              label="Other phone numbers"
              value={values.other_phones || ''}
              onChange={(e) => set('other_phones', e.target.value)}
              size="small"
              multiline
              minRows={2}
            />
            <Divider />
            <TextField
              label="Address"
              value={values.address || ''}
              onChange={(e) => set('address', e.target.value)}
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="City"
                value={values.city || ''}
                onChange={(e) => set('city', e.target.value)}
                size="small"
                fullWidth
              />
              <FormControl fullWidth size="small">
                <InputLabel>State</InputLabel>
                <Select
                  value={stateValue}
                  label="State"
                  onChange={(e) => set('state', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">—</MenuItem>
                  {states.map((s) => (
                    <MenuItem key={s.value} value={s.value}>
                      {s.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="ZIP"
                value={values.zip || ''}
                onChange={(e) => set('zip', e.target.value)}
                onBlur={lookupZip}
                size="small"
                fullWidth
              />
            </Stack>
            <TextField
              label="Region"
              value={values.region || ''}
              onChange={(e) => set('region', e.target.value)}
              size="small"
            />
            <TextField
              label="Service radius (miles)"
              value={values.service_radius_miles || ''}
              onChange={(e) => set('service_radius_miles', e.target.value)}
              size="small"
              type="number"
            />
            <TextField
              label="Notes"
              value={values.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              size="small"
              multiline
              minRows={3}
            />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button type="submit" variant="contained">
                Save
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}

export default CompactFieldTechCompanyForm;

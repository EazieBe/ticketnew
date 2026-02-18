import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, TextField, Paper, Stack, Typography,
  FormControl, InputLabel, Select, MenuItem, Divider,
  IconButton, Collapse, Card, CardContent
} from '@mui/material';
import { Add, Delete, ExpandMore, ExpandLess, Person } from '@mui/icons-material';
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

  const [techsOpen, setTechsOpen] = useState(false);
  const updateTech = (index, field, value) => {
    setValues((prev) => {
      const techs = [...(prev.techs || [])];
      techs[index] = { ...(techs[index] || {}), [field]: value };
      return { ...prev, techs };
    });
  };
  const addTech = () => {
    setValues((prev) => ({
      ...prev,
      techs: [...(prev.techs || []), { name: '', tech_number: '', phone: '', email: '', service_radius_miles: '' }],
    }));
  };
  const removeTech = (index) => {
    setValues((prev) => ({
      ...prev,
      techs: (prev.techs || []).filter((_, i) => i !== index),
    }));
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
              value={values.service_radius_miles ?? ''}
              onChange={(e) => set('service_radius_miles', e.target.value)}
              size="small"
              type="number"
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Notes"
              value={values.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              size="small"
              multiline
              minRows={3}
            />
            <>
                <Divider />
                <Box>
                  <Button
                    fullWidth
                    onClick={() => setTechsOpen(!techsOpen)}
                    startIcon={techsOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Field techs ({values.techs?.length || 0})
                  </Button>
                  <Collapse in={techsOpen}>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      {(values.techs || []).map((t, i) => (
                        <Card key={t.field_tech_id || i} variant="outlined" size="small">
                          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                              <Typography variant="caption" color="text.secondary"><Person fontSize="inherit" /> Tech {i + 1}</Typography>
                              <IconButton size="small" onClick={() => removeTech(i)}><Delete fontSize="small" /></IconButton>
                            </Stack>
                            <Stack spacing={1}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <TextField label="Name" size="small" value={t.name || ''} onChange={(e) => updateTech(i, 'name', e.target.value)} fullWidth required />
                                <TextField label="Tech #" size="small" value={t.tech_number || ''} onChange={(e) => updateTech(i, 'tech_number', e.target.value)} fullWidth placeholder="Optional" />
                              </Stack>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <TextField label="Phone" size="small" value={t.phone || ''} onChange={(e) => updateTech(i, 'phone', e.target.value)} fullWidth />
                                <TextField label="Email" size="small" type="email" value={t.email || ''} onChange={(e) => updateTech(i, 'email', e.target.value)} fullWidth />
                              </Stack>
                              <TextField label="Service radius (mi)" size="small" type="number" value={t.service_radius_miles ?? ''} onChange={(e) => updateTech(i, 'service_radius_miles', e.target.value)} inputProps={{ min: 0 }} fullWidth />
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                      <Button startIcon={<Add />} onClick={addTech} variant="outlined" size="small">
                        Add tech
                      </Button>
                    </Stack>
                  </Collapse>
                </Box>
            </>
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

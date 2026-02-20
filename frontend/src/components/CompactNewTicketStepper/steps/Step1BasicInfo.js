import React from 'react';
import { Grid, TextField, FormControl, InputLabel, Select, MenuItem, Autocomplete } from '@mui/material';

export default function Step1BasicInfo({ values, setValues, sites, setSiteInput, siteInput, siteLoading }) {
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

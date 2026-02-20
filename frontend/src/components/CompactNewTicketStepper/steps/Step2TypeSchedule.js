import React from 'react';
import { Grid, TextField, Typography } from '@mui/material';

export default function Step2TypeSchedule({ values, setValues }) {
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

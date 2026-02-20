import React from 'react';
import { Grid, TextField, Typography, Paper } from '@mui/material';

export default function Step4NotesReview({ values, setValues }) {
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

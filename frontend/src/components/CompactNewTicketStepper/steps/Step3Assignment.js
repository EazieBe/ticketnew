import React from 'react';
import { Grid, TextField, Autocomplete } from '@mui/material';

export default function Step3Assignment({ values, setValues, users, fieldTechs }) {
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

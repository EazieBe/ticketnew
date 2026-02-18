import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Stack, TextField, InputAdornment, Typography
} from '@mui/material';
import { Add, Edit, Search, Refresh, UploadFile } from '@mui/icons-material';
import { useToast } from './contexts/ToastContext';
import useApi from './hooks/useApi';

function CompactFieldTechCompanies() {
  const navigate = useNavigate();
  const api = useApi();
  const apiRef = useRef(api);
  const { success, error: showError } = useToast();
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await apiRef.current.get('/fieldtech-companies/?include_techs=true');
      setCompanies(response || []);
    } catch {
      showError('Failed to load companies');
    }
  }, [showError]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((c) =>
      [c.company_name, c.company_number, c.city, c.state, c.zip, c.region]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term))
    );
  }, [companies, search]);

  const handleImport = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setIsImporting(true);
    try {
      const res = await apiRef.current.post('/fieldtech-companies/import', form);
      const summary = [
        `Companies created: ${res.created_companies}`,
        `Companies updated: ${res.updated_companies}`,
        `Techs created: ${res.created_techs}`,
        `Rows skipped: ${res.skipped_rows}`,
      ].join(' | ');
      success(summary);
      await fetchCompanies();
    } catch {
      showError('Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Field Tech Companies</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/companies/new')}>
          New
        </Button>
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFile />}
          disabled={isImporting}
        >
          Import CSV
          <input
            hidden
            type="file"
            accept=".csv"
            onChange={(e) => handleImport(e.target.files?.[0])}
          />
        </Button>
        <IconButton onClick={fetchCompanies} aria-label="refresh">
          <Refresh />
        </IconButton>
        <TextField
          size="small"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ml: 'auto', width: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Stack>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Company</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Phones</TableCell>
                <TableCell>Techs</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCompanies.map((c) => (
                <TableRow key={c.company_id} hover>
                  <TableCell>
                    <Link
                      to={`/companies/${c.company_id}/edit`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Typography variant="subtitle2" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                        {c.company_name}
                      </Typography>
                    </Link>
                    <Typography variant="caption" color="text.secondary">
                      {c.company_number || ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {[c.city, c.state, c.zip].filter(Boolean).join(', ')}
                  </TableCell>
                  <TableCell>
                    {[c.business_phone, c.other_phones].filter(Boolean).join(' | ')}
                  </TableCell>
                  <TableCell>{c.techs ? c.techs.length : 0}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => navigate(`/companies/${c.company_id}/edit`)}>
                      <Edit />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No companies found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default CompactFieldTechCompanies;

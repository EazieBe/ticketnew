import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Chip, IconButton,
  TextField, Button, Alert, CircularProgress, Grid,
  Tooltip, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  LocationOn, Person, FilterList, Business, ZoomIn, ZoomOut, MyLocation, Refresh, Directions, Edit
} from '@mui/icons-material';
import useApi from './hooks/useApi';
import useThemeTokens from './hooks/useThemeTokens';
import useReadableChip from './hooks/useReadableChip';
import { useDataSync } from './contexts/DataSyncContext';
import { getApiPath } from './apiPaths';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './FieldTechMap.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// One pin per company address
const companyIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #1976d2; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11]
});
const RING_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#00838f', '#c62828'];

// Map controls component (theme-aware)
function MapControls({ onZoomIn, onZoomOut, onCenterMap }) {
  const { surfacePaper, rowHoverBg } = useThemeTokens();
  const controlSx = { bgcolor: surfacePaper, boxShadow: 2, '&:hover': { bgcolor: rowHoverBg } };
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <IconButton onClick={onZoomIn} sx={controlSx}><ZoomIn /></IconButton>
      <IconButton onClick={onZoomOut} sx={controlSx}><ZoomOut /></IconButton>
      <IconButton onClick={onCenterMap} sx={controlSx}><MyLocation /></IconButton>
    </Box>
  );
}

// Map bounds updater: refit when filtered set changes, but never while a company is selected
function MapBoundsUpdater({ companiesWithCoords, mapCenter, mapZoom, selectedCompanyId }) {
  const map = useMap();
  const lastFittedKeyRef = useRef('');
  useEffect(() => {
    if (selectedCompanyId) return;
    if (companiesWithCoords.length === 0) {
      map.setView([mapCenter.lat, mapCenter.lng], mapZoom);
      lastFittedKeyRef.current = '';
      return;
    }
    const companiesKey = companiesWithCoords
      .map((c) => `${c.company_id}:${c.lat}:${c.lng}`)
      .join('|');
    if (companiesKey !== lastFittedKeyRef.current) {
      const bounds = L.latLngBounds(companiesWithCoords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
      lastFittedKeyRef.current = companiesKey;
    }
  }, [map, selectedCompanyId, companiesWithCoords, mapCenter.lat, mapCenter.lng, mapZoom]);
  return null;
}

// When a company is selected (from marker or card), zoom map to that company so rings are visible
function SelectedCompanyView({ selectedCompany }) {
  const map = useMap();
  useEffect(() => {
    if (selectedCompany?.lat != null && selectedCompany?.lng != null) {
      map.setView([selectedCompany.lat, selectedCompany.lng], 10);
    }
  }, [selectedCompany?.company_id, selectedCompany?.lat, selectedCompany?.lng, map]);
  return null;
}

// Expose Leaflet map instance to parent for zoom/center/refresh (react-leaflet ref is not the map)
function MapRefCapture({ mapInstanceRef }) {
  const map = useMap();
  useEffect(() => {
    mapInstanceRef.current = map;
    // Fix blank map: recalc tiles when container becomes visible
    const t = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 100);
    return () => {
      clearTimeout(t);
      mapInstanceRef.current = null;
    };
  }, [map, mapInstanceRef]);
  return null;
}

// Click empty map area to clear current selection/rings
function MapClickDeselect({ selectedCompanyId, onDeselect }) {
  useMapEvents({
    click: () => {
      if (selectedCompanyId) onDeselect();
    }
  });
  return null;
}

// Draw coverage rings with Leaflet API so they render reliably
const MILES_TO_METERS = 1609.34;
function CoverageRingsLayer({ rings, selectedCompanyId }) {
  const map = useMap();
  const layersRef = useRef([]);
  const ringsKey = rings.length
    ? `${selectedCompanyId}-${rings.map((r) => `${r.center[0]}:${r.center[1]}:${r.radiusMiles}`).join(',')}`
    : '';
  useEffect(() => {
    layersRef.current.forEach((layer) => {
      if (map && layer) map.removeLayer(layer);
    });
    layersRef.current = [];
    if (!map || !rings.length) return;
    rings.forEach((ring) => {
      const circle = L.circle(ring.center, {
        radius: ring.radiusMiles * MILES_TO_METERS,
        color: ring.color,
        fillColor: ring.color,
        fillOpacity: 0.25,
        weight: 2.5,
        opacity: 0.9
      });
      circle.addTo(map);
      layersRef.current.push(circle);
    });
    return () => {
      layersRef.current.forEach((layer) => {
        if (map && layer) map.removeLayer(layer);
      });
      layersRef.current = [];
    };
  }, [map, ringsKey]);
  return null;
}

// Draggable non-modal info panel so the map remains visible/interactable
function DraggableInfoPanel({ open, onClose, title, children, actions }) {
  const [position, setPosition] = useState(null);
  const paperRef = useRef(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const paper = paperRef.current;
    if (!paper) return;
    const rect = paper.getBoundingClientRect();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top
    };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.isDragging) return;
      setPosition({
        x: dragRef.current.startLeft + e.clientX - dragRef.current.startX,
        y: dragRef.current.startTop + e.clientY - dragRef.current.startY
      });
    };
    const onUp = () => {
      dragRef.current.isDragging = false;
    };
    if (open) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [open]);
  useEffect(() => { if (!open) setPosition(null); }, [open]);

  const isDragged = position != null;
  if (!open) return null;
  return (
    <Paper
      ref={paperRef}
      elevation={8}
      sx={{
        position: 'fixed',
        zIndex: 1300,
        width: { xs: 'calc(100% - 24px)', sm: 520 },
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 24px)',
        overflow: 'hidden',
        top: isDragged ? position.y : 12,
        left: isDragged ? position.x : '50%',
        transform: isDragged ? 'none' : 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'move', userSelect: 'none' }}
        onMouseDown={handleMouseDown}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
          <Box>{title}</Box>
          <Button size="small" onClick={onClose}>Close</Button>
        </Box>
      </Box>
      <Box sx={{ p: 2, overflow: 'auto' }}>{children}</Box>
      {actions && <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{actions}</Box>}
    </Paper>
  );
}

// Searchable by tech name, company name, city, state, phone
function matchCompanySearch(c, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return true;
  const q = searchTerm.trim().toLowerCase();
  const companyMatch = (c.company_name || '').toLowerCase().includes(q) ||
    (c.city || '').toLowerCase().includes(q) ||
    (c.state || '').toLowerCase().includes(q) ||
    (c.region || '').toLowerCase().includes(q);
  if (companyMatch) return true;
  const techs = c.techs || [];
  return techs.some(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
    (t.phone || '').toLowerCase().includes(q)
  );
}

function FieldTechMap() {
  const navigate = useNavigate();
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const { getChipSx } = useReadableChip();
  const { updateTrigger } = useDataSync('fieldTechCompanies');
  const [companies, setCompanies] = useState([]);
  const [regions, setRegions] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRegion, setFilterRegion] = useState('');
  const [filterState, setFilterState] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 });
  const [mapZoom, setMapZoom] = useState(4);
  const mapInstanceRef = useRef(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        include_techs: 'true',
        for_map: 'true',
        limit: '300',
      });
      if (filterRegion) params.set('region', filterRegion);
      if (filterState) params.set('state', filterState);
      if (searchTerm?.trim()) params.set('search', searchTerm.trim());

      const [companiesRes, regionsRes, statesRes] = await Promise.all([
        apiRef.current.get(`${getApiPath('fieldtechCompanies')}/?${params.toString()}`),
        apiRef.current.get(`${getApiPath('fieldtechCompanies')}/regions`).catch(() => []),
        apiRef.current.get(`${getApiPath('fieldtechCompanies')}/states`).catch(() => [])
      ]);
      setCompanies(companiesRes || []);
      setRegions(Array.isArray(regionsRes) ? regionsRes : []);
      setStates(Array.isArray(statesRes) ? statesRes : []);
      setError(null);
    } catch (err) {
      setError('Failed to load companies for map');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [filterRegion, filterState, searchTerm]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    if (updateTrigger != null && updateTrigger > 0) fetchCompanies();
  }, [updateTrigger, fetchCompanies]);

  // Debounce text search so map/card filtering does not rerender on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Backend already filters by region/state/search for performance at scale.
  // Keep lightweight client guard for consistency if backend params are omitted/fail.
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchRegion = !filterRegion || c.region === filterRegion;
      const matchState = !filterState || c.state === filterState;
      const matchSearch = !searchTerm || matchCompanySearch(c, searchTerm);
      return matchRegion && matchState && matchSearch;
    });
  }, [companies, filterRegion, filterState, searchTerm]);

  const companiesWithCoords = useMemo(
    () => filteredCompanies.filter(c => c.lat != null && c.lng != null),
    [filteredCompanies]
  );

  const handleCompanyClick = (company) => {
    setSelectedCompany(company);
    setDetailsOpen(true);
    const map = mapInstanceRef.current;
    if (company.lat != null && company.lng != null && map) {
      map.setView([company.lat, company.lng], 10);
    }
  };

  const handleMarkerClick = (company) => {
    handleCompanyClick(company);
    // No Popup – we only show the Dialog so there’s a single company info window
  };

  // Coverage rings for selected company: one per tech (or company default if no techs)
  const coverageRings = useMemo(() => {
    if (!selectedCompany || selectedCompany.lat == null || selectedCompany.lng == null) return [];
    const center = [selectedCompany.lat, selectedCompany.lng];
    const companyRadius = selectedCompany.service_radius_miles != null ? Number(selectedCompany.service_radius_miles) : null;
    const techs = selectedCompany.techs || [];
    if (techs.length === 0 && companyRadius != null) {
      return [{ center, radiusMiles: companyRadius, label: selectedCompany.company_name, color: RING_COLORS[0] }];
    }
    return techs
      .map((t, i) => {
        const miles = t.service_radius_miles != null ? Number(t.service_radius_miles) : companyRadius;
        if (miles == null) return null;
        return { center, radiusMiles: miles, label: t.name || `Tech ${i + 1}`, color: RING_COLORS[i % RING_COLORS.length] };
      })
      .filter(Boolean);
  }, [selectedCompany]);

  const handleDirections = (company) => {
    if (company.lat != null && company.lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${company.lat},${company.lng}`, '_blank');
    }
  };

  const clearFilters = () => {
    setFilterRegion('');
    setFilterState('');
    setSearchInput('');
    setSearchTerm('');
  };

  const handleZoomIn = () => { const m = mapInstanceRef.current; if (m) m.zoomIn(); };
  const handleZoomOut = () => { const m = mapInstanceRef.current; if (m) m.zoomOut(); };
  const handleCenterMap = () => {
    const m = mapInstanceRef.current;
    if (companiesWithCoords.length > 0 && m) {
      const bounds = L.latLngBounds(companiesWithCoords.map(c => [c.lat, c.lng]));
      m.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Field Tech Map
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tech name, company, city, state, phone..."
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select
                value={filterRegion}
                label="Region"
                onChange={(e) => setFilterRegion(e.target.value)}
              >
                <MenuItem value="">All Regions</MenuItem>
                {regions.map((region) => (
                  <MenuItem key={region} value={region}>{region}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>State</InputLabel>
              <Select
                value={filterState && states.some((s) => s.value === filterState) ? filterState : ''}
                label="State"
                onChange={(e) => setFilterState(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">All States</MenuItem>
                {states.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={fetchCompanies}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilterList />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Stats */}
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Chip 
          label={`${companiesWithCoords.length} company locations`} 
          color="primary" 
        />
        <Chip 
          label={`${filteredCompanies.length} filtered`} 
          color="info"
        />
        {coverageRings.length > 0 && (
          <Chip label="Rings = service area (miles)" size="small" variant="outlined" color="primary" />
        )}
      </Box>

      {/* Interactive Map */}
      <Paper sx={{ p: 0, mb: 2, overflow: 'hidden' }}>
        <Box sx={{ position: 'relative', height: '500px' }}>
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRefCapture mapInstanceRef={mapInstanceRef} />
            <MapClickDeselect
              selectedCompanyId={selectedCompany?.company_id}
              onDeselect={() => {
                setSelectedCompany(null);
                setDetailsOpen(false);
              }}
            />
            <MapBoundsUpdater 
              companiesWithCoords={companiesWithCoords}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              selectedCompanyId={selectedCompany?.company_id}
            />
            <SelectedCompanyView selectedCompany={selectedCompany} />

            <CoverageRingsLayer rings={coverageRings} selectedCompanyId={selectedCompany?.company_id} />

            {companiesWithCoords.map((company) => (
              <Marker
                key={company.company_id}
                position={[company.lat, company.lng]}
                icon={companyIcon}
                eventHandlers={{ click: () => handleMarkerClick(company) }}
              />
            ))}
          </MapContainer>
          
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onCenterMap={handleCenterMap}
          />
        </Box>
      </Paper>

      {/* Company list (searchable by tech name, company, city, state, phone) */}
      <Grid container spacing={2}>
        {filteredCompanies.map((company) => (
          <Grid item xs={12} sm={6} md={4} key={company.company_id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                '&:hover': { boxShadow: 3 },
                border: selectedCompany?.company_id === company.company_id ? 2 : 1,
                borderColor: selectedCompany?.company_id === company.company_id ? 'primary.main' : 'divider'
              }}
              onClick={() => handleCompanyClick(company)}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      <Business sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                      {company.company_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {[company.city, company.state].filter(Boolean).join(', ') || '—'}
                    </Typography>
                    {company.region && (
                      <Chip label={company.region} size="small" color="primary" sx={{ mb: 1 }} />
                    )}
                  </Box>
                  <Box>
                    {company.lat != null && company.lng != null ? (
                      <Tooltip title="On map"><LocationOn color="success" /></Tooltip>
                    ) : (
                      <Tooltip title="No ZIP coordinates"><LocationOn color="disabled" /></Tooltip>
                    )}
                  </Box>
                </Box>
                {(company.techs || []).length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {(company.techs || []).map(t => t.name).filter(Boolean).join(', ')}
                  </Typography>
                )}
                {company.lat != null && company.lng != null && (
                  <Button
                    size="small"
                    startIcon={<Directions />}
                    onClick={(e) => { e.stopPropagation(); handleDirections(company); }}
                    sx={{ mt: 1 }}
                  >
                    Get Directions
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Company detail dialog – drag by title bar to move and see map/rings */}
      <DraggableInfoPanel
        open={detailsOpen && !!selectedCompany}
        onClose={() => setDetailsOpen(false)}
        title={
          <Box display="flex" alignItems="center">
            <Business sx={{ mr: 1 }} />
            {selectedCompany?.company_name}
          </Box>
        }
        actions={
          <>
            {selectedCompany?.company_id && (
              <Button startIcon={<Edit />} onClick={() => { setDetailsOpen(false); navigate(`/companies/${selectedCompany.company_id}/edit`); }}>
                Edit company
              </Button>
            )}
            {selectedCompany?.lat != null && selectedCompany?.lng != null && (
              <Button startIcon={<Directions />} onClick={() => handleDirections(selectedCompany)}>
                Get Directions
              </Button>
            )}
            <Button onClick={() => setSelectedCompany(null)} color="warning">Clear selection</Button>
            <Button onClick={() => setDetailsOpen(false)}>Hide panel</Button>
          </>
        }
      >
        {selectedCompany && (
          <Grid container spacing={2}>
            {(selectedCompany.company_number || selectedCompany.business_phone || selectedCompany.other_phones) && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Company # & phones</Typography>
                <Typography variant="body2">
                  {[selectedCompany.company_number && `#${selectedCompany.company_number}`, selectedCompany.business_phone, selectedCompany.other_phones].filter(Boolean).join(' • ')}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Address</Typography>
              <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
                <LocationOn sx={{ mr: 1 }} />
                <Typography variant="body2">
                  {[selectedCompany.address, [selectedCompany.city, selectedCompany.state].filter(Boolean).join(', '), selectedCompany.zip].filter(Boolean).join(' ') || '—'}
                </Typography>
              </Box>
              {selectedCompany.region && (
                <Chip label={selectedCompany.region} size="small" sx={getChipSx('primary')} />
              )}
              {selectedCompany.service_radius_miles != null && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Default service area: {selectedCompany.service_radius_miles} mi
                </Typography>
              )}
            </Grid>
            {(selectedCompany.techs || []).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Techs & coverage</Typography>
                {(selectedCompany.techs || []).map((t) => (
                  <Box key={t.field_tech_id || t.name} sx={{ py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Person fontSize="small" />
                    <Typography variant="body2">{t.name}</Typography>
                    {t.service_radius_miles != null && (
                      <Chip label={`${t.service_radius_miles} mi`} size="small" variant="outlined" />
                    )}
                    {t.phone && (
                      <Typography variant="caption" color="text.secondary">{t.phone}</Typography>
                    )}
                  </Box>
                ))}
              </Grid>
            )}
            {selectedCompany.notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Notes</Typography>
                <Typography variant="body2">{selectedCompany.notes}</Typography>
              </Grid>
            )}
          </Grid>
        )}
      </DraggableInfoPanel>
    </Box>
  );
}

export default FieldTechMap; 
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Button, Chip, IconButton,
  Stack, useTheme, Tabs, Tab, TextField, InputAdornment,
  Tooltip, Skeleton, Link
} from '@mui/material';
import {
  Assignment, LocalShipping, Task, Add, Refresh, ChevronLeft, ChevronRight,
  CalendarMonth, ViewDay, Schedule, CheckCircle, Inventory, EventBusy,
  LocationOn, Home as HomeIcon, Build, Business, Assessment, Map as MapIcon, OpenInNew
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import dayjs from 'dayjs';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../AuthContext';
import useApi from '../hooks/useApi';
import useThemeTokens from '../hooks/useThemeTokens';
import StatusChip from './StatusChip';
import PriorityChip from './PriorityChip';
import TypeChip from './TypeChip';
import { useDataSync } from '../contexts/DataSyncContext';
import { useNotifications } from '../contexts/NotificationProvider';

const COLORS = {
  overdue: '#d32f2f',
  due: '#1976d2',
  upcoming: '#2e7d32',
  emergency: '#b71c1c',
  critical: '#e65100',
  normal: '#2e7d32'
};

function TicketCard({ ticket, variant = 'normal', onClick }) {
  const isOverdue = variant === 'overdue';
  const isUrgent = ticket?.priority === 'emergency' || ticket?.priority === 'critical';
  const borderColor = isOverdue ? COLORS.overdue : isUrgent ? COLORS[ticket.priority] : COLORS.due;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderLeft: `4px solid ${borderColor}`,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' }
      }}
      onClick={() => onClick?.(ticket?.ticket_id)}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.875rem' }}>
              {ticket?.ticket_id}
            </Typography>
            <TypeChip type={ticket?.type} size="small" sx={{ height: 20 }} />
            <PriorityChip priority={ticket?.priority} size="small" sx={{ height: 20 }} />
            <StatusChip status={ticket?.status} entityType="ticket" size="small" sx={{ height: 20 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {ticket?.site?.location || ticket?.site_id} • {ticket?.assigned_user?.name || 'Unassigned'}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

const TICKET_TYPES = [
  { key: 'all', label: 'All', icon: <Assignment /> },
  { key: 'onsite', label: 'Onsite', icon: <LocationOn /> },
  { key: 'inhouse', label: 'Inhouse', icon: <HomeIcon /> },
  { key: 'projects', label: 'Projects', icon: <Build /> },
  { key: 'misc', label: 'Misc', icon: <Assignment /> }
];

function ModernDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { get } = useApi();
  const { error: showError } = useToast();
  const { user } = useAuth();
  const { updateTrigger } = useDataSync('tickets');
  const { isConnected } = useNotifications();

  const [viewMode, setViewMode] = useState('day'); // 'day' | 'calendar'
  const [typeFilter, setTypeFilter] = useState('all'); // all | onsite | inhouse | projects | misc
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]); // For calendar counts & charts
  const [tasks, setTasks] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDailyTickets = useCallback(async () => {
    try {
      const data = await get(`/tickets/daily/${selectedDate}`);
      setTickets(data || []);
    } catch {
      setTickets([]);
      showError('Failed to load daily tickets');
    }
  }, [get, selectedDate, showError]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, allTRes, tasksRes, shipRes] = await Promise.all([
        get(`/tickets/daily/${selectedDate}`),
        get('/tickets/?limit=200'),
        get('/tasks/').catch(() => []),
        get('/shipments/').catch(() => [])
      ]);
      setTickets(tRes || []);
      setAllTickets(allTRes || []);
      setTasks(tasksRes || []);
      setShipments(shipRes || []);
    } catch {
      showError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [get, selectedDate, showError]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, updateTrigger]);

  // Categorize tickets for selected day
  const { overdue, dueToday, upcoming } = useMemo(() => {
    const today = selectedDate;
    const active = tickets.filter(t => !['completed', 'closed', 'approved', 'archived'].includes(t.status || ''));
    const byType = typeFilter === 'all' ? active : active.filter(t => (t.type || '') === typeFilter);
    return {
      overdue: byType.filter(t => {
        const d = t.date_scheduled || t.date_created;
        return d && String(d) < today;
      }).sort((a, b) => {
        const pa = { emergency: 3, critical: 2, normal: 1 }[a.priority] || 0;
        const pb = { emergency: 3, critical: 2, normal: 1 }[b.priority] || 0;
        return pa !== pb ? pa - pb : (a.date_scheduled || '').localeCompare(b.date_scheduled || '');
      }),
      dueToday: byType.filter(t => {
        const d = t.date_scheduled || t.date_created;
        return d === today;
      }).sort((a, b) => {
        const pa = { emergency: 3, critical: 2, normal: 1 }[a.priority] || 0;
        const pb = { emergency: 3, critical: 2, normal: 1 }[b.priority] || 0;
        return pb - pa;
      }),
      upcoming: byType
        .filter(t => {
          const d = t.date_scheduled || t.date_created;
          return d && String(d) > today;
        })
        .slice(0, 10)
        .sort((a, b) => {
          const da = String(a.date_scheduled || a.date_created || '');
          const db = String(b.date_scheduled || b.date_created || '');
          return da.localeCompare(db);
        })
    };
  }, [tickets, selectedDate, typeFilter]);

  // Chart: Status breakdown (from all active tickets)
  const statusChartData = useMemo(() => {
    const active = allTickets.filter(t => !['completed', 'closed', 'approved', 'archived'].includes(t.status || ''));
    const counts = {};
    active.forEach(t => {
      const s = t.status || 'open';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      fill: name === 'needs_parts' ? '#e65100' : name === 'in_progress' ? '#1976d2' : name === 'checked_in' ? '#ff9800' : '#666'
    }));
  }, [allTickets]);

  // Chart: Completed last 7 days
  const completionChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = dayjs().subtract(6 - i, 'day');
      const dateStr = d.format('YYYY-MM-DD');
      const completed = allTickets.filter(t => {
        if (t.status !== 'completed' && t.status !== 'closed' && t.status !== 'approved') return false;
        const closed = t.date_closed || (t.end_time && t.end_time.toString().slice(0, 10));
        return closed && closed.toString().startsWith(dateStr);
      }).length;
      return { day: d.format('ddd'), completed, date: dateStr };
    });
  }, [allTickets]);

  // Calendar: tickets per day (next 14 days + past 3)
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 14; i++) {
      const d = dayjs(selectedDate).add(i, 'day');
      const dateStr = d.format('YYYY-MM-DD');
      const count = allTickets.filter(t => {
        const sched = t.date_scheduled || t.date_created;
        if (!sched) return false;
        return sched === dateStr && !['completed', 'closed', 'archived'].includes(t.status || '');
      }).length;
      days.push({ date: dateStr, count, isSelected: dateStr === selectedDate, isToday: dateStr === dayjs().format('YYYY-MM-DD') });
    }
    return days;
  }, [selectedDate, allTickets]);

  const totalToday = overdue.length + dueToday.length;
  const activeTasks = tasks.filter(t => ['open', 'in_progress'].includes(t.status)).length;
  const pendingShipments = shipments.filter(s => s.status === 'pending').length;
  const needsParts = tickets.filter(t => t.status === 'needs_parts').length;
  const onsiteCount = tickets.filter(t => t.type === 'onsite' && !['completed', 'closed', 'archived'].includes(t.status || '')).length;
  const inhouseCount = tickets.filter(t => t.type === 'inhouse' && !['completed', 'closed', 'archived'].includes(t.status || '')).length;

  const goToDate = (delta) => {
    setSelectedDate(d => dayjs(d).add(delta, 'day').format('YYYY-MM-DD'));
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
            {dayjs(selectedDate).format('dddd, MMM D')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              icon={isConnected ? <CheckCircle sx={{ fontSize: 14 }} /> : null}
              label={isConnected ? 'Live' : 'Offline'}
              color={isConnected ? 'success' : 'default'}
              sx={{ height: 24 }}
            />
            <Typography variant="body2" color="text.secondary">{user?.name}</Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <IconButton onClick={fetchAllData} size="small"><Refresh /></IconButton>
          <Tabs value={viewMode} onChange={(_, v) => setViewMode(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}>
            <Tab value="day" label="Day View" icon={<ViewDay sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="calendar" label="Calendar" icon={<CalendarMonth sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
          <TextField
            size="small"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton size="small" onClick={() => goToDate(-1)}><ChevronLeft /></IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => goToDate(1)}><ChevronRight /></IconButton>
                </InputAdornment>
              )
            }}
            sx={{ width: 180 }}
          />
        </Stack>
      </Stack>

      {/* Quick stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer', bgcolor: overdue.length > 0 ? 'error.dark' : 'background.paper', color: overdue.length > 0 ? 'white' : 'text.primary' }} onClick={() => navigate('/tickets?status=active')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold">{overdue.length}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Overdue</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer' }} onClick={() => navigate('/tickets')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold" color="primary">{totalToday}</Typography>
              <Typography variant="body2" color="text.secondary">Today</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer' }} onClick={() => navigate('/tickets?type=onsite')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#1976d2' }}>{onsiteCount}</Typography>
              <Typography variant="body2" color="text.secondary">Onsite</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer' }} onClick={() => navigate('/tickets?type=inhouse')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#2e7d32' }}>{inhouseCount}</Typography>
              <Typography variant="body2" color="text.secondary">Inhouse</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer', borderLeft: needsParts > 0 ? '4px solid #e65100' : undefined }} onClick={() => navigate('/tickets?status=needs_parts')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold" sx={{ color: needsParts > 0 ? '#e65100' : 'text.secondary' }}>{needsParts}</Typography>
              <Typography variant="body2" color="text.secondary">Needs Parts</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold" color="secondary">{activeTasks}</Typography>
              <Typography variant="body2" color="text.secondary">Tasks</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item>
          <Card sx={{ minWidth: 140, cursor: 'pointer' }} onClick={() => navigate('/shipments')}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="h4" fontWeight="bold">{pendingShipments}</Typography>
              <Typography variant="body2" color="text.secondary">Shipments</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Main: Tickets for the day */}
        <Grid item lg={8}>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">Tickets for {dayjs(selectedDate).format('MMM D')}</Typography>
                <Tabs value={typeFilter} onChange={(_, v) => setTypeFilter(v)} sx={{ mt: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, textTransform: 'none' } }}>
                  {TICKET_TYPES.map(t => (
                    <Tab key={t.key} value={t.key} label={t.label} icon={t.icon} iconPosition="start" />
                  ))}
                </Tabs>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => navigate('/tickets')} endIcon={<OpenInNew sx={{ fontSize: 14 }} />}>
                  All Tickets
                </Button>
                <Button size="small" variant="contained" startIcon={<Add />} onClick={() => navigate('/tickets/new')}>
                  New Ticket
                </Button>
              </Stack>
            </Stack>

            {loading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" height={56} />)}
              </Stack>
            ) : (
              <Stack spacing={2}>
                {overdue.length > 0 && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <EventBusy sx={{ color: 'error.main', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight="bold" color="error.main">Overdue ({overdue.length})</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {overdue.map(t => (
                        <TicketCard key={t.ticket_id} ticket={t} variant="overdue" onClick={(id) => navigate(`/tickets/${id}`)} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {dueToday.length > 0 && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Schedule sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight="bold" color="primary.main">Due Today ({dueToday.length})</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {dueToday.map(t => (
                        <TicketCard key={t.ticket_id} ticket={t} variant="due" onClick={(id) => navigate(`/tickets/${id}`)} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {upcoming.length > 0 && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <CalendarMonth sx={{ color: 'success.main', fontSize: 20 }} />
                      <Typography variant="subtitle2" fontWeight="bold" color="success.main">Upcoming ({upcoming.length})</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {upcoming.map(t => (
                        <TicketCard key={t.ticket_id} ticket={t} variant="upcoming" onClick={(id) => navigate(`/tickets/${id}`)} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">No tickets for this date</Typography>
                    <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/tickets/new')}>Create a ticket</Button>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Sidebar: Charts, links & quick actions */}
        <Grid item lg={4}>
          <Stack spacing={3}>
            {/* Status breakdown */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>By Status</Typography>
              {loading ? <Skeleton variant="rectangular" height={180} /> : (
                statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                        {statusChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip formatter={(v, n) => [`${v} tickets`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No active tickets</Typography>
                )
              )}
            </Paper>

            {/* Completion trend */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Completed (7 days)</Typography>
              {loading ? <Skeleton variant="rectangular" height={140} /> : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={completionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#444' : '#eee'} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="completed" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>

            {/* Calendar / Week strip */}
            <Paper sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {viewMode === 'calendar' ? dayjs(selectedDate).format('MMMM YYYY') : 'Week'}
                </Typography>
                {viewMode === 'calendar' && (
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => setSelectedDate(dayjs(selectedDate).subtract(1, 'month').format('YYYY-MM-DD'))}>
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                    <Button size="small" sx={{ minWidth: 'auto', px: 1 }} onClick={() => setSelectedDate(dayjs().format('YYYY-MM-DD'))}>Today</Button>
                    <IconButton size="small" onClick={() => setSelectedDate(dayjs(selectedDate).add(1, 'month').format('YYYY-MM-DD'))}>
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
              {viewMode === 'calendar' ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <Typography key={i} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>{d}</Typography>
                  ))}
                  {Array.from({ length: dayjs(selectedDate).startOf('month').day() }, (_, i) => (
                    <Box key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: dayjs(selectedDate).daysInMonth() }, (_, i) => {
                    const d = dayjs(selectedDate).date(i + 1);
                    const dateStr = d.format('YYYY-MM-DD');
                    const count = allTickets.filter(t => {
                      const sched = t.date_scheduled || t.date_created;
                      return sched === dateStr && !['completed', 'closed', 'archived'].includes(t.status || '');
                    }).length;
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === dayjs().format('YYYY-MM-DD');
                    return (
                      <Tooltip key={dateStr} title={count > 0 ? `${count} tickets` : 'No tickets'}>
                        <Box
                          onClick={() => setSelectedDate(dateStr)}
                          sx={{
                            aspectRatio: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 1,
                            cursor: 'pointer',
                            bgcolor: isSelected ? 'primary.main' : isToday ? 'action.selected' : 'transparent',
                            color: isSelected ? 'primary.contrastText' : 'text.primary',
                            '&:hover': { bgcolor: isSelected ? 'primary.dark' : 'action.hover' }
                          }}
                        >
                          <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'}>{i + 1}</Typography>
                          {count > 0 && (
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: isSelected ? 'primary.contrastText' : 'primary.main', mt: 0.25 }} />
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {calendarDays.map(({ date, count, isSelected, isToday }) => (
                    <Tooltip key={date} title={`${count} tickets • ${dayjs(date).format('ddd, MMM D')}`}>
                      <Chip
                        size="small"
                        label={dayjs(date).format('D')}
                        onClick={() => setSelectedDate(date)}
                        sx={{
                          minWidth: 36,
                          fontWeight: isSelected ? 'bold' : 'normal',
                          border: isToday ? 2 : 0,
                          borderColor: 'primary.main',
                          bgcolor: isSelected ? 'primary.main' : count > 0 ? 'action.selected' : 'transparent',
                          color: isSelected ? 'primary.contrastText' : 'text.primary'
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              )}
            </Paper>

            {/* Quick actions */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Quick Actions</Typography>
              <Stack spacing={1}>
                <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => navigate('/tickets/new')}>New Ticket</Button>
                <Button fullWidth variant="outlined" startIcon={<LocalShipping />} onClick={() => navigate('/shipments/new')}>New Shipment</Button>
                <Button fullWidth variant="outlined" startIcon={<Task />} onClick={() => navigate('/tasks/new')}>New Task</Button>
                <Button fullWidth variant="outlined" startIcon={<Inventory />} onClick={() => navigate('/inventory')}>Inventory</Button>
              </Stack>
            </Paper>

            {/* Quick links */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Quick Links</Typography>
              <Stack spacing={1}>
                <Link component="button" variant="body2" onClick={() => navigate('/tickets')} sx={{ textAlign: 'left', justifyContent: 'flex-start' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><Assignment fontSize="small" /> All Tickets</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/tickets?type=onsite')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><LocationOn fontSize="small" /> Onsite Tickets</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/tickets?type=inhouse')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><HomeIcon fontSize="small" /> Inhouse Tickets</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/sites')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><Business fontSize="small" /> Sites</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/companies')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><Business fontSize="small" /> Field Tech Companies</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/map')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><MapIcon fontSize="small" /> Field Tech Map</Stack>
                </Link>
                <Link component="button" variant="body2" onClick={() => navigate('/reports')} sx={{ textAlign: 'left' }}>
                  <Stack direction="row" spacing={1} alignItems="center"><Assessment fontSize="small" /> Reports</Stack>
                </Link>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

export default ModernDashboard;

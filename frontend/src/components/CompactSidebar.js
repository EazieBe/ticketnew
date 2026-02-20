import React, { useState } from 'react';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  IconButton,
  Divider,
  Avatar,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment,
  Business,
  LocalShipping,
  Build,
  Assessment,
  Security,
  Person,
  Map,
  Speed,
  Settings,
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
  Add,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Logo from './Logo';

const mainItems = [
  { text: 'Daily Operations', path: '/', icon: <DashboardIcon /> },
  { text: 'Tickets', path: '/tickets', icon: <Assignment /> },
  { text: 'Sites', path: '/sites', icon: <Business /> },
  { text: 'Shipping', path: '/shipments', icon: <LocalShipping /> },
  { text: 'Inventory', path: '/inventory', icon: <Build /> },
  { text: 'Companies', path: '/companies', icon: <Business /> },
  { text: 'Tasks', path: '/tasks', icon: <Assessment /> },
  { text: 'Audit', path: '/audit', icon: <Security /> },
  { text: 'Users', path: '/users', icon: <Person /> },
  { text: 'Field Tech Map', path: '/map', icon: <Map /> },
  { text: 'SLA Management', path: '/sla', icon: <Speed /> },
];

const adminItems = [
  { text: 'Dispatcher Queue', path: '/dispatch-queue', icon: <Assignment /> },
  { text: 'Reports', path: '/reports', icon: <Assessment /> },
  { text: 'Settings', path: '/settings', icon: <Settings /> },
];

const canUseDispatchTools = (user) => user?.role === 'admin' || user?.role === 'dispatcher';

/** Sidebar content only (use inside App Drawer). open/collapsed controls label visibility; onToggle flips collapse. */
export default function CompactSidebar({ open: isOpen = true, onToggle }) {
  const [adminOpen, setAdminOpen] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, justifyContent: isOpen ? 'space-between' : 'center' }}>
        {isOpen ? (
          <Box sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Logo size="small" showText={true} variant="build" />
          </Box>
        ) : null}
        {onToggle && (
          <IconButton size="small" onClick={onToggle} aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {isOpen ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        )}
      </Box>
      <Divider />

      <List sx={{ px: 1.5, py: 0.5, flex: 1 }}>
        <ListItemButton
          onClick={() => navigate('/tickets/new')}
          sx={{
            mx: 0.5,
            mb: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            '&:hover': { bgcolor: 'primary.dark', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' },
          }}
        >
          <ListItemIcon sx={{ color: 'white', minWidth: 40 }}><Add /></ListItemIcon>
          {isOpen && <ListItemText primary="New Ticket" primaryTypographyProps={{ fontWeight: 600 }} />}
        </ListItemButton>

        {mainItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'))}
            onClick={() => navigate(item.path)}
            sx={{ borderRadius: 2, mx: 0.5, py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            {isOpen && <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem' }} />}
          </ListItemButton>
        ))}

        {canUseDispatchTools(user) && (
          <>
            <ListItemButton onClick={() => setAdminOpen(!adminOpen)} sx={{ borderRadius: 2, mx: 0.5, py: 0.75 }}>
              <ListItemIcon sx={{ minWidth: 40 }}><AdminPanelSettings /></ListItemIcon>
              {isOpen && <ListItemText primary="Admin / Dispatch" primaryTypographyProps={{ fontSize: '0.875rem' }} />}
              {isOpen && (adminOpen ? <ExpandLess /> : <ExpandMore />)}
            </ListItemButton>
            <Collapse in={adminOpen && isOpen}>
              <List component="div" disablePadding sx={{ px: 1 }}>
                {adminItems.map((item) => (
                  <ListItemButton
                    key={item.path}
                    selected={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    sx={{ pl: 4, borderRadius: 2, py: 0.6 }}
                  >
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>

      <Divider />
      <Box sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, fontSize: '0.875rem' }}>
            {user?.name?.charAt(0) || 'U'}
          </Avatar>
          {isOpen && (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{user?.name || 'User'}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{user?.role || 'User'}</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

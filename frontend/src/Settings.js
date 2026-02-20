import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Palette,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import ThemePreview from './components/ThemePreview';

// Color theme options (same as in App.js)
const colorThemes = {
  blue: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
    secondary: { main: '#dc004e', light: '#ff5983', dark: '#9a0036' }
  },
  green: {
    primary: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    secondary: { main: '#ff6f00', light: '#ff9800', dark: '#e65100' }
  },
  purple: {
    primary: { main: '#7b1fa2', light: '#9c27b0', dark: '#4a148c' },
    secondary: { main: '#ff5722', light: '#ff7043', dark: '#d84315' }
  },
  orange: {
    primary: { main: '#f57c00', light: '#ff9800', dark: '#e65100' },
    secondary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' }
  },
  teal: {
    primary: { main: '#00796b', light: '#009688', dark: '#004d40' },
    secondary: { main: '#ff4081', light: '#f50057', dark: '#c51162' }
  },
  indigo: {
    primary: { main: '#3f51b5', light: '#5c6bc0', dark: '#303f9f' },
    secondary: { main: '#ff9800', light: '#ffb74d', dark: '#f57c00' }
  }
};

function Settings() {
  const navigate = useNavigate();
  const { user, darkMode, toggleDarkMode } = useAuth();
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [selectedColorTheme, setSelectedColorTheme] = useState(() => {
    try { return localStorage.getItem('colorTheme') || 'blue'; } catch { return 'blue'; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('colorTheme', selectedColorTheme);
      window.dispatchEvent(new CustomEvent('colorThemeChange', { detail: selectedColorTheme }));
    } catch (_) {}
  }, [selectedColorTheme]);

  const handleThemeChange = (newTheme) => {
    setSelectedColorTheme(newTheme);
    setThemeDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Appearance Settings */}
        <Grid item xs={12} md={6}>
          <Card className="card-hover">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Palette sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Appearance</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={darkMode}
                      onChange={toggleDarkMode}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {darkMode ? <Brightness7 /> : <Brightness4 />}
                      <Typography sx={{ ml: 1 }}>
                        {darkMode ? 'Dark' : 'Light'} Mode
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Color Theme
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: 1, 
                    backgroundColor: colorThemes[selectedColorTheme].primary.main 
                  }} />
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {selectedColorTheme}
                  </Typography>
                  <Button 
                    size="small" 
                    onClick={() => setThemeDialogOpen(true)}
                    sx={{ ml: 'auto' }}
                  >
                    Change
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* User Profile summary – edit in Profile page */}
        <Grid item xs={12} md={6}>
          <Card className="card-hover">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Profile</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="body2" color="text.secondary">
                <strong>Name:</strong> {user?.name || 'User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Email:</strong> {user?.email || 'user@example.com'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Role:</strong> {user?.role || 'User'}
              </Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => navigate('/profile')}>
                Edit profile
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Theme Customization Dialog */}
      <Dialog 
        open={themeDialogOpen} 
        onClose={() => setThemeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette />
            Choose Color Theme
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select your preferred color scheme for the application
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(colorThemes).map(([themeName, colors]) => (
              <Grid item xs={6} sm={4} key={themeName}>
                <ThemePreview
                  themeName={themeName}
                  colors={colors}
                  isSelected={selectedColorTheme === themeName}
                  onClick={() => handleThemeChange(themeName)}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setThemeDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => setThemeDialogOpen(false)}
          >
            Apply Theme
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Settings; 
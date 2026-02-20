import { alpha, createTheme, Theme } from '@mui/material/styles';

export const colorThemes: Record<
  string,
  { primary: { main: string; light: string; dark: string }; secondary: { main: string; light: string; dark: string } }
> = {
  blue: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
    secondary: { main: '#dc004e', light: '#ff5983', dark: '#9a0036' },
  },
  green: {
    primary: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    secondary: { main: '#ff6f00', light: '#ff9800', dark: '#e65100' },
  },
  purple: {
    primary: { main: '#7b1fa2', light: '#9c27b0', dark: '#4a148c' },
    secondary: { main: '#ff5722', light: '#ff7043', dark: '#d84315' },
  },
  orange: {
    primary: { main: '#f57c00', light: '#ff9800', dark: '#e65100' },
    secondary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
  },
  teal: {
    primary: { main: '#00796b', light: '#009688', dark: '#004d40' },
    secondary: { main: '#ff4081', light: '#f50057', dark: '#c51162' },
  },
  indigo: {
    primary: { main: '#3f51b5', light: '#5c6bc0', dark: '#303f9f' },
    secondary: { main: '#ff9800', light: '#ffb74d', dark: '#f57c00' },
  },
  ics: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
    secondary: { main: '#00c853', light: '#5efc82', dark: '#009624' },
  },
};

/**
 * Builds the app MUI theme. Use with ThemeProvider.
 * Extracted for reuse (e.g. dark mode toggle, Settings page).
 */
export function createAppTheme(darkMode: boolean, colorTheme: string = 'blue'): Theme {
  const primary = colorThemes[colorTheme]?.primary ?? colorThemes.blue.primary;
  const primaryMain = primary.main;
  const primaryTint05 = alpha(primaryMain, 0.05);
  const primaryTint08 = alpha(primaryMain, 0.08);
  const primaryTint12 = alpha(primaryMain, 0.12);
  const primaryTint16 = alpha(primaryMain, 0.16);
  const primaryTint20 = alpha(primaryMain, 0.2);
  const primaryTint25 = alpha(primaryMain, 0.25);

  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary,
      secondary: colorThemes[colorTheme]?.secondary ?? colorThemes.blue.secondary,
      background: {
        default: darkMode ? '#0a0a0a' : '#f0f4f8',
        paper: darkMode ? '#1a1a1a' : '#ffffff',
      },
      text: {
        primary: darkMode ? '#ffffff' : '#1a202c',
        secondary: darkMode ? '#b0b0b0' : '#4a5568',
      },
      divider: darkMode ? '#333333' : '#e8ecf0',
      action: {
        hover: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        selected: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 14,
      h1: { fontSize: '2.25rem', fontWeight: 700 },
      h2: { fontSize: '1.75rem', fontWeight: 600 },
      h3: { fontSize: '1.5rem', fontWeight: 600 },
      h4: { fontSize: '1.25rem', fontWeight: 700 },
      h5: { fontSize: '1.1rem', fontWeight: 600 },
      h6: { fontSize: '1.1rem', fontWeight: 600 },
      subtitle1: { fontSize: '0.9rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.8rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.75rem' },
      button: { fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none' },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            boxShadow: darkMode
              ? '0 4px 6px rgba(0,0,0,0.07), 0 12px 28px rgba(0,0,0,0.15)'
              : '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
            backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
            border: darkMode ? '1px solid #2d2d2d' : '1px solid rgba(0,0,0,0.06)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
            border: darkMode ? '1px solid #2d2d2d' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: darkMode
              ? '0 2px 8px rgba(0,0,0,0.12)'
              : '0 2px 4px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
            boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.12)' : '0 2px 4px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#242424' : '#f8fafc',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: darkMode ? '1px solid #2d2d2d' : '1px solid #e8ecf0',
            padding: '14px 18px',
            fontSize: '0.8125rem',
          },
          head: {
            fontWeight: 700,
            backgroundColor: darkMode ? '#242424' : primaryTint05,
            fontSize: '0.8125rem',
          },
        },
      },
      MuiStepper: {
        styleOverrides: {
          root: { padding: '28px 0' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            color: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.87)',
            height: 24,
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: 10,
            '& .MuiChip-label': { px: 1, color: 'inherit' },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
            borderRadius: 12,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: darkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            margin: '1px 6px',
            paddingTop: 6,
            paddingBottom: 6,
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : primaryTint08,
            },
            '&.Mui-selected': {
              backgroundColor: darkMode ? primaryTint20 : primaryTint12,
              '&:hover': {
                backgroundColor: darkMode ? primaryTint25 : primaryTint16,
              },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: { minWidth: 36 },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: { fontSize: '0.875rem' },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '0.875rem' },
          input: { fontSize: '0.875rem' },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontSize: '0.875rem' },
        },
      },
    },
  });
}

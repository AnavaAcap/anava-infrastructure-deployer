import { createTheme } from '@mui/material/styles';

// Professional Anava theme with security/tech aesthetic
export const anavaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976D2', // Deep Tech Blue
      dark: '#115293',
      light: '#42A5F5',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#00897B', // Security Green
      dark: '#00695C',
      light: '#26A69A',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#F44336',
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#FFC107',
      light: '#FFD54F',
      dark: '#F57C00',
    },
    success: {
      main: '#4CAF50',
      light: '#66BB6A',
      dark: '#388E3C',
    },
    info: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      letterSpacing: '0.01em',
    },
    body1: {
      fontSize: '1rem',
      letterSpacing: '0.01em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #1976D2 30%, #42A5F5 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #115293 30%, #1976D2 90%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover fieldset': {
              borderColor: '#1976D2',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

// Dark theme variant
export const anavaDarkTheme = createTheme({
  ...anavaTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#42A5F5',
      dark: '#1976D2',
      light: '#64B5F6',
    },
    secondary: {
      main: '#26A69A',
      dark: '#00897B',
      light: '#4DB6AC',
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
    },
  },
});

// Magical dark theme - unified experience
export const magicalUnifiedTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00D4FF',
      dark: '#0066FF',
      light: '#66E5FF',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#A855F7',
      dark: '#8B5CF6',
      light: '#C084FC',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    info: {
      main: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
    },
    background: {
      default: '#0A0E27',
      paper: 'rgba(255, 255, 255, 0.05)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    text: {
      primary: 'rgba(255, 255, 255, 0.95)',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: 'rgba(255, 255, 255, 0.95)',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: 'rgba(255, 255, 255, 0.95)',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.95)',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.95)',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.95)',
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.95)',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      letterSpacing: '0.01em',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    body1: {
      fontSize: '1rem',
      letterSpacing: '0.01em',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 16px rgba(0, 212, 255, 0.3)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #00B8E6 0%, #0052CC 100%)',
          },
          '&.MuiButton-containedSecondary': {
            background: 'linear-gradient(135deg, #A855F7 0%, #8B5CF6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)',
            },
          },
        },
        outlined: {
          borderColor: 'rgba(0, 212, 255, 0.5)',
          color: '#00D4FF',
          '&:hover': {
            borderColor: '#00D4FF',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            '& fieldset': {
              borderColor: 'rgba(0, 212, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 212, 255, 0.3)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00D4FF',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          color: '#00D4FF',
          border: '1px solid rgba(0, 212, 255, 0.3)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderRadius: 4,
        },
        bar: {
          borderRadius: 4,
          background: 'linear-gradient(90deg, #0066FF 0%, #00D4FF 100%)',
        },
      },
    },
  },
});
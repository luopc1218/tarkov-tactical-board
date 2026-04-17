import { alpha, createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d0b16f',
      light: '#e2c892',
      dark: '#9d7f44',
      contrastText: '#17120a',
    },
    secondary: {
      main: '#6fb7ff',
    },
    background: {
      default: '#0d1117',
      paper: '#141a22',
    },
    text: {
      primary: '#f4efe2',
      secondary: '#aab6c5',
    },
    divider: alpha('#d0b16f', 0.18),
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily:
      "'Inter', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--desktop-titlebar-safe-top': '0px',
          '--desktop-titlebar-safe-right': '0px',
          '--desktop-window-controls-width': '0px',
        },
        html: { 
          height: '100%',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(123, 126, 132, 0.62) rgba(18, 18, 18, 0.68)',
          '&::-webkit-scrollbar': {
            width: '10px',
            height: '10px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(18, 18, 18, 0.68)',
            borderRadius: '999px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(123, 126, 132, 0.62)',
            border: '2px solid rgba(18, 18, 18, 0.72)',
            borderRadius: '999px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(177, 154, 105, 0.55)',
          },
          '&[data-platform="win32"]': {
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(123, 126, 132, 0.58) rgba(0, 0, 0, 0)',
            '& ::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '& ::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '& ::-webkit-scrollbar-thumb': {
              borderRadius: '999px',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              backgroundColor: 'rgba(123, 126, 132, 0.46)',
            },
            '& ::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(177, 154, 105, 0.55)',
            },
          },
          '&[data-platform="darwin"]': {
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(123, 126, 132, 0.58) rgba(0, 0, 0, 0)',
            '& ::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '& ::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '& ::-webkit-scrollbar-thumb': {
              borderRadius: '999px',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
              backgroundColor: 'rgba(123, 126, 132, 0.46)',
            },
            '& ::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(177, 154, 105, 0.55)',
            },
          },
        },
        body: {
          minHeight: '100%',
          margin: 0,
          background:
            'radial-gradient(circle at 16% 0%, rgba(208, 177, 111, 0.18), transparent 26%), radial-gradient(circle at 86% 10%, rgba(111, 183, 255, 0.12), transparent 24%), linear-gradient(180deg, #10151d 0%, #0f141b 45%, #0b1016 100%)',
          backgroundAttachment: 'fixed',
          color: '#f4efe2',
        },
        '#root': { minHeight: '100%' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#d0b16f', 0.18)}`,
          backdropFilter: 'blur(16px) saturate(120%)',
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.22)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          overflow: 'hidden',
          backgroundImage: 'none',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  },
})

import { alpha, createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d7b977',
      light: '#ead39e',
      dark: '#a78b52',
      contrastText: '#11100d',
    },
    secondary: {
      main: '#6badee',
      light: '#9acbfa',
      dark: '#397ab6',
      contrastText: '#07121c',
    },
    background: {
      default: '#050a0e',
      paper: '#0d151b',
    },
    text: {
      primary: '#edf1f3',
      secondary: '#9daab5',
    },
    divider: alpha('#9dabb7', 0.16),
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      "'Inter', 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    allVariants: {
      letterSpacing: 0,
    },
    h2: {
      fontWeight: 700,
      letterSpacing: 0,
    },
    h4: {
      fontWeight: 700,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          '--desktop-titlebar-safe-top': '0px',
          '--desktop-titlebar-safe-right': '0px',
          '--desktop-window-controls-width': '0px',
          '--app-bg': '#050a0e',
          '--app-surface': 'rgba(13, 21, 27, 0.88)',
          '--app-surface-strong': '#0d151b',
          '--app-border': 'rgba(157, 171, 183, 0.16)',
          '--app-accent': '#d7b977',
          '--app-info': '#6badee',
        },
        html: {
          height: '100%',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(112, 126, 136, 0.55) rgba(5, 10, 14, 0.72)',
          '&::-webkit-scrollbar': {
            width: '10px',
            height: '10px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(5, 10, 14, 0.72)',
            borderRadius: '999px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(112, 126, 136, 0.55)',
            border: '2px solid rgba(5, 10, 14, 0.72)',
            borderRadius: '999px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(215, 185, 119, 0.58)',
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
              backgroundColor: 'rgba(215, 185, 119, 0.58)',
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
              backgroundColor: 'rgba(215, 185, 119, 0.58)',
            },
          },
        },
        body: {
          minHeight: '100%',
          margin: 0,
          background: 'linear-gradient(180deg, #091015 0%, #050a0e 100%)',
          backgroundAttachment: 'fixed',
          color: '#edf1f3',
        },
        '#root': { minHeight: '100%' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${alpha('#9dabb7', 0.16)}`,
          backdropFilter: 'blur(18px) saturate(116%)',
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.2)',
          transition:
            'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition:
            'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 10px 26px rgba(0, 0, 0, 0.28)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          overflow: 'hidden',
          backgroundImage: 'none',
          transition:
            'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          transition:
            'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(4, 10, 14, 0.52)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#9dabb7', 0.22),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#d7b977', 0.46),
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: alpha('#9dabb7', 0.18),
          color: '#9daab5',
          '&.Mui-selected': {
            color: '#edf1f3',
            backgroundColor: alpha('#d7b977', 0.14),
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          transition:
            'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        transitionDuration: {
          appear: 180,
          enter: 180,
          exit: 140,
        },
      },
    },
  },
})

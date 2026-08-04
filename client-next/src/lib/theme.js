'use client';
import { createTheme } from '@mui/material/styles';

// Sacred Parchment color palette
export const colors = {
  background: '#F7F2E8',
  surface: '#EDE6D4',
  card: '#FFFFFF',
  gold: '#C9A84C',
  goldDark: '#8A6107',
  goldLight: '#E8C97A',
  crimson: '#8B1A1A',
  crimsonDark: '#5C0E0E',
  textPrimary: '#1C1208',
  textSecondary: '#5D3E2C',
  textMuted: '#9B7B6A',
  divider: 'rgba(201,168,76,0.3)',
  appBar: 'rgba(247,242,232,0.92)',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.gold,
      dark: colors.goldDark,
      light: colors.goldLight,
      contrastText: '#1C1208',
    },
    secondary: {
      main: colors.crimson,
      dark: colors.crimsonDark,
      contrastText: '#FFFFFF',
    },
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: colors.divider,
  },
  typography: {
    fontFamily: '"Lato", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontFamily: '"Cinzel", serif',
      fontWeight: 700,
      color: colors.textPrimary,
      letterSpacing: '0.05em',
    },
    h2: {
      fontFamily: '"Cinzel", serif',
      fontWeight: 600,
      color: colors.textPrimary,
      letterSpacing: '0.04em',
    },
    h3: {
      fontFamily: '"Cinzel", serif',
      fontWeight: 600,
      color: colors.textPrimary,
      letterSpacing: '0.03em',
    },
    h4: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 600,
      color: colors.textPrimary,
      fontStyle: 'italic',
    },
    h5: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 600,
      color: colors.textSecondary,
    },
    h6: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 500,
      color: colors.textSecondary,
    },
    subtitle1: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    subtitle2: {
      fontFamily: '"Lato", sans-serif',
      fontWeight: 600,
      color: colors.textSecondary,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontSize: '0.75rem',
    },
    body1: {
      fontFamily: '"Lato", sans-serif',
      lineHeight: 1.8,
      color: colors.textPrimary,
    },
    body2: {
      fontFamily: '"Lato", sans-serif',
      lineHeight: 1.6,
      color: colors.textSecondary,
    },
    button: {
      fontFamily: '"Cinzel", serif',
      fontWeight: 600,
      letterSpacing: '0.1em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 8px rgba(28,18,8,0.06)',
    '0 4px 16px rgba(28,18,8,0.08)',
    '0 8px 24px rgba(28,18,8,0.10)',
    '0 12px 32px rgba(28,18,8,0.12)',
    '0 16px 40px rgba(28,18,8,0.14)',
    '0 20px 48px rgba(28,18,8,0.16)',
    '0 24px 56px rgba(28,18,8,0.18)',
    '0 28px 64px rgba(28,18,8,0.20)',
    '0 32px 72px rgba(28,18,8,0.22)',
    '0 36px 80px rgba(28,18,8,0.24)',
    '0 40px 88px rgba(28,18,8,0.26)',
    '0 44px 96px rgba(28,18,8,0.28)',
    '0 48px 104px rgba(28,18,8,0.30)',
    '0 52px 112px rgba(28,18,8,0.32)',
    '0 56px 120px rgba(28,18,8,0.34)',
    '0 60px 128px rgba(28,18,8,0.36)',
    '0 64px 136px rgba(28,18,8,0.38)',
    '0 68px 144px rgba(28,18,8,0.40)',
    '0 72px 152px rgba(28,18,8,0.42)',
    '0 76px 160px rgba(28,18,8,0.44)',
    '0 80px 168px rgba(28,18,8,0.46)',
    '0 84px 176px rgba(28,18,8,0.48)',
    '0 88px 184px rgba(28,18,8,0.50)',
    '0 92px 192px rgba(28,18,8,0.52)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background,
          scrollBehavior: 'smooth',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.appBar,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 1px 0 rgba(201,168,76,0.2)',
          color: colors.textPrimary,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '10px 28px',
          fontSize: '0.8rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          transition: 'all 0.3s ease',
          minHeight: 44,
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
          color: '#1C1208',
          boxShadow: '0 2px 8px rgba(201,168,76,0.4)',
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.goldLight} 0%, ${colors.gold} 100%)`,
            boxShadow: '0 4px 16px rgba(201,168,76,0.5)',
            transform: 'translateY(-1px)',
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${colors.crimson} 0%, ${colors.crimsonDark} 100%)`,
          color: '#FFFFFF',
          '&:hover': {
            background: `linear-gradient(135deg, #A52020 0%, ${colors.crimson} 100%)`,
            transform: 'translateY(-1px)',
          },
        },
        outlinedPrimary: {
          borderColor: colors.gold,
          color: colors.goldDark,
          '&:hover': {
            backgroundColor: 'rgba(201,168,76,0.08)',
            borderColor: colors.goldDark,
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.card,
          border: '1px solid rgba(201,168,76,0.15)',
          boxShadow: '0 2px 12px rgba(28,18,8,0.06)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 32px rgba(28,18,8,0.12)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colors.surface,
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(28,18,8,0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(28,18,8,0.08)',
        },
        elevation3: {
          boxShadow: '0 8px 24px rgba(28,18,8,0.10)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.card,
            '& fieldset': {
              borderColor: 'rgba(201,168,76,0.4)',
            },
            '&:hover fieldset': {
              borderColor: colors.gold,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.gold,
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: colors.goldDark,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Lato", sans-serif',
          fontWeight: 600,
          letterSpacing: '0.05em',
        },
        colorPrimary: {
          backgroundColor: 'rgba(201,168,76,0.15)',
          color: colors.goldDark,
          border: '1px solid rgba(201,168,76,0.4)',
        },
        colorSecondary: {
          backgroundColor: 'rgba(139,26,26,0.1)',
          color: colors.crimson,
          border: '1px solid rgba(139,26,26,0.3)',
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          backgroundColor: colors.crimson,
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: '0.7rem',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.textPrimary,
          fontFamily: '"Lato", sans-serif',
          fontSize: '0.75rem',
        },
        arrow: {
          color: colors.textPrimary,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.divider,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: colors.goldDark,
          textDecorationColor: 'transparent',
          transition: 'color 0.2s ease',
          '&:hover': {
            color: colors.gold,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: colors.textSecondary,
          '&:hover': {
            backgroundColor: 'rgba(201,168,76,0.1)',
            color: colors.goldDark,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(201,168,76,0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(201,168,76,0.15)',
            '&:hover': {
              backgroundColor: 'rgba(201,168,76,0.2)',
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          '&.Mui-selected': {
            color: colors.goldDark,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: colors.gold,
          height: 3,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: colors.card,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(201,168,76,0.4)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.gold,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colors.gold,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: 'rgba(46,125,50,0.1)',
          color: '#1B5E20',
        },
        standardError: {
          backgroundColor: 'rgba(139,26,26,0.1)',
          color: colors.crimsonDark,
        },
        standardWarning: {
          backgroundColor: 'rgba(201,168,76,0.15)',
          color: colors.goldDark,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: colors.card,
          border: '1px solid rgba(201,168,76,0.15)',
          '&:before': { display: 'none' },
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          '&.Mui-expanded': {
            borderBottom: `1px solid ${colors.divider}`,
          },
        },
        expandIconWrapper: {
          color: colors.gold,
        },
      },
    },
  },
});

export default theme;

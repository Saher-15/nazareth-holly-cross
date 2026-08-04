import { createTheme, alpha } from '@mui/material/styles';

// ─── Color Palette ────────────────────────────────────────────────────────────
export const gold      = '#C9A84C';
export const goldLight = '#B5820A';   // darker gold for text on light bg
export const goldDark  = '#8A6107';
export const crimson   = '#8B1A1A';
export const darkBg    = '#F7F2E8';   // was #07050A — now warm cream
export const surfaceBg = '#EDE6D4';   // was #0F0B12 — parchment
export const cardBg    = '#FFFFFF';   // was #16111A — pure white
export const textPrimary   = '#1C1208';
export const textSecondary = '#5D3E2C';
export const textMuted     = '#9B7B6A';
export const borderColor   = alpha('#C9A84C', 0.25);

// ─── Reusable style objects ───────────────────────────────────────────────────
export const goldGradientText = {
  background: `linear-gradient(135deg, #7A5A0A 0%, ${gold} 50%, ${goldDark} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export const goldGradient = `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`;

export const glassCard = {
  background: `rgba(255,255,255,0.92)`,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${alpha(gold, 0.22)}`,
  borderRadius: '16px',
  boxShadow: `0 4px 24px ${alpha('#8A6107', 0.12)}`,
};

export const goldBorder = `1px solid ${alpha(gold, 0.3)}`;

export const sectionHeader = {
  fontFamily: '"Cinzel", serif',
  fontWeight: 700,
  letterSpacing: '0.05em',
};

// ─── MUI Theme ────────────────────────────────────────────────────────────────
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: gold,    light: '#D4B86A', dark: goldDark, contrastText: '#1C1208' },
    secondary: { main: crimson, light: '#B22222', dark: '#5C0000', contrastText: '#F5F0E8' },
    background: { default: '#F7F2E8', paper: '#FFFFFF' },
    text: {
      primary:   textPrimary,
      secondary: textSecondary,
      disabled:  textMuted,
    },
    divider: borderColor,
    action: {
      hover:    alpha(gold, 0.08),
      selected: alpha(gold, 0.14),
      focus:    alpha(gold, 0.18),
    },
  },

  typography: {
    fontFamily: '"Lato", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Cinzel", serif',           fontWeight: 700, letterSpacing: '0.05em',  color: textPrimary },
    h2: { fontFamily: '"Cinzel", serif',           fontWeight: 700, letterSpacing: '0.04em',  color: textPrimary },
    h3: { fontFamily: '"Cinzel", serif',           fontWeight: 600, letterSpacing: '0.03em',  color: textPrimary },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 700, color: textPrimary },
    h5: { fontFamily: '"Playfair Display", serif', fontWeight: 600, color: textPrimary },
    h6: { fontFamily: '"Playfair Display", serif', fontWeight: 600, color: textPrimary },
    body1: { fontFamily: '"Lato", sans-serif', fontWeight: 400, lineHeight: 1.85, color: textPrimary },
    body2: { fontFamily: '"Lato", sans-serif', fontWeight: 400, lineHeight: 1.75, color: textSecondary },
    button: { fontFamily: '"Cinzel", serif', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' },
    caption:  { fontFamily: '"Lato", sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: alpha(goldDark, 0.75) },
    overline: { fontFamily: '"Cinzel", serif', letterSpacing: '0.25em', color: alpha(goldDark, 0.7) },
  },

  shape: { borderRadius: 6 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { scrollBehavior: 'smooth' },
        body: {
          backgroundColor: '#F7F2E8',
          backgroundImage: `
            radial-gradient(ellipse at 15% 40%, ${alpha(crimson, 0.04)} 0%, transparent 55%),
            radial-gradient(ellipse at 85% 15%, ${alpha(gold, 0.05)} 0%, transparent 55%),
            radial-gradient(ellipse at 50% 95%, ${alpha(gold, 0.03)} 0%, transparent 60%)
          `,
          backgroundAttachment: 'fixed',
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(gold, 0.4)} transparent`,
          '&::-webkit-scrollbar': { width: '5px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(gold, 0.4),
            borderRadius: '3px',
            '&:hover': { background: alpha(gold, 0.65) },
          },
        },
        'img, video': { maxWidth: '100%', display: 'block' },
        a: {
          color: goldDark,
          textDecoration: 'none',
          transition: 'color 0.25s ease',
          '&:hover': { color: gold },
        },
        '::selection': { background: alpha(gold, 0.22), color: textPrimary },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: `rgba(247,242,232,0.92)`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(gold, 0.2)}`,
          boxShadow: `0 1px 0 ${alpha(gold, 0.15)}, 0 4px 20px ${alpha('#8A6107', 0.08)}`,
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '3px',
          padding: '11px 30px',
          fontSize: '0.74rem',
          letterSpacing: '0.16em',
          fontFamily: '"Cinzel", serif',
          fontWeight: 600,
          textTransform: 'uppercase',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          background: goldGradient,
          color: '#1C1208',
          boxShadow: `0 4px 16px ${alpha(gold, 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
            boxShadow: `0 6px 24px ${alpha(gold, 0.5)}`,
            transform: 'translateY(-2px)',
          },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { background: alpha(gold, 0.25), color: alpha('#1C1208', 0.4) },
        },
        outlined: {
          border: `1px solid ${alpha(gold, 0.5)}`,
          color: goldDark,
          '&:hover': {
            border: `1px solid ${gold}`,
            background: alpha(gold, 0.07),
          },
        },
        text: {
          color: textSecondary,
          '&:hover': { background: alpha(gold, 0.08), color: goldDark },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: '#FFFFFF',
          border: `1px solid ${alpha(gold, 0.18)}`,
          borderRadius: '12px',
          boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            border: `1px solid ${alpha(gold, 0.4)}`,
            boxShadow: `0 12px 40px ${alpha('#8A6107', 0.18)}`,
            transform: 'translateY(-5px)',
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#FFFFFF',
          border: `1px solid ${alpha(gold, 0.15)}`,
        },
        rounded: { borderRadius: '12px' },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            color: textPrimary,
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            '& fieldset': { borderColor: alpha(gold, 0.3) },
            '&:hover fieldset': { borderColor: alpha(gold, 0.55) },
            '&.Mui-focused fieldset': { borderColor: gold, boxShadow: `0 0 0 3px ${alpha(gold, 0.1)}` },
            '& input::placeholder, & textarea::placeholder': { color: textMuted },
          },
          '& .MuiInputLabel-root': {
            color: textMuted,
            '&.Mui-focused': { color: goldDark },
          },
          '& .MuiInputBase-input': { caretColor: goldDark },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        icon: { color: alpha(goldDark, 0.7) },
        select: { color: textPrimary },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: alpha(gold, 0.2) } },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif',
          letterSpacing: '0.06em',
          border: `1px solid ${alpha(gold, 0.35)}`,
          color: goldDark,
          background: alpha(gold, 0.09),
          '&:hover': { background: alpha(gold, 0.16) },
        },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: {
          background: `linear-gradient(135deg, ${crimson}, #B22222)`,
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.65rem',
          boxShadow: `0 0 8px ${alpha(crimson, 0.5)}`,
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          color: textSecondary,
          transition: 'all 0.25s ease',
          '&:hover': { color: goldDark, background: alpha(gold, 0.1) },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: '#FFFFFF',
          border: `1px solid ${alpha(gold, 0.3)}`,
          color: textPrimary,
          fontFamily: '"Lato", sans-serif',
          fontSize: '0.78rem',
          borderRadius: '6px',
          padding: '6px 12px',
          boxShadow: `0 4px 16px ${alpha('#8A6107', 0.15)}`,
        },
        arrow: { color: '#FFFFFF' },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: '8px', fontFamily: '"Lato", sans-serif' },
        standardSuccess: { background: alpha('#2E7D32', 0.08), border: `1px solid ${alpha('#4CAF50', 0.3)}` },
        standardError:   { background: alpha('#c62828', 0.08), border: `1px solid ${alpha('#EF5350', 0.3)}` },
        standardWarning: { background: alpha('#B8860B', 0.08), border: `1px solid ${alpha(gold, 0.4)}` },
        standardInfo:    { background: alpha('#1565C0', 0.08), border: `1px solid ${alpha('#42A5F5', 0.3)}` },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: alpha(gold, 0.15), borderRadius: '2px', height: '2px' },
        bar:  { background: `linear-gradient(90deg, ${goldDark}, ${gold})` },
      },
    },

    MuiCircularProgress: {
      styleOverrides: { root: { color: gold } },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Lato", sans-serif',
          color: textPrimary,
          '&:hover': { background: alpha(gold, 0.09) },
          '&.Mui-selected': { background: alpha(gold, 0.14) },
        },
      },
    },

    MuiListItem: {
      styleOverrides: {
        root: { '&:hover': { background: alpha(gold, 0.06) } },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: alpha(gold, 0.1) },
        wave: {
          '&::after': {
            background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.1)}, transparent)`,
          },
        },
      },
    },

    MuiPaginationItem: {
      styleOverrides: {
        root: {
          color: textSecondary,
          fontFamily: '"Cinzel", serif',
          border: `1px solid ${alpha(gold, 0.2)}`,
          '&:hover': { background: alpha(gold, 0.1), borderColor: alpha(gold, 0.45) },
          '&.Mui-selected': {
            background: goldGradient,
            color: '#1C1208',
            fontWeight: 700,
            border: 'none',
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: alpha(gold, 0.15) },
        head: { fontFamily: '"Cinzel", serif', color: goldDark, letterSpacing: '0.08em', fontWeight: 600 },
      },
    },
  },
});

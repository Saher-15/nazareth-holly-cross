import { createTheme, alpha } from '@mui/material/styles';

// ─── Color Palette ───────────────────────────────────────────────────────────
export const gold      = '#C9A84C';
export const goldLight = '#E8D5A3';
export const goldDark  = '#9A7B35';
export const crimson   = '#8B1A1A';
export const darkBg    = '#07050A';
export const surfaceBg = '#0F0B12';
export const cardBg    = '#16111A';
export const borderColor = alpha('#C9A84C', 0.2);

// ─── Reusable style objects ───────────────────────────────────────────────────
export const goldGradientText = {
  background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 50%, ${goldDark} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export const goldGradient = `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`;

export const glassCard = {
  background: `linear-gradient(145deg, ${alpha(cardBg, 0.9)} 0%, ${alpha(surfaceBg, 0.85)} 100%)`,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: `1px solid ${alpha(gold, 0.18)}`,
  borderRadius: '16px',
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
    mode: 'dark',
    primary:   { main: gold,   light: goldLight, dark: goldDark,  contrastText: '#07050A' },
    secondary: { main: crimson, light: '#B22222', dark: '#5C0000', contrastText: '#F5F0E8' },
    background: { default: darkBg, paper: cardBg },
    text: {
      primary:   '#F5F0E8',
      secondary: alpha('#F5F0E8', 0.65),
      disabled:  alpha('#F5F0E8', 0.35),
    },
    divider: borderColor,
    action: {
      hover:    alpha(gold, 0.07),
      selected: alpha(gold, 0.13),
      focus:    alpha(gold, 0.18),
    },
  },

  typography: {
    fontFamily: '"Lato", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Cinzel", serif',           fontWeight: 700, letterSpacing: '0.05em',  color: goldLight },
    h2: { fontFamily: '"Cinzel", serif',           fontWeight: 700, letterSpacing: '0.04em',  color: goldLight },
    h3: { fontFamily: '"Cinzel", serif',           fontWeight: 600, letterSpacing: '0.03em',  color: goldLight },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 700, color: goldLight },
    h5: { fontFamily: '"Playfair Display", serif', fontWeight: 600, color: goldLight },
    h6: { fontFamily: '"Playfair Display", serif', fontWeight: 600, color: goldLight },
    body1: { fontFamily: '"Lato", sans-serif', fontWeight: 300, lineHeight: 1.85, color: '#F5F0E8' },
    body2: { fontFamily: '"Lato", sans-serif', fontWeight: 300, lineHeight: 1.75 },
    button: { fontFamily: '"Cinzel", serif', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' },
    caption:  { fontFamily: '"Lato", sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: alpha(gold, 0.75) },
    overline: { fontFamily: '"Cinzel", serif', letterSpacing: '0.25em', color: alpha(gold, 0.7) },
  },

  shape: { borderRadius: 6 },

  components: {
    // ─── Global CSS baseline ───
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': { boxSizing: 'border-box' },
        html: { scrollBehavior: 'smooth' },
        body: {
          backgroundColor: darkBg,
          backgroundImage: `
            radial-gradient(ellipse at 15% 40%, ${alpha(crimson, 0.07)} 0%, transparent 55%),
            radial-gradient(ellipse at 85% 15%, ${alpha(gold, 0.06)} 0%, transparent 55%),
            radial-gradient(ellipse at 50% 95%, ${alpha(crimson, 0.05)} 0%, transparent 60%)
          `,
          backgroundAttachment: 'fixed',
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(gold, 0.35)} transparent`,
          '&::-webkit-scrollbar': { width: '5px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(gold, 0.35),
            borderRadius: '3px',
            '&:hover': { background: alpha(gold, 0.6) },
          },
        },
        'img, video': { maxWidth: '100%', display: 'block' },
        a: {
          color: gold,
          textDecoration: 'none',
          transition: 'color 0.25s ease',
          '&:hover': { color: goldLight },
        },
        '::selection': { background: alpha(gold, 0.25), color: goldLight },
      },
    },

    // ─── AppBar ───
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: `linear-gradient(180deg, ${alpha('#000', 0.95)} 0%, ${alpha(darkBg, 0.9)} 100%)`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${alpha(gold, 0.15)}`,
          boxShadow: `0 1px 0 ${alpha(gold, 0.12)}, 0 4px 24px ${alpha('#000', 0.5)}`,
        },
      },
    },

    // ─── Button ───
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
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${alpha('#fff', 0.05)} 0%, transparent 100%)`,
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::after': { opacity: 1 },
        },
        contained: {
          background: goldGradient,
          color: '#07050A',
          boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
            boxShadow: `0 6px 28px ${alpha(gold, 0.5)}`,
            transform: 'translateY(-2px)',
          },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { background: alpha(gold, 0.2), color: alpha('#07050A', 0.5) },
        },
        outlined: {
          border: `1px solid ${alpha(gold, 0.5)}`,
          color: gold,
          '&:hover': {
            border: `1px solid ${gold}`,
            background: alpha(gold, 0.07),
            boxShadow: `0 0 20px ${alpha(gold, 0.15)}`,
          },
        },
        text: {
          color: alpha(goldLight, 0.85),
          '&:hover': { background: alpha(gold, 0.07), color: gold },
        },
      },
    },

    // ─── Card ───
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: `linear-gradient(145deg, ${cardBg} 0%, ${surfaceBg} 100%)`,
          border: `1px solid ${alpha(gold, 0.13)}`,
          borderRadius: '12px',
          boxShadow: `0 4px 24px ${alpha('#000', 0.35)}`,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            border: `1px solid ${alpha(gold, 0.32)}`,
            boxShadow: `0 16px 48px ${alpha('#000', 0.6)}, 0 0 28px ${alpha(gold, 0.1)}`,
            transform: 'translateY(-6px)',
          },
        },
      },
    },

    // ─── Paper ───
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: cardBg,
          border: `1px solid ${alpha(gold, 0.1)}`,
        },
        rounded: { borderRadius: '12px' },
      },
    },

    // ─── TextField ───
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            color: '#F5F0E8',
            borderRadius: '6px',
            '& fieldset': { borderColor: alpha(gold, 0.2) },
            '&:hover fieldset': { borderColor: alpha(gold, 0.45) },
            '&.Mui-focused fieldset': { borderColor: gold, boxShadow: `0 0 0 3px ${alpha(gold, 0.08)}` },
            '& input::placeholder, & textarea::placeholder': { color: alpha(goldLight, 0.35) },
          },
          '& .MuiInputLabel-root': {
            color: alpha(goldLight, 0.5),
            '&.Mui-focused': { color: gold },
          },
          '& .MuiInputBase-input': { caretColor: gold },
        },
      },
    },

    // ─── Select ───
    MuiSelect: {
      styleOverrides: {
        icon: { color: alpha(gold, 0.6) },
      },
    },

    // ─── Divider ───
    MuiDivider: {
      styleOverrides: { root: { borderColor: alpha(gold, 0.15) } },
    },

    // ─── Chip ───
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif',
          letterSpacing: '0.06em',
          border: `1px solid ${alpha(gold, 0.35)}`,
          color: goldLight,
          background: alpha(gold, 0.07),
          '&:hover': { background: alpha(gold, 0.14) },
        },
      },
    },

    // ─── Badge ───
    MuiBadge: {
      styleOverrides: {
        badge: {
          background: `linear-gradient(135deg, ${crimson}, #B22222)`,
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.65rem',
          boxShadow: `0 0 8px ${alpha(crimson, 0.6)}`,
        },
      },
    },

    // ─── IconButton ───
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: alpha(goldLight, 0.75),
          transition: 'all 0.25s ease',
          '&:hover': { color: gold, background: alpha(gold, 0.1) },
        },
      },
    },

    // ─── Tooltip ───
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: surfaceBg,
          border: `1px solid ${alpha(gold, 0.25)}`,
          color: goldLight,
          fontFamily: '"Lato", sans-serif',
          fontSize: '0.78rem',
          borderRadius: '6px',
          padding: '6px 12px',
        },
        arrow: { color: surfaceBg },
      },
    },

    // ─── Alert ───
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: '8px', fontFamily: '"Lato", sans-serif' },
        standardSuccess: { background: alpha('#2E7D32', 0.12), border: `1px solid ${alpha('#4CAF50', 0.3)}` },
        standardError:   { background: alpha('#c62828', 0.12), border: `1px solid ${alpha('#EF5350', 0.3)}` },
        standardWarning: { background: alpha('#B8860B', 0.12), border: `1px solid ${alpha(gold, 0.35)}` },
        standardInfo:    { background: alpha('#1565C0', 0.12), border: `1px solid ${alpha('#42A5F5', 0.3)}` },
      },
    },

    // ─── LinearProgress ───
    MuiLinearProgress: {
      styleOverrides: {
        root:  { backgroundColor: alpha(gold, 0.12), borderRadius: '2px', height: '2px' },
        bar:   { background: `linear-gradient(90deg, ${goldDark}, ${gold}, ${goldLight})` },
      },
    },

    // ─── CircularProgress ───
    MuiCircularProgress: {
      styleOverrides: { root: { color: gold } },
    },

    // ─── MenuItem ───
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Lato", sans-serif',
          '&:hover': { background: alpha(gold, 0.09) },
          '&.Mui-selected': { background: alpha(gold, 0.14) },
        },
      },
    },

    // ─── List ───
    MuiListItem: {
      styleOverrides: {
        root: { '&:hover': { background: alpha(gold, 0.05) } },
      },
    },

    // ─── Skeleton ───
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: alpha(gold, 0.06) },
        wave: {
          '&::after': {
            background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.08)}, transparent)`,
          },
        },
      },
    },

    // ─── Pagination ───
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          color: alpha(goldLight, 0.6),
          fontFamily: '"Cinzel", serif',
          border: `1px solid ${alpha(gold, 0.15)}`,
          '&:hover': { background: alpha(gold, 0.1), borderColor: alpha(gold, 0.4) },
          '&.Mui-selected': {
            background: goldGradient,
            color: '#07050A',
            fontWeight: 700,
            border: 'none',
          },
        },
      },
    },

    // ─── Table ───
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: alpha(gold, 0.12) },
        head: { fontFamily: '"Cinzel", serif', color: gold, letterSpacing: '0.08em', fontWeight: 600 },
      },
    },
  },
});

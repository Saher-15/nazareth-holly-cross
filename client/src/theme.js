import { createTheme, alpha } from '@mui/material/styles';

// ─── Color Palette ────────────────────────────────────────────────────────────
export const colors = {
  gold: '#C9A84C',
  goldDark: '#8A6107',
  crimson: '#8B1A1A',
  crimsonDark: '#5C0F0F',
  background: '#F7F2E8',
  surface: '#EDE6D4',
  card: '#FFFFFF',
  textPrimary: '#1C1208',
  textSecondary: '#5D3E2C',
  textMuted: '#9B7B6A',
};

export const gold           = colors.gold;
export const goldLight      = '#B5820A';
export const goldDark       = colors.goldDark;
export const crimson        = colors.crimson;
export const darkBg         = colors.background;
export const surfaceBg      = colors.surface;
export const cardBg         = colors.card;
export const textPrimary    = colors.textPrimary;
export const textSecondary  = colors.textSecondary;
export const textMuted      = colors.textMuted;
export const borderColor    = alpha('#C9A84C', 0.25);

export const goldGradient     = `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`;
export const goldGradientText = {
  background: `linear-gradient(135deg, #7A5A0A 0%, ${colors.gold} 50%, ${colors.goldDark} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

export const glassCard = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${alpha(colors.gold, 0.22)}`,
  borderRadius: '16px',
  boxShadow: `0 4px 24px ${alpha('#8A6107', 0.12)}`,
};

export const goldBorder   = `1px solid ${alpha(colors.gold, 0.3)}`;
export const sectionHeader = {
  fontFamily: '"Cinzel", serif',
  fontWeight: 700,
  letterSpacing: '0.05em',
};

// ─── MUI v5 Theme ─────────────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.gold,
      light: '#D4B86A',
      dark: colors.goldDark,
      contrastText: '#1C1208',
    },
    secondary: {
      main: colors.crimson,
      light: '#B22222',
      dark: '#5C0000',
      contrastText: '#F5F0E8',
    },
    background: {
      default: colors.background,
      paper: colors.card,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textMuted,
    },
    divider: borderColor,
  },

  typography: {
    fontFamily: '"Lato", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Cinzel", serif', fontWeight: 700, letterSpacing: '0.05em' },
    h2: { fontFamily: '"Cinzel", serif', fontWeight: 700, letterSpacing: '0.04em' },
    h3: { fontFamily: '"Cinzel", serif', fontWeight: 600, letterSpacing: '0.03em' },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h5: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h6: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    body1: { fontFamily: '"Lato", sans-serif', fontWeight: 400, lineHeight: 1.85 },
    body2: { fontFamily: '"Lato", sans-serif', fontWeight: 400, lineHeight: 1.75 },
    button: { fontFamily: '"Cinzel", serif', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' },
    caption: { fontFamily: '"Lato", sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' },
    overline: { fontFamily: '"Cinzel", serif', letterSpacing: '0.25em' },
  },

  shape: { borderRadius: 6 },

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lato:wght@300;400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          background-color: #F7F2E8;
          scrollbar-width: thin;
          scrollbar-color: rgba(201,168,76,0.4) transparent;
        }
        body::-webkit-scrollbar { width: 5px; }
        body::-webkit-scrollbar-track { background: transparent; }
        body::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.4); border-radius: 3px; }
        img, video { max-width: 100%; display: block; }
        a { color: #8A6107; text-decoration: none; transition: color 0.25s ease; }
        a:hover { color: #C9A84C; }
        ::selection { background: rgba(201,168,76,0.22); color: #1C1208; }
      `,
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'rgba(247,242,232,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(colors.gold, 0.2)}`,
          boxShadow: `0 1px 0 ${alpha(colors.gold, 0.15)}, 0 4px 20px ${alpha('#8A6107', 0.08)}`,
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
          boxShadow: `0 4px 16px ${alpha(colors.gold, 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
            boxShadow: `0 6px 24px ${alpha(colors.gold, 0.5)}`,
            transform: 'translateY(-2px)',
          },
          '&:active': { transform: 'translateY(0)' },
        },
        outlined: {
          border: `1px solid ${alpha(colors.gold, 0.5)}`,
          color: colors.goldDark,
          '&:hover': {
            border: `1px solid ${colors.gold}`,
            background: alpha(colors.gold, 0.07),
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: '#FFFFFF',
          border: `1px solid ${alpha(colors.gold, 0.18)}`,
          borderRadius: '12px',
          boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            border: `1px solid ${alpha(colors.gold, 0.4)}`,
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
          border: `1px solid ${alpha(colors.gold, 0.15)}`,
        },
        rounded: { borderRadius: '12px' },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            color: colors.textPrimary,
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            '& fieldset': { borderColor: alpha(colors.gold, 0.3) },
            '&:hover fieldset': { borderColor: alpha(colors.gold, 0.55) },
            '&.Mui-focused fieldset': { borderColor: colors.gold },
          },
          '& .MuiInputLabel-root': {
            color: colors.textMuted,
            '&.Mui-focused': { color: colors.goldDark },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"Cinzel", serif',
          letterSpacing: '0.06em',
          border: `1px solid ${alpha(colors.gold, 0.35)}`,
          color: colors.goldDark,
          background: alpha(colors.gold, 0.09),
          '&:hover': { background: alpha(colors.gold, 0.16) },
        },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: {
          background: `linear-gradient(135deg, ${colors.crimson}, #B22222)`,
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.65rem',
        },
      },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: alpha(colors.gold, 0.2) } },
    },

    MuiCircularProgress: {
      styleOverrides: { root: { color: colors.gold } },
    },

    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: alpha(colors.gold, 0.1) } },
    },

    MuiPaginationItem: {
      styleOverrides: {
        root: {
          color: colors.textSecondary,
          fontFamily: '"Cinzel", serif',
          border: `1px solid ${alpha(colors.gold, 0.2)}`,
          '&:hover': { background: alpha(colors.gold, 0.1), borderColor: alpha(colors.gold, 0.45) },
          '&.Mui-selected': {
            background: goldGradient,
            color: '#1C1208',
            fontWeight: 700,
            border: 'none',
          },
        },
      },
    },
  },
});

export { theme };
export default theme;

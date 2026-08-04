import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import Slide from '@mui/material/Slide';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useTranslation } from 'react-i18next';
import { useShopContext } from '../context/shop-context';
import LanguageSwitcher from './LanguageSwitcher';
import { gold, goldDark, crimson, textPrimary, textSecondary, textMuted } from '../theme';

function HideOnScroll({ children }) {
  const trigger = useScrollTrigger();
  return <Slide appear={false} direction="down" in={!trigger}>{children}</Slide>;
}

const navLinks = [
  { key: 'navbar.home',    path: '/' },
  { key: 'navbar.tour',    path: '/tour' },
  { key: 'navbar.candle',  path: '/candle' },
  { key: 'navbar.shop',    path: '/shop', isShop: true },
  { key: 'navbar.reviews', path: '/reviews' },
  { key: 'about',          path: '/about',  labelOverride: 'About' },
];

export default function Navbar() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { getTotalCartQuantity } = useShopContext();
  const cartCount = getTotalCartQuantity?.() ?? 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleShopClick = () => {
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
    setDrawerOpen(false);
    navigate('/shop');
  };

  const isActive = (path) => location.pathname === path;

  const linkSx = (path) => ({
    fontFamily: '"Cinzel", serif',
    fontSize: '0.7rem',
    fontWeight: isActive(path) ? 700 : 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: isActive(path) ? goldDark : textSecondary,
    textDecoration: 'none',
    padding: '6px 0',
    position: 'relative',
    cursor: 'pointer',
    display: 'inline-block',
    transition: 'color 0.25s ease',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 0, left: 0,
      width: isActive(path) ? '100%' : '0%',
      height: '1px',
      background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
      transition: 'width 0.3s ease',
    },
    '&:hover': { color: goldDark },
    '&:hover::after': { width: '100%' },
  });

  return (
    <>
      <HideOnScroll>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            background: scrolled
              ? `rgba(247,242,232,0.96)`
              : 'transparent',
            backdropFilter: scrolled ? 'blur(20px)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
            borderBottom: scrolled
              ? `1px solid ${alpha(gold, 0.2)}`
              : '1px solid transparent',
            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: scrolled ? `0 4px 24px ${alpha('#8A6107', 0.1)}` : 'none',
          }}
        >
          <Toolbar
            sx={{
              maxWidth: '1440px', width: '100%', mx: 'auto',
              px: { xs: 2, sm: 3, md: 5 },
              minHeight: { xs: '64px', md: '70px' },
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            {/* ── Logo ── */}
            <Box
              component={Link} to="/"
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', flexShrink: 0 }}
            >
              <Box sx={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-cross" style={{ color: crimson, fontSize: '1.4rem', filter: `drop-shadow(0 0 8px ${alpha(crimson, 0.5)})` }} />
              </Box>
              <Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '0.78rem', md: '0.88rem' }, letterSpacing: '0.14em', color: textPrimary, lineHeight: 1.1 }}>
                  NAZARETH
                </Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 400, fontSize: { xs: '0.55rem', md: '0.62rem' }, letterSpacing: '0.22em', color: alpha(gold, 0.75), lineHeight: 1 }}>
                  HOLY CROSS
                </Box>
              </Box>
            </Box>

            {/* ── Desktop Nav ── */}
            <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: { md: 3, lg: 3.5 } }}>
              {/* Live — special red pulsing */}
              <Box
                component={Link} to="/live"
                sx={{
                  fontFamily: '"Cinzel", serif', fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.18em', color: crimson, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 0.6,
                  transition: 'all 0.25s ease',
                  '&:hover': { color: '#C02020', textShadow: `0 0 8px ${alpha(crimson, 0.4)}` },
                }}
              >
                <Box sx={{
                  width: 5, height: 5, borderRadius: '50%', backgroundColor: crimson,
                  animation: 'livePulse 1.6s ease-in-out infinite',
                  '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
                }} />
                {t('navbar.live')}
              </Box>

              {navLinks.map(({ key, path, isShop, labelOverride }) => (
                <Box
                  key={path}
                  component={isShop ? 'span' : Link}
                  to={isShop ? undefined : path}
                  onClick={isShop ? handleShopClick : undefined}
                  sx={linkSx(path)}
                >
                  {labelOverride || t(key)}
                </Box>
              ))}
            </Box>

            {/* ── Right controls ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton
                component={Link} to="/cart"
                size="small"
                sx={{ color: textSecondary, '&:hover': { color: goldDark, background: alpha(gold, 0.1) } }}
                aria-label="Cart"
              >
                <Badge badgeContent={cartCount} color="secondary">
                  <ShoppingCartOutlinedIcon sx={{ fontSize: '1.2rem' }} />
                </Badge>
              </IconButton>

              <LanguageSwitcher />

              {/* Hamburger — mobile only */}
              <IconButton
                sx={{ display: { md: 'none' }, color: textSecondary, '&:hover': { background: alpha(gold, 0.1), color: goldDark } }}
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
      </HideOnScroll>

      {/* ── Mobile Drawer ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 290,
            background: '#FFFFFF',
            borderLeft: `1px solid ${alpha(gold, 0.18)}`,
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <i className="fas fa-cross" style={{ color: crimson, fontSize: '1.1rem', filter: `drop-shadow(0 0 5px ${alpha(crimson, 0.4)})` }} />
            <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.2em', color: textPrimary }}>
              NAZARETH
            </Box>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: textMuted, '&:hover': { color: textSecondary, background: alpha(gold, 0.08) } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: alpha(gold, 0.15), mx: 2 }} />

        {/* Nav items */}
        <List sx={{ pt: 2, px: 1 }}>
          {[
            { label: t('navbar.live'),    path: '/live',    isLive: true },
            { label: t('navbar.home'),    path: '/' },
            { label: t('navbar.tour'),    path: '/tour' },
            { label: t('navbar.candle'),  path: '/candle' },
            { label: t('navbar.shop'),    path: '/shop',    isShop: true },
            { label: t('navbar.reviews'), path: '/reviews' },
            { label: 'About',             path: '/about' },
          ].map(({ label, path, isShop, isLive }) => (
            <ListItem
              key={path}
              component={isShop ? 'div' : Link}
              to={isShop ? undefined : path}
              onClick={isShop ? handleShopClick : () => setDrawerOpen(false)}
              sx={{
                py: 1.4, px: 2, mb: 0.5,
                borderRadius: '8px',
                cursor: 'pointer',
                border: isActive(path) ? `1px solid ${alpha(gold, 0.3)}` : '1px solid transparent',
                background: isActive(path) ? alpha(gold, 0.07) : 'transparent',
                transition: 'all 0.25s ease',
                textDecoration: 'none',
                '&:hover': { background: alpha(gold, 0.05), borderColor: alpha(gold, 0.18) },
              }}
            >
              {isLive && (
                <Box sx={{
                  width: 5, height: 5, borderRadius: '50%', backgroundColor: crimson, mr: 1.2,
                  animation: 'livePulse 1.6s ease-in-out infinite',
                  '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
                }} />
              )}
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.78rem',
                  letterSpacing: '0.16em',
                  fontWeight: isActive(path) ? 700 : 500,
                  color: isLive ? crimson : isActive(path) ? goldDark : textSecondary,
                }}
              />
            </ListItem>
          ))}
        </List>

        {/* Cart shortcut at bottom */}
        <Box sx={{ mt: 'auto', p: 3, borderTop: `1px solid ${alpha(gold, 0.12)}` }}>
          <Box
            component={Link} to="/cart"
            onClick={() => setDrawerOpen(false)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: '8px',
              background: alpha(gold, 0.06), border: `1px solid ${alpha(gold, 0.2)}`,
              textDecoration: 'none', transition: 'all 0.25s ease',
              '&:hover': { background: alpha(gold, 0.1), borderColor: alpha(gold, 0.35) },
            }}
          >
            <Box sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.15em', color: goldDark }}>
              CART
            </Box>
            <Badge badgeContent={cartCount} color="secondary">
              <ShoppingCartOutlinedIcon sx={{ fontSize: '1.1rem', color: textSecondary }} />
            </Badge>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

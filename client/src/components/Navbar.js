import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Box, Container, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemText, Typography, Button, Badge, Collapse,
  Divider, Menu, MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShopContext } from '../context/shop-context';
import LanguageSwitcher from './LanguageSwitcher';
import { colors, gold, goldDark, crimson, textSecondary, textMuted } from '../theme';

const NAV_LINKS = [
  { key: 'navbar.home',    path: '/' },
  { key: 'navbar.tour',    path: '/tour' },
  { key: 'navbar.candle',  path: '/candle' },
  { key: 'navbar.shop',    path: '/shop',        isShop: true },
  { key: 'navbar.reviews', path: '/reviews' },
  { label: 'About',        path: '/about' },
  { label: 'Contact',      path: '/contact' },
];

const GALLERY_LINKS = [
  { label: 'Latin Church',  path: '/gallery/latin' },
  { label: 'Greek Church',  path: '/gallery/greek' },
  { label: "Mary's Well",   path: '/gallery/maryswell' },
  { label: 'Old City',      path: '/gallery/old-city' },
  { label: 'Nazareth',      path: '/gallery/nazareth' },
];

export default function Navbar() {
  const { t }        = useTranslation();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { getTotalCartQuantity } = useShopContext();
  const cartCount    = getTotalCartQuantity?.() ?? 0;

  const [scrolled,         setScrolled]         = useState(false);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [galleryExpanded,  setGalleryExpanded]  = useState(false);
  const [anchorEl,         setAnchorEl]         = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleShopClick = () => {
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
    setDrawerOpen(false);
    navigate('/shop');
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={scrolled ? 4 : 0}
        sx={{
          backgroundColor: scrolled ? 'rgba(28,14,6,0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? `1px solid ${alpha(gold, 0.2)}` : 'none',
          transition: 'all 0.3s ease',
          boxShadow: scrolled ? `0 4px 24px ${alpha('#000', 0.25)}` : 'none',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            disableGutters
            sx={{ py: { xs: 1, md: 0.5 }, minHeight: { xs: 64, md: 70 } }}
          >
            {/* Logo */}
            <Box
              component={Link}
              to="/"
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                textDecoration: 'none',
                flexGrow: { xs: 1, lg: 0 },
                mr: { lg: 4 },
              }}
            >
              <Box sx={{ fontSize: '1.5rem', color: crimson, lineHeight: 1, filter: `drop-shadow(0 0 8px ${alpha(crimson, 0.5)})` }}>
                ✝
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif', fontWeight: 700,
                    fontSize: { xs: '0.82rem', md: '0.92rem' },
                    color: gold, lineHeight: 1.1, letterSpacing: '0.14em',
                  }}
                >
                  NAZARETH
                </Typography>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif', fontWeight: 400,
                    fontSize: { xs: '0.52rem', md: '0.60rem' },
                    color: alpha(gold, 0.7), lineHeight: 1, letterSpacing: '0.22em',
                  }}
                >
                  HOLY CROSS
                </Typography>
              </Box>
            </Box>

            {/* Desktop links */}
            <Box
              sx={{
                display: { xs: 'none', lg: 'flex' },
                alignItems: 'center', gap: 0.5, flexGrow: 1,
              }}
            >
              {/* Live — special */}
              <Button
                component={Link}
                to="/live"
                sx={{
                  color: crimson, fontFamily: '"Cinzel", serif',
                  fontSize: '0.70rem', letterSpacing: '0.18em',
                  px: 1.5, borderRadius: 0,
                  display: 'flex', alignItems: 'center', gap: 0.6,
                  '&:hover': { color: '#C02020', backgroundColor: 'transparent' },
                }}
              >
                <Box
                  sx={{
                    width: 5, height: 5, borderRadius: '50%',
                    backgroundColor: crimson,
                    animation: 'livePulse 1.6s ease-in-out infinite',
                    '@keyframes livePulse': {
                      '0%,100%': { opacity: 1 },
                      '50%': { opacity: 0.25 },
                    },
                  }}
                />
                {t('navbar.live')}
              </Button>

              {NAV_LINKS.map(({ key, label, path, isShop }) => (
                <Button
                  key={path}
                  component={isShop ? 'button' : Link}
                  to={isShop ? undefined : path}
                  onClick={isShop ? handleShopClick : undefined}
                  sx={{
                    color: isActive(path) ? gold : 'rgba(247,242,232,0.85)',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.70rem',
                    letterSpacing: '0.14em',
                    px: 1.5,
                    borderBottom: isActive(path) ? `2px solid ${gold}` : '2px solid transparent',
                    borderRadius: 0,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: gold, backgroundColor: 'transparent' },
                  }}
                >
                  {label || t(key)}
                </Button>
              ))}

              {/* Gallery dropdown */}
              <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                endIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem !important', color: 'inherit' }} />}
                sx={{
                  color: 'rgba(247,242,232,0.85)', fontFamily: '"Cinzel", serif',
                  fontSize: '0.70rem', letterSpacing: '0.14em', px: 1.5, borderRadius: 0,
                  '&:hover': { color: gold, backgroundColor: 'transparent' },
                }}
              >
                Gallery
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                PaperProps={{
                  sx: {
                    backgroundColor: '#1C0E06',
                    border: `1px solid ${alpha(gold, 0.2)}`,
                    mt: 1,
                    minWidth: 180,
                    '&::before': {
                      content: '""', position: 'absolute', top: 0, left: 0, right: 0,
                      height: '2px',
                      background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
                    },
                  },
                }}
              >
                {GALLERY_LINKS.map((g) => (
                  <MenuItem
                    key={g.path}
                    component={Link}
                    to={g.path}
                    onClick={() => setAnchorEl(null)}
                    sx={{
                      color: 'rgba(247,242,232,0.85)',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.76rem',
                      letterSpacing: '0.08em',
                      '&:hover': { color: gold, backgroundColor: alpha(gold, 0.08) },
                    }}
                  >
                    {g.label}
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Right controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LanguageSwitcher />
              <IconButton
                component={Link}
                to="/cart"
                size="small"
                aria-label="Cart"
                sx={{ color: 'rgba(247,242,232,0.85)', '&:hover': { color: gold } }}
              >
                <Badge badgeContent={cartCount} color="secondary">
                  <ShoppingCartOutlinedIcon sx={{ fontSize: '1.2rem' }} />
                </Badge>
              </IconButton>
              <IconButton
                sx={{ display: { xs: 'flex', lg: 'none' }, color: 'rgba(247,242,232,0.85)', '&:hover': { color: gold } }}
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 290,
            backgroundColor: '#1C0E06',
            color: '#F7F2E8',
            border: `none`,
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', color: gold, fontWeight: 700, letterSpacing: '0.2em', fontSize: '0.8rem' }}>
            MENU
          </Typography>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: alpha('#F7F2E8', 0.6) }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: alpha(gold, 0.15) }} />

        <List sx={{ pt: 1 }}>
          {/* Live */}
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/live"
              onClick={() => setDrawerOpen(false)}
              sx={{
                '&:hover': { backgroundColor: alpha(gold, 0.06) },
                display: 'flex', gap: 1, alignItems: 'center',
              }}
            >
              <Box sx={{
                width: 5, height: 5, borderRadius: '50%', backgroundColor: crimson, flexShrink: 0,
                animation: 'livePulse 1.6s ease-in-out infinite',
                '@keyframes livePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
              }} />
              <ListItemText
                primary={t('navbar.live')}
                primaryTypographyProps={{
                  fontFamily: '"Cinzel", serif', fontSize: '0.82rem',
                  color: crimson, letterSpacing: '0.16em',
                }}
              />
            </ListItemButton>
          </ListItem>

          {NAV_LINKS.map(({ key, label, path, isShop }) => (
            <ListItem key={path} disablePadding>
              <ListItemButton
                component={isShop ? 'div' : Link}
                to={isShop ? undefined : path}
                onClick={isShop ? handleShopClick : () => setDrawerOpen(false)}
                selected={isActive(path)}
                sx={{
                  '&.Mui-selected': { backgroundColor: alpha(gold, 0.08) },
                  '&:hover': { backgroundColor: alpha(gold, 0.06) },
                }}
              >
                <ListItemText
                  primary={label || t(key)}
                  primaryTypographyProps={{
                    fontFamily: '"Cinzel", serif', fontSize: '0.82rem',
                    color: isActive(path) ? gold : 'rgba(247,242,232,0.8)',
                    letterSpacing: '0.14em',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}

          {/* Gallery accordion */}
          <ListItem disablePadding>
            <ListItemButton onClick={() => setGalleryExpanded(!galleryExpanded)} sx={{ '&:hover': { backgroundColor: alpha(gold, 0.06) } }}>
              <ListItemText
                primary="Gallery"
                primaryTypographyProps={{
                  fontFamily: '"Cinzel", serif', fontSize: '0.82rem',
                  color: 'rgba(247,242,232,0.8)', letterSpacing: '0.14em',
                }}
              />
              <ExpandMoreIcon
                sx={{
                  color: alpha(gold, 0.6), fontSize: '1.1rem',
                  transform: galleryExpanded ? 'rotate(180deg)' : 'none',
                  transition: '0.25s',
                }}
              />
            </ListItemButton>
          </ListItem>
          <Collapse in={galleryExpanded}>
            {GALLERY_LINKS.map((g) => (
              <ListItem key={g.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={g.path}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ pl: 5, '&:hover': { backgroundColor: alpha(gold, 0.06) } }}
                >
                  <ListItemText
                    primary={g.label}
                    primaryTypographyProps={{
                      fontFamily: '"Lato", sans-serif', fontSize: '0.80rem',
                      color: 'rgba(247,242,232,0.65)', letterSpacing: '0.05em',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </Collapse>
        </List>

        {/* Cart shortcut */}
        <Box sx={{ mt: 'auto', p: 3, borderTop: `1px solid ${alpha(gold, 0.12)}` }}>
          <Box
            component={Link}
            to="/cart"
            onClick={() => setDrawerOpen(false)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: '8px',
              background: alpha(gold, 0.06), border: `1px solid ${alpha(gold, 0.2)}`,
              textDecoration: 'none', transition: 'all 0.25s ease',
              '&:hover': { background: alpha(gold, 0.1), borderColor: alpha(gold, 0.35) },
            }}
          >
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.18em', color: goldDark }}>
              CART
            </Typography>
            <Badge badgeContent={cartCount} color="secondary">
              <ShoppingCartOutlinedIcon sx={{ fontSize: '1.1rem', color: textSecondary }} />
            </Badge>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Box, Button, IconButton, Drawer,
  List, ListItem, ListItemButton, ListItemText, Typography,
  Badge, Divider, Stack, useMediaQuery, useTheme, Tooltip,
  Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FavoriteIcon from '@mui/icons-material/FavoriteBorder';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { colors } from '@/lib/theme';
import LanguageSwitcher from './LanguageSwitcher';
import { useShop } from '@/context/ShopContext';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';

const galleryLinks = [
  { key: 'latin', label: 'Latin Church', href: '/gallery/latin' },
  { key: 'greek', label: 'Greek Church', href: '/gallery/greek' },
  { key: 'maryswell', label: "Mary's Well", href: '/gallery/maryswell' },
  { key: 'old-city', label: 'Old City', href: '/gallery/old-city' },
  { key: 'nazareth', label: 'Nazareth', href: '/gallery/nazareth' },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const pathname = usePathname();
  const locale = useLocale();
  const { cartCount } = useShop();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Live', href: '/live' },
    { label: 'Tour', href: '/tour' },
    { label: 'Candle', href: '/candle' },
    { label: 'Shop', href: '/shop' },
    { label: 'Reviews', href: '/reviews' },
    { label: 'Contact', href: '/contact' },
  ];

  const isActive = (href) => {
    const full = `/${locale}${href === '/' ? '' : href}`;
    return pathname === full || pathname.startsWith(`/${locale}${href}/`);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={scrolled ? 1 : 0}
        sx={{
          backgroundColor: scrolled ? colors.appBar : 'rgba(247,242,232,0.98)',
          backdropFilter: 'blur(20px)',
          transition: 'all 0.3s ease',
          borderBottom: `1px solid ${scrolled ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
        }}
      >
        <Toolbar sx={{ px: { xs: 2, md: 4 }, minHeight: { xs: 64, md: 72 } }}>
          {/* Logo */}
          <Box component={Link} href={`/${locale}`} sx={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              ✝
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography
                sx={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: { sm: '0.95rem', md: '1.05rem' },
                  color: colors.textPrimary,
                  lineHeight: 1.2,
                  letterSpacing: '0.04em',
                }}
              >
                Nazareth Holy Cross
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'Playfair Display, serif',
                  fontStyle: 'italic',
                  fontSize: '0.65rem',
                  color: colors.textMuted,
                  letterSpacing: '0.06em',
                }}
              >
                Sacred Ministry
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop Navigation */}
          {!isMobile && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  component={Link}
                  href={`/${locale}${link.href === '/' ? '' : link.href}`}
                  sx={{
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isActive(link.href) ? colors.goldDark : colors.textSecondary,
                    borderBottom: isActive(link.href) ? `2px solid ${colors.gold}` : '2px solid transparent',
                    borderRadius: 0,
                    px: 1.5,
                    py: 1,
                    minHeight: 48,
                    '&:hover': {
                      color: colors.goldDark,
                      backgroundColor: 'transparent',
                      borderBottom: `2px solid ${colors.gold}`,
                    },
                  }}
                >
                  {link.label}
                </Button>
              ))}
              {/* Gallery Dropdown */}
              <Box sx={{ position: 'relative' }}>
                <Button
                  endIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem !important' }} />}
                  sx={{
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: pathname.includes('/gallery') ? colors.goldDark : colors.textSecondary,
                    px: 1.5,
                    py: 1,
                    '&:hover': { color: colors.goldDark, backgroundColor: 'transparent' },
                  }}
                  onClick={(e) => setGalleryExpanded(!galleryExpanded)}
                >
                  Gallery
                </Button>
              </Box>
            </Stack>
          )}

          {/* Action buttons */}
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: { xs: 0, md: 1 } }}>
            <LanguageSwitcher />
            {!isMobile && (
              <Tooltip title="Cart">
                <IconButton
                  component={Link}
                  href={`/${locale}/cart`}
                  sx={{ color: colors.textSecondary }}
                >
                  <Badge badgeContent={cartCount} color="secondary">
                    <ShoppingCartIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            {isMobile && (
              <>
                <IconButton component={Link} href={`/${locale}/cart`} sx={{ color: colors.textSecondary }}>
                  <Badge badgeContent={cartCount} color="secondary">
                    <ShoppingCartIcon fontSize="small" />
                  </Badge>
                </IconButton>
                <IconButton
                  onClick={() => setDrawerOpen(true)}
                  sx={{ color: colors.textPrimary }}
                  aria-label="open menu"
                >
                  <MenuIcon />
                </IconButton>
              </>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            backgroundColor: colors.background,
            borderLeft: `1px solid rgba(201,168,76,0.2)`,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: '1rem',
              color: colors.textPrimary,
            }}
          >
            Nazareth Holy Cross
          </Typography>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: colors.textSecondary }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.2)' }} />
        <List sx={{ pt: 1 }}>
          {navLinks.map((link) => (
            <ListItem key={link.href} disablePadding>
              <ListItemButton
                component={Link}
                href={`/${locale}${link.href === '/' ? '' : link.href}`}
                onClick={() => setDrawerOpen(false)}
                selected={isActive(link.href)}
                sx={{ px: 3, py: 1.5 }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    letterSpacing: '0.06em',
                    color: isActive(link.href) ? colors.goldDark : colors.textPrimary,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {/* Gallery sub-items */}
          <ListItem disablePadding>
            <ListItemButton onClick={() => setGalleryExpanded(!galleryExpanded)} sx={{ px: 3, py: 1.5 }}>
              <ListItemText
                primary="Gallery"
                primaryTypographyProps={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  letterSpacing: '0.06em',
                  color: colors.textPrimary,
                }}
              />
              <ExpandMoreIcon sx={{ color: colors.textMuted, transform: galleryExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </ListItemButton>
          </ListItem>
          <Collapse in={galleryExpanded}>
            {galleryLinks.map((g) => (
              <ListItem key={g.key} disablePadding>
                <ListItemButton
                  component={Link}
                  href={`/${locale}${g.href}`}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ pl: 6, py: 1 }}
                >
                  <ListItemText
                    primary={g.label}
                    primaryTypographyProps={{
                      fontFamily: 'Lato, sans-serif',
                      fontSize: '0.8rem',
                      color: colors.textSecondary,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </Collapse>
        </List>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.2)', mt: 'auto' }} />
        <Box sx={{ p: 2 }}>
          <LanguageSwitcher variant="full" />
        </Box>
      </Drawer>
    </>
  );
}

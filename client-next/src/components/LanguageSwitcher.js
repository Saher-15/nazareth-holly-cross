'use client';
import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
];

export default function LanguageSwitcher({ variant = 'icon-only' }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (code) => {
    const segments = pathname.split('/');
    segments[1] = code;
    router.push(segments.join('/'));
    handleClose();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        startIcon={<LanguageIcon />}
        endIcon={variant !== 'icon-only' ? <ExpandMoreIcon /> : null}
        sx={{
          color: colors.textSecondary,
          fontFamily: 'Lato, sans-serif',
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontSize: '0.85rem',
          textTransform: 'none',
          minWidth: 0,
          px: 1,
          '&:hover': { color: colors.goldDark, backgroundColor: 'rgba(201,168,76,0.08)' },
        }}
      >
        {variant !== 'icon-only' && (
          <span style={{ marginLeft: 4 }}>{currentLang.flag} {currentLang.code.toUpperCase()}</span>
        )}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(201,168,76,0.2)',
            boxShadow: '0 8px 32px rgba(28,18,8,0.12)',
            minWidth: 180,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {languages.map((lang) => (
          <MenuItem
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            selected={lang.code === locale}
            sx={{
              py: 1,
              '&.Mui-selected': {
                backgroundColor: 'rgba(201,168,76,0.1)',
                '&:hover': { backgroundColor: 'rgba(201,168,76,0.15)' },
              },
              '&:hover': { backgroundColor: 'rgba(201,168,76,0.08)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Typography fontSize="1.2rem">{lang.flag}</Typography>
            </ListItemIcon>
            <ListItemText
              primary={lang.name}
              primaryTypographyProps={{
                fontFamily: 'Lato, sans-serif',
                fontSize: '0.875rem',
                fontWeight: lang.code === locale ? 700 : 400,
                color: lang.code === locale ? colors.goldDark : colors.textPrimary,
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

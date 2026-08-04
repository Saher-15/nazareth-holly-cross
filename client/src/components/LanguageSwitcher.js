import React, { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import LanguageIcon from '@mui/icons-material/Language';
import i18n from '../i18n';
import { gold, goldDark } from '../theme';

const languages = [
  { code: 'en', label: 'English',    native: 'English'    },
  { code: 'fr', label: 'French',     native: 'Français'   },
  { code: 'es', label: 'Spanish',    native: 'Español'    },
  { code: 'de', label: 'German',     native: 'Deutsch'    },
  { code: 'ru', label: 'Russian',    native: 'Русский'    },
  { code: 'pt', label: 'Portuguese', native: 'Português'  },
  { code: 'it', label: 'Italian',    native: 'Italiano'   },
  { code: 'pl', label: 'Polish',     native: 'Polski'     },
  { code: 'el', label: 'Greek',      native: 'Ελληνικά'   },
];

export default function LanguageSwitcher() {
  const [anchorEl, setAnchorEl] = useState(null);
  const currentLang = i18n.language?.slice(0, 2) || 'en';

  const changeLanguage = (lng) => {
    if (i18n && typeof i18n.changeLanguage === 'function') i18n.changeLanguage(lng);
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
        aria-label="Language selector"
        sx={{
          color: alpha(gold, 0.75),
          width: 36, height: 36,
          border: `1px solid ${alpha(gold, 0.2)}`,
          borderRadius: '50%',
          transition: 'all 0.3s ease',
          '&:hover': { color: gold, borderColor: alpha(gold, 0.5), backgroundColor: alpha(gold, 0.08) },
        }}
      >
        <LanguageIcon sx={{ fontSize: '1rem' }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 0,
          sx: {
            background: `linear-gradient(145deg, #1A1215 0%, #120D0F 100%)`,
            border: `1px solid ${alpha(gold, 0.2)}`,
            borderRadius: '8px',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 30px ${alpha(gold, 0.06)}`,
            mt: 1, minWidth: 180, overflow: 'hidden',
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: 0, right: 0,
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.25em', color: alpha(gold, 0.6), textTransform: 'uppercase' }}>
            Language
          </Typography>
        </Box>
        <Divider sx={{ borderColor: alpha(gold, 0.12) }} />
        {languages.map(({ code, native }) => (
          <MenuItem
            key={code}
            onClick={() => changeLanguage(code)}
            selected={currentLang === code}
            sx={{
              py: 1.2, px: 2,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': { backgroundColor: alpha(gold, 0.08) },
              '&.Mui-selected': { backgroundColor: alpha(gold, 0.12), '&:hover': { backgroundColor: alpha(gold, 0.16) } },
            }}
          >
            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', fontWeight: 300, color: currentLang === code ? gold : alpha(goldDark, 0.7) }}>
              {native}
            </Typography>
            {currentLang === code && (
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: gold, boxShadow: `0 0 6px ${gold}` }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

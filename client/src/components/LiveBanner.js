import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import { gold, goldDark, crimson } from '../theme';
import api from '../api';

const UPCOMING_EVENTS = [
  { label: 'Sunday Mass – Annunciation Church',  datetime: '2026-03-22T10:00:00', durationMinutes: 90  },
  { label: 'Palm Sunday Celebration',             datetime: '2026-03-29T09:30:00', durationMinutes: 120 },
  { label: 'Good Friday Service',                 datetime: '2026-04-03T18:00:00', durationMinutes: 120 },
  { label: 'Easter Vigil Mass',                   datetime: '2026-04-04T20:00:00', durationMinutes: 150 },
  { label: 'Easter Sunday Celebration',           datetime: '2026-04-05T09:00:00', durationMinutes: 90  },
  { label: 'Christmas Eve Mass',                  datetime: '2026-12-24T22:00:00', durationMinutes: 90  },
  { label: 'Christmas Day Celebration',           datetime: '2026-12-25T10:00:00', durationMinutes: 90  },
];

function getActiveEvent() {
  const now = new Date();
  return UPCOMING_EVENTS.find(e => {
    const start = new Date(e.datetime);
    const end   = new Date(start.getTime() + e.durationMinutes * 60000);
    const hoursToStart = (start - now) / 3600000;
    return (now >= start && now <= end) || (hoursToStart > 0 && hoursToStart <= 24);
  });
}

export default function LiveBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('liveBannerDismissed') === '1'
  );
  const [apiRoomId, setApiRoomId] = useState(null);

  // Try to fetch live room from API
  useEffect(() => {
    api.get('/live/room_id')
      .then(({ data }) => { if (data?.roomId) setApiRoomId(data.roomId); })
      .catch(() => {}); // silently ignore
  }, []);

  const active = getActiveEvent();
  const isApiLive = Boolean(apiRoomId);

  // Show if API has a live room OR a scheduled event is active/upcoming
  if ((!active && !isApiLive) || dismissed) return null;

  const now      = new Date();
  const isLive   = isApiLive || (active && now >= new Date(active.datetime));
  const label    = isApiLive ? 'Sacred Event from Nazareth' : active?.label || '';
  const hoursLeft = active ? Math.ceil((new Date(active.datetime) - now) / 3600000) : 0;

  const dismiss = () => {
    sessionStorage.setItem('liveBannerDismissed', '1');
    setDismissed(true);
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 2, md: 4 }, py: 0, height: 44,
        background: isLive
          ? `linear-gradient(90deg, ${alpha(crimson, 0.97)}, ${alpha('#5c0000', 0.95)}, ${alpha(crimson, 0.97)})`
          : `linear-gradient(90deg, #E8D4A0, #DFC88A, #E8D4A0)`,
        borderBottom: `1px solid ${alpha(isLive ? crimson : goldDark, 0.35)}`,
        backgroundSize: '200% 100%',
        animation: 'bannerShimmer 4s linear infinite',
        '@keyframes bannerShimmer': { '0%': { backgroundPosition: '0% 0%' }, '100%': { backgroundPosition: '200% 0%' } },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          backgroundColor: isLive ? '#FF6B6B' : goldDark,
          boxShadow: `0 0 8px ${isLive ? '#FF6B6B' : gold}`,
          animation: 'livePulse 1.4s ease-in-out infinite',
          '@keyframes livePulse': {
            '0%,100%': { opacity: 1, transform: 'scale(1)' },
            '50%':     { opacity: 0.4, transform: 'scale(0.7)' },
          },
        }} />
        <LiveTvIcon sx={{ fontSize: '0.95rem', color: isLive ? '#FF6B6B' : goldDark, flexShrink: 0 }} />
        <Typography sx={{
          fontFamily: '"Cinzel", serif', fontSize: { xs: '0.62rem', sm: '0.72rem' },
          letterSpacing: '0.1em', fontWeight: 600,
          color: isLive ? '#FFD5D5' : goldDark,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {isLive ? `LIVE NOW — ${label}` : `UPCOMING IN ${hoursLeft}H — ${label}`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
        <Box
          component={Link}
          to="/live"
          sx={{
            fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.14em',
            color: isLive ? '#FF6B6B' : goldDark,
            textDecoration: 'none',
            border: `1px solid ${alpha(isLive ? '#FF6B6B' : goldDark, 0.45)}`,
            borderRadius: '4px', px: 1.5, py: 0.4,
            transition: 'all 0.2s ease', whiteSpace: 'nowrap',
            '&:hover': { background: alpha(isLive ? crimson : goldDark, 0.15) },
          }}
        >
          {isLive ? 'Join →' : 'Watch →'}
        </Box>
        <IconButton
          size="small" onClick={dismiss} aria-label="Dismiss"
          sx={{
            color: isLive ? alpha('#FFD5D5', 0.7) : alpha(goldDark, 0.65),
            width: 26, height: 26,
            '&:hover': { color: isLive ? '#FFD5D5' : goldDark, background: 'transparent' },
          }}
        >
          <CloseIcon sx={{ fontSize: '0.85rem' }} />
        </IconButton>
      </Box>
    </Box>
  );
}

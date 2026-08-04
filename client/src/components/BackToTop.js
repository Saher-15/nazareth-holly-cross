import { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Zoom from '@mui/material/Zoom';
import { alpha } from '@mui/material/styles';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { gold, goldDark, goldGradient, darkBg } from '../theme';

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Zoom in={show}>
      <Tooltip title="Back to top" placement="left">
        <IconButton
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 88 },
            right: { xs: 16, md: 28 },
            zIndex: 1400,
            width: 46, height: 46,
            background: goldGradient,
            color: darkBg,
            boxShadow: `0 4px 24px ${alpha(gold, 0.5)}`,
            border: `1px solid ${alpha(goldDark, 0.25)}`,
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: `0 8px 36px ${alpha(gold, 0.7)}`,
            },
          }}
        >
          <KeyboardArrowUpIcon sx={{ fontSize: '1.4rem' }} />
        </IconButton>
      </Tooltip>
    </Zoom>
  );
}

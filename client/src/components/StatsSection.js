import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PublicIcon from '@mui/icons-material/Public';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import { gold, goldLight, goldDark, crimson, goldGradientText, glassCard } from '../theme';

const STATS = [
  { Icon: LocalFireDepartmentIcon, value: 3000, suffix: '+', label: 'Candles Lit Worldwide', color: crimson },
  { Icon: FavoriteIcon,            value: 1500, suffix: '+', label: 'Prayers Shared',        color: '#E91E63' },
  { Icon: PublicIcon,              value: 45,   suffix: '+', label: 'Countries Reached',     color: gold },
  { Icon: HistoryEduIcon,          value: 130,  suffix: '+', label: 'Years of Faith',        color: goldLight },
];

function useCountUp(target, active, duration = 1800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

function StatCard({ Icon, value, suffix, label, color, active, delay }) {
  const count = useCountUp(value, active);

  return (
    <Box
      sx={{
        ...glassCard,
        p: { xs: 3, md: 4 },
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s ease',
        animation: active ? `statIn 0.6s cubic-bezier(0.4,0,0.2,1) ${delay}ms both` : 'none',
        '@keyframes statIn': {
          from: { opacity: 0, transform: 'translateY(24px)' },
          to:   { opacity: 1, transform: 'none' },
        },
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0,
          height: '3px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: 0.8,
        },
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: `0 20px 48px ${alpha('#000', 0.55)}, 0 0 28px ${alpha(color, 0.12)}`,
          border: `1px solid ${alpha(color, 0.35)}`,
        },
      }}
    >
      {/* Glow orb */}
      <Box sx={{
        position: 'absolute', top: -30, right: -30,
        width: 100, height: 100, borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(color, 0.12)} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <Box sx={{
        width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.06)} 100%)`,
        border: `1px solid ${alpha(color, 0.3)}`,
      }}>
        <Icon sx={{ fontSize: '1.6rem', color }} />
      </Box>

      <Typography sx={{
        fontFamily: '"Cinzel", serif', fontWeight: 900,
        fontSize: { xs: '2.4rem', md: '3rem' },
        lineHeight: 1, mb: 0.5,
        ...goldGradientText,
        filter: `drop-shadow(0 2px 12px ${alpha(gold, 0.3)})`,
      }}>
        {count.toLocaleString()}{suffix}
      </Typography>

      <Typography sx={{
        fontFamily: '"Lato", sans-serif', fontWeight: 300,
        fontSize: '0.82rem', letterSpacing: '0.12em',
        color: alpha(goldLight, 0.55), textTransform: 'uppercase',
      }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function StatsSection() {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.unobserve(el); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      component="section"
      sx={{
        py: { xs: 8, md: 12 },
        position: 'relative',
        '&::before': {
          content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 50%, ${alpha(gold, 0.04)} 0%, transparent 70%)`,
        },
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 80, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)})` }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.4em', color: alpha(gold, 0.65), textTransform: 'uppercase' }}>
              Our Reach
            </Typography>
            <Box sx={{ flex: 1, maxWidth: 80, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.45)}, transparent)` }} />
          </Box>
          <Typography variant="h2" sx={{
            fontFamily: '"Cinzel", serif', fontWeight: 700,
            fontSize: { xs: '1.6rem', md: '2.2rem' },
            ...goldGradientText,
          }}>
            Faith Without Borders
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {STATS.map(({ Icon, value, suffix, label, color }, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={label}>
              <StatCard Icon={Icon} value={value} suffix={suffix} label={label} color={color} active={active} delay={i * 120} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PrayerIcon from '@mui/icons-material/SelfImprovement';
import HeroSection from '../components/HeroSection';
import CardItem from '../components/CardItem';
import api from '../api';
import { gold, goldDark, crimson, goldGradient, goldGradientText, textSecondary } from '../theme';

// ─── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ overline, title, subtitle }) {
  return (
    <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
      <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 1.5 }}>
        {overline}
      </Typography>
      <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.6rem' }, ...goldGradientText, mb: 2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: textSecondary, fontSize: { xs: '0.9rem', md: '1rem' }, maxWidth: 540, mx: 'auto' }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 3 }}>
        <Box sx={{ height: '1px', width: 60, background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.6)})` }} />
        <Box sx={{ fontSize: '0.7rem', color: alpha(crimson, 0.6) }}>✝</Box>
        <Box sx={{ height: '1px', width: 60, background: `linear-gradient(90deg, ${alpha(gold, 0.6)}, transparent)` }} />
      </Box>
    </Box>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <StorefrontOutlinedIcon sx={{ fontSize: '2rem', color: gold }} />,
    title: 'Sacred Shop',
    desc: 'Authentic olive wood crosses, holy water, and handcrafted gifts straight from Nazareth.',
    link: '/shop',
  },
  {
    icon: <LocalFireDepartmentIcon sx={{ fontSize: '2rem', color: crimson }} />,
    title: 'Candle Prayer',
    desc: 'Light a candle in the Basilica of the Annunciation or the Greek Orthodox Church — in your name.',
    link: '/candle',
  },
  {
    icon: <LiveTvIcon sx={{ fontSize: '2rem', color: gold }} />,
    title: 'Live Stream',
    desc: 'Join sacred events, masses, and prayer sessions broadcast live from the Holy Land.',
    link: '/live',
  },
];

// ─── Gallery tiles ────────────────────────────────────────────────────────────
const GALLERY_TILES = [
  { label: 'Latin Church',  path: '/gallery/latin',     img: '/images/latin/latin1.jpg' },
  { label: "Mary's Well",   path: '/gallery/maryswell',  img: '/images/mary/mary1.jpg' },
  { label: 'Old City',      path: '/gallery/old-city',   img: '/images/old/old1.jpg' },
  { label: 'Nazareth',      path: '/gallery/nazareth',   img: '/images/nazareth/nazareth1.webp' },
];

export default function Home() {
  const [products,  setProducts]  = useState([]);
  const [loadingPr, setLoadingPr] = useState(true);

  useEffect(() => {
    api.get('/product/getNProducts?page=1&size=6')
      .then(({ data }) => setProducts(Array.isArray(data) ? data : data.data || data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingPr(false));
  }, []);

  return (
    <Box>
      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#F7F2E8' }}>
        <Container maxWidth="lg">
          <SectionHeader
            overline="What We Offer"
            title="Connect with the Holy Land"
            subtitle="Three sacred ways to bring Nazareth into your heart, no matter where you are in the world."
          />
          <Grid container spacing={4}>
            {FEATURES.map((f) => (
              <Grid item xs={12} md={4} key={f.title}>
                <Box
                  sx={{
                    textAlign: 'center', p: { xs: 3, md: 4 },
                    backgroundColor: '#FFFFFF',
                    border: `1px solid ${alpha(gold, 0.2)}`,
                    borderRadius: '12px',
                    boxShadow: `0 2px 16px ${alpha('#8A6107', 0.06)}`,
                    height: '100%',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: `0 8px 32px ${alpha('#8A6107', 0.14)}`,
                      transform: 'translateY(-6px)',
                      borderColor: alpha(gold, 0.4),
                    },
                  }}
                >
                  <Box sx={{ mb: 2.5 }}>{f.icon}</Box>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1rem', color: '#1C1208', mb: 1.5, letterSpacing: '0.05em' }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary, lineHeight: 1.85, mb: 3 }}>
                    {f.desc}
                  </Typography>
                  <Button
                    component={Link}
                    to={f.link}
                    variant="outlined"
                    size="small"
                    sx={{
                      fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.14em',
                      borderColor: alpha(gold, 0.45), color: goldDark,
                      '&:hover': { borderColor: gold, background: alpha(gold, 0.06) },
                    }}
                  >
                    Learn More
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* About preview */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#EDE6D4' }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(goldDark, 0.7), textTransform: 'uppercase', mb: 1.5 }}>
                About Us
              </Typography>
              <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.4rem' }, ...goldGradientText, mb: 3 }}>
                The City Where Faith Was Born
              </Typography>
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.92rem', color: textSecondary, lineHeight: 1.9, mb: 2 }}>
                Nazareth — where the Angel Gabriel appeared to Mary, where Jesus grew up, and where the seeds of Christianity were planted. We bring this sacred city to you.
              </Typography>
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '0.95rem', color: alpha(goldDark, 0.8), mb: 4, pl: 2, borderLeft: `3px solid ${alpha(gold, 0.4)}` }}>
                "He shall be called a Nazarene." — Matthew 2:23
              </Typography>
              <Button
                component={Link}
                to="/about"
                variant="contained"
                sx={{
                  background: goldGradient, color: '#1C1208',
                  '&:hover': { boxShadow: `0 8px 24px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
                }}
              >
                Our Story
              </Button>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: { xs: 280, md: 400 },
                  backgroundColor: '#1C0E06',
                  borderRadius: '12px',
                  border: `1px solid ${alpha(gold, 0.2)}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src="/images/nazareth/nazareth1.webp"
                  alt="Nazareth"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <Box sx={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: alpha('#1C0E06', 0.4),
                }}>
                  <Box sx={{ fontSize: '4rem', mb: 2 }}>✝</Box>
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1rem', color: gold, letterSpacing: '0.2em' }}>
                    NAZARETH
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Featured Products */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#F7F2E8' }}>
        <Container maxWidth="lg">
          <SectionHeader
            overline="Sacred Shop"
            title="Featured Products"
            subtitle="Handcrafted gifts and holy items from the heart of Nazareth."
          />
          <Grid container spacing={3}>
            {loadingPr
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Grid item xs={12} sm={6} md={4} key={i}>
                    <Skeleton variant="rectangular" height={360} sx={{ borderRadius: '12px' }} />
                  </Grid>
                ))
              : products.slice(0, 6).map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p._id}>
                    <CardItem product={p} />
                  </Grid>
                ))
            }
          </Grid>
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <Button
              component={Link}
              to="/shop"
              variant="contained"
              size="large"
              sx={{ background: goldGradient, color: '#1C1208', px: 6, '&:hover': { boxShadow: `0 8px 32px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' } }}
            >
              View All Products
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Gallery Teaser */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: '#EDE6D4' }}>
        <Container maxWidth="lg">
          <SectionHeader overline="Gallery" title="Explore Holy Sites" subtitle="Walk through Nazareth's sacred landmarks from anywhere in the world." />
          <Grid container spacing={2}>
            {GALLERY_TILES.map((tile) => (
              <Grid item xs={6} md={3} key={tile.path}>
                <Box
                  component={Link}
                  to={tile.path}
                  sx={{
                    display: 'block', position: 'relative', aspectRatio: '1',
                    borderRadius: '8px', overflow: 'hidden', textDecoration: 'none',
                    '&:hover .tile-img': { transform: 'scale(1.08)' },
                    '&:hover .tile-overlay': { opacity: 1 },
                  }}
                >
                  <Box
                    className="tile-img"
                    sx={{
                      position: 'absolute', inset: 0,
                      backgroundColor: '#1C0E06',
                      backgroundImage: `url(${tile.img})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      transition: 'transform 0.5s ease',
                      filter: 'brightness(0.7)',
                    }}
                  />
                  <Box
                    className="tile-overlay"
                    sx={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(28,14,6,0.85), transparent 60%)',
                      display: 'flex', alignItems: 'flex-end', p: 2, opacity: 0.85,
                      transition: 'opacity 0.3s ease',
                    }}
                  >
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', fontWeight: 700, color: gold, letterSpacing: '0.08em' }}>
                      {tile.label}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Candle CTA */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
          textAlign: 'center', px: 3,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <LocalFireDepartmentIcon sx={{ fontSize: '3rem', color: crimson, filter: `drop-shadow(0 0 20px ${alpha(crimson, 0.7)})` }} />
        </Box>
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
          Prayer From Afar
        </Typography>
        <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.8rem' }, ...goldGradientText, mb: 2 }}>
          Light a Candle from Anywhere
        </Typography>
        <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: { xs: '0.9rem', md: '1.1rem' }, color: alpha('#F7F2E8', 0.65), mb: 5, maxWidth: 560, mx: 'auto' }}>
          We personally light a candle for you in the Basilica of the Annunciation and send you a video — your prayer, delivered from the Holy Land.
        </Typography>
        <Button
          component={Link}
          to="/candle"
          variant="contained"
          size="large"
          startIcon={<LocalFireDepartmentIcon />}
          sx={{
            background: `linear-gradient(135deg, ${crimson} 0%, #C02020 100%)`,
            color: '#FFFFFF',
            py: 1.8, px: 5,
            boxShadow: `0 4px 24px ${alpha(crimson, 0.45)}`,
            '&:hover': { boxShadow: `0 8px 36px ${alpha(crimson, 0.6)}`, transform: 'translateY(-3px)' },
          }}
        >
          Light a Candle — $7
        </Button>
      </Box>
    </Box>
  );
}

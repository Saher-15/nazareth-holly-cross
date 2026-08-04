'use client';
import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Typography, Button, Stack } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import HeroSection from '@/components/HeroSection';
import ProductCard from '@/components/ProductCard';
import api from '@/lib/api';
import { colors } from '@/lib/theme';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';

const SectionTitle = ({ text, subtitle }) => (
  <Box sx={{ textAlign: 'center', mb: 5 }}>
    <Typography component="h2" sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, color: colors.textPrimary, mb: 1 }}>
      {text}
    </Typography>
    {subtitle && (
      <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: colors.textSecondary, fontSize: '1rem', maxWidth: 480, mx: 'auto' }}>
        {subtitle}
      </Typography>
    )}
    <Box sx={{ width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', mx: 'auto', mt: 2 }} />
  </Box>
);

export default function HomePage() {
  const { locale } = useParams();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/product/getNProducts?page=1&size=6')
      .then(r => setProducts(r.data?.data || []))
      .catch(() => {});
  }, []);

  const features = [
    { icon: '✝', title: 'Sacred Candle Prayers', desc: 'Light a candle in the holy churches of Nazareth. We deliver your prayer in person and send you a video.', href: `/${locale}/candle`, color: colors.crimson },
    { icon: '🏛', title: 'Holy Site Products', desc: 'Authentic sacred goods from the land where Jesus walked — olive wood crosses, holy water, and more.', href: `/${locale}/shop`, color: colors.goldDark },
    { icon: '📺', title: 'Live from Nazareth', desc: "Join us live for special ceremonies, masses, and events streamed directly from Nazareth's holy sites.", href: `/${locale}/live`, color: '#1565C0' },
  ];

  const galleries = [
    { title: 'Latin Church', href: `/${locale}/gallery/latin`, emoji: '⛪' },
    { title: 'Greek Church', href: `/${locale}/gallery/greek`, emoji: '🏛' },
    { title: "Mary's Well", href: `/${locale}/gallery/maryswell`, emoji: '💧' },
    { title: 'Old City', href: `/${locale}/gallery/old-city`, emoji: '🕌' },
  ];

  return (
    <Box sx={{ backgroundColor: colors.background }}>
      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: colors.surface }}>
        <Container maxWidth="lg">
          <SectionTitle text="What's New" subtitle="Biblical faith, delivered to your door" />
          <Grid container spacing={3}>
            {features.map((f) => (
              <Grid xs={12} md={4} key={f.title} sx={{ display: 'flex' }}>
                <Box
                  component={Link}
                  href={f.href}
                  sx={{
                    display: 'block', textDecoration: 'none', p: 4, borderRadius: 2,
                    backgroundColor: '#FFFFFF', border: '1px solid rgba(201,168,76,0.15)',
                    width: '100%', transition: 'all 0.3s ease',
                    '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 12px 40px rgba(28,18,8,0.1)', borderColor: 'rgba(201,168,76,0.4)' },
                  }}
                >
                  <Box sx={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', mb: 2.5 }}>
                    {f.icon}
                  </Box>
                  <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary, mb: 1.5 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontFamily: 'Lato, sans-serif', color: colors.textSecondary, fontSize: '0.88rem', lineHeight: 1.7 }}>
                    {f.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* About Preview */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: colors.background }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid xs={12} md={6}>
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', boxShadow: '0 16px 60px rgba(28,18,8,0.15)' }}>
                <Box sx={{ aspectRatio: '4/3', background: 'linear-gradient(160deg, #2C1810 0%, #8A6107 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8rem', color: 'rgba(201,168,76,0.3)' }}>
                  ✝
                </Box>
                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 3, background: 'linear-gradient(transparent, rgba(28,18,8,0.8))' }}>
                  <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.9)', fontSize: '0.9rem' }}>
                    "Can anything good come out of Nazareth?" — John 1:46
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid xs={12} md={6}>
              <Typography sx={{ fontFamily: 'Lato, sans-serif', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: colors.gold, mb: 1.5 }}>
                Our Story
              </Typography>
              <Typography component="h2" sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.4rem', md: '1.8rem' }, color: colors.textPrimary, mb: 2.5, lineHeight: 1.3 }}>
                The Heart of Christian Faith
              </Typography>
              <Typography sx={{ color: colors.textSecondary, lineHeight: 1.85, mb: 2, fontSize: '0.92rem' }}>
                Not everyone can physically visit Nazareth, the city where Jesus took His first steps. We understand that — and so we bring Nazareth to you.
              </Typography>
              <Typography sx={{ color: colors.textSecondary, lineHeight: 1.85, mb: 3, fontSize: '0.92rem' }}>
                Through our ministry, you can light a candle in our sacred churches, purchase authentic goods from Nazareth, and connect with the living faith of this holy city — all from anywhere in the world.
              </Typography>
              <Button
                component={Link}
                href={`/${locale}/contact`}
                variant="outlined"
                sx={{ borderColor: colors.gold, color: colors.goldDark, fontFamily: 'Cinzel, serif', fontSize: '0.78rem', letterSpacing: '0.1em', px: 3, '&:hover': { backgroundColor: 'rgba(201,168,76,0.08)' } }}
              >
                Learn More
              </Button>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Featured Products */}
      {products.length > 0 && (
        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: colors.surface }}>
          <Container maxWidth="xl">
            <SectionTitle text="Sacred Shop" subtitle="Authentic goods from the Holy Land" />
            <Grid container spacing={2.5}>
              {products.map((product) => (
                <Grid xs={6} sm={4} md={3} lg={2} key={product._id}>
                  <ProductCard product={product} />
                </Grid>
              ))}
            </Grid>
            <Box sx={{ textAlign: 'center', mt: 5 }}>
              <Button
                component={Link}
                href={`/${locale}/shop`}
                variant="contained"
                size="large"
                startIcon={<ShoppingBagIcon />}
                sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif', px: 5, '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' } }}
              >
                View All Products
              </Button>
            </Box>
          </Container>
        </Box>
      )}

      {/* Gallery Teaser */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: colors.background }}>
        <Container maxWidth="lg">
          <SectionTitle text="Holy Sites Gallery" subtitle="Walk through Nazareth with us" />
          <Grid container spacing={2}>
            {galleries.map((g, i) => (
              <Grid xs={6} md={3} key={g.title}>
                <Box
                  component={Link}
                  href={g.href}
                  sx={{
                    display: 'block', textDecoration: 'none', borderRadius: 2, overflow: 'hidden',
                    position: 'relative', aspectRatio: '1',
                    background: `linear-gradient(160deg, ${['#2C1810','#1A1A2C','#0D1A12','#1A1209'][i]} 0%, #C9A84C15 100%)`,
                    border: '1px solid rgba(201,168,76,0.15)', transition: 'all 0.3s ease',
                    '&:hover': { transform: 'scale(1.02)', boxShadow: '0 8px 32px rgba(28,18,8,0.15)', borderColor: 'rgba(201,168,76,0.4)' },
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, minHeight: 150 }}>
                    <Typography sx={{ fontSize: '3rem', mb: 1.5 }}>{g.emoji}</Typography>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.85rem', color: '#F7F2E8', textAlign: 'center', letterSpacing: '0.05em' }}>
                      {g.title}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Candle CTA */}
      <Box sx={{ py: { xs: 10, md: 16 }, background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 100%)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Typography sx={{ fontSize: '4rem', mb: 2, animation: 'flicker 3s ease infinite', '@keyframes flicker': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.85 } } }}>
            🕯
          </Typography>
          <Typography component="h2" sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.5rem', md: '2.2rem' }, color: '#F7F2E8', mb: 2 }}>
            Light a Candle from Anywhere in the World
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: { xs: '0.95rem', md: '1.1rem' }, mb: 4, maxWidth: 500, mx: 'auto', lineHeight: 1.7 }}>
            Your prayer, carried in person to the sacred churches of Nazareth. We send you a video of your candle being lit.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              component={Link}
              href={`/${locale}/candle`}
              variant="contained"
              size="large"
              startIcon={<LocalFireDepartmentIcon />}
              sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif', px: 5, py: 1.75, fontSize: '0.9rem', boxShadow: '0 4px 24px rgba(201,168,76,0.4)', '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' } }}
            >
              Light a Candle — $7
            </Button>
            <Button
              component={Link}
              href={`/${locale}/donation`}
              variant="outlined"
              size="large"
              sx={{ borderColor: 'rgba(201,168,76,0.5)', color: '#C9A84C', fontFamily: 'Cinzel, serif', px: 5, py: 1.75, fontSize: '0.9rem', '&:hover': { backgroundColor: 'rgba(201,168,76,0.1)', borderColor: '#C9A84C' } }}
            >
              Make a Donation
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

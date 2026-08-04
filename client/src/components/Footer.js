import React from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import { FaRegEnvelope, FaLinkedin, FaInstagram, FaFacebook, FaYoutube } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { gold, goldDark, crimson, textSecondary, textMuted } from '../theme';

const socialLinks = [
  { icon: FaRegEnvelope, href: 'mailto:nazarethholycross@gmail.com',                         label: 'footer.email',            color: gold },
  { icon: FaInstagram,   href: 'https://www.instagram.com/nazareth_holy_cross/',             label: 'footer.followInstagram',  color: '#E4405F' },
  { icon: FaFacebook,    href: 'https://www.facebook.com/profile.php?id=61566447860803',     label: 'footer.followFacebook',   color: '#1877F2' },
  { icon: FaYoutube,     href: 'https://www.youtube.com/@nazarethholycross',                 label: 'footer.subscribeYoutube', color: '#FF0000' },
];

const creditLinks = [
  { href: 'https://www.linkedin.com/in/saher-saadi-a637b11b5/', label: 'footer.creditLink1' },
  { href: 'http://linkedin.com/in/haythamt95',                  label: 'footer.creditLink2' },
];

function SectionLabel({ children }) {
  return (
    <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 28, height: '2px', background: `linear-gradient(90deg, ${gold}, transparent)` }} />
      <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.62rem', letterSpacing: '0.28em', color: gold, textTransform: 'uppercase' }}>
        {children}
      </Typography>
    </Box>
  );
}

export default function Footer() {
  const { t } = useTranslation();

  return (
    <Box
      component="footer"
      sx={{
        background: `linear-gradient(180deg, #E8DFC8 0%, #DDD5BC 100%)`,
        borderTop: `1px solid ${alpha(gold, 0.25)}`,
        position: 'relative',
        overflow: 'hidden',
        mt: 'auto',
        /* glowing gold line across the very top */
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${alpha(gold, 0.8)} 30%, ${gold} 50%, ${alpha(gold, 0.8)} 70%, transparent 100%)`,
          boxShadow: `0 0 12px 2px ${alpha(gold, 0.25)}`,
        },
      }}
    >
      {/* Main footer content */}
      <Container maxWidth="lg" sx={{ pt: { xs: 7, md: 9 }, pb: 3 }}>
        <Grid container spacing={5}>

          {/* ── About ── */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            {/* Logo + brand */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <i className="fas fa-cross" style={{ color: crimson, fontSize: '1.3rem', filter: `drop-shadow(0 0 8px ${alpha(crimson, 0.5)})` }} />
              <Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.14em', color: '#1C1208', lineHeight: 1.1 }}>NAZARETH</Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 400, fontSize: '0.6rem', letterSpacing: '0.22em', color: alpha(gold, 0.75), lineHeight: 1 }}>HOLY CROSS</Box>
              </Box>
            </Box>

            <SectionLabel>{t('footer.aboutUs')}</SectionLabel>

            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.85rem', color: textSecondary, lineHeight: 1.9, mb: 2.5 }}>
              {t('footer.aboutUsDescription')}
            </Typography>

            <Box
              component={Link} to="/about"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                fontFamily: '"Cinzel", serif', fontSize: '0.66rem',
                letterSpacing: '0.18em', color: goldDark, textDecoration: 'none',
                textTransform: 'uppercase',
                borderBottom: `1px solid ${alpha(gold, 0.45)}`, pb: '2px',
                transition: 'all 0.25s ease',
                '&:hover': { color: gold, borderBottomColor: gold },
              }}
            >
              {t('footer.learnMore')} →
            </Box>
          </Grid>

          {/* ── Contact / Social ── */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <SectionLabel>{t('footer.contactUs')}</SectionLabel>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
              {socialLinks.map(({ icon: Icon, href, label, color }) => (
                <Box
                  key={href}
                  component="a" href={href}
                  target={href.startsWith('mailto') ? undefined : '_blank'}
                  rel={href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    color: textSecondary, textDecoration: 'none',
                    fontSize: '0.82rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: goldDark, transform: 'translateX(5px)' },
                    '&:hover .social-icon-wrap': { borderColor: color, background: alpha(color, 0.1) },
                  }}
                >
                  <Box
                    className="social-icon-wrap"
                    sx={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: `1px solid ${alpha(color, 0.35)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <Icon size={14} color={color} />
                  </Box>
                  {t(label)}
                </Box>
              ))}
            </Box>
          </Grid>

          {/* ── Credits + Logo ── */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <SectionLabel>{t('footer.credits')}</SectionLabel>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8, mb: 4 }}>
              {creditLinks.map(({ href, label }) => (
                <Box
                  key={href}
                  component="a" href={href}
                  target="_blank" rel="noopener noreferrer"
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    color: textSecondary, textDecoration: 'none',
                    fontSize: '0.82rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: goldDark, transform: 'translateX(5px)' },
                  }}
                >
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${alpha('#0A66C2', 0.35)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FaLinkedin size={14} color="#0A66C2" />
                  </Box>
                  {t(label)}
                </Box>
              ))}
            </Box>

            {/* Logo */}
            <Box
              component="img" src="/images/logo.webp" alt="Nazareth Holy Cross"
              sx={{
                width: 72, height: 72, objectFit: 'contain',
                filter: `drop-shadow(0 0 10px ${alpha(gold, 0.3)})`,
                opacity: 1,
                transition: 'all 0.3s ease',
                '&:hover': { filter: `drop-shadow(0 0 18px ${alpha(gold, 0.55)})` },
              }}
            />
          </Grid>
        </Grid>

        {/* ── Divider ── */}
        <Divider
          sx={{ my: 4, borderColor: 'transparent', '&::before, &::after': { borderColor: alpha(gold, 0.2) } }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.4) }} />
            <i className="fas fa-cross" style={{ color: alpha(crimson, 0.55), fontSize: '0.7rem' }} />
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.4) }} />
          </Box>
        </Divider>

        {/* ── Copyright ── */}
        <Typography align="center" sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.72rem', color: textMuted, letterSpacing: '0.07em' }}>
          {t('footer.copyright')}
        </Typography>
      </Container>
    </Box>
  );
}

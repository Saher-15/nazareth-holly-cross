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
import { gold, goldLight, crimson } from '../theme';

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
        background: `linear-gradient(180deg, #130d18 0%, #080510 100%)`,
        borderTop: `1px solid ${alpha(gold, 0.15)}`,
        position: 'relative',
        overflow: 'hidden',
        mt: 'auto',
        /* glowing gold line across the very top */
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${alpha(gold, 0.8)} 30%, ${gold} 50%, ${alpha(gold, 0.8)} 70%, transparent 100%)`,
          boxShadow: `0 0 18px 4px ${alpha(gold, 0.35)}`,
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
              <i className="fas fa-cross" style={{ color: crimson, fontSize: '1.3rem', filter: `drop-shadow(0 0 10px ${alpha(crimson, 0.7)})` }} />
              <Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.14em', color: goldLight, lineHeight: 1.1 }}>NAZARETH</Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 400, fontSize: '0.6rem', letterSpacing: '0.22em', color: alpha(gold, 0.6), lineHeight: 1 }}>HOLY CROSS</Box>
              </Box>
            </Box>

            <SectionLabel>{t('footer.aboutUs')}</SectionLabel>

            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.85rem', color: alpha(goldLight, 0.55), lineHeight: 1.9, mb: 2.5 }}>
              {t('footer.aboutUsDescription')}
            </Typography>

            <Box
              component={Link} to="/about"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.8,
                fontFamily: '"Cinzel", serif', fontSize: '0.66rem',
                letterSpacing: '0.18em', color: gold, textDecoration: 'none',
                textTransform: 'uppercase',
                borderBottom: `1px solid ${alpha(gold, 0.35)}`, pb: '2px',
                transition: 'all 0.25s ease',
                '&:hover': { color: goldLight, borderBottomColor: goldLight },
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
                    color: alpha(goldLight, 0.58), textDecoration: 'none',
                    fontSize: '0.82rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: goldLight, transform: 'translateX(5px)' },
                    '&:hover .social-icon-wrap': { borderColor: color, background: alpha(color, 0.12) },
                  }}
                >
                  <Box
                    className="social-icon-wrap"
                    sx={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: `1px solid ${alpha(color, 0.28)}`,
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
                    color: alpha(goldLight, 0.55), textDecoration: 'none',
                    fontSize: '0.82rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: goldLight, transform: 'translateX(5px)' },
                  }}
                >
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${alpha('#0A66C2', 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                filter: `drop-shadow(0 0 14px ${alpha(gold, 0.4)})`,
                opacity: 0.8,
                transition: 'all 0.3s ease',
                '&:hover': { opacity: 1, filter: `drop-shadow(0 0 22px ${alpha(gold, 0.65)})` },
              }}
            />
          </Grid>
        </Grid>

        {/* ── Divider ── */}
        <Divider
          sx={{ my: 4, borderColor: 'transparent', '&::before, &::after': { borderColor: alpha(gold, 0.1) } }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.35) }} />
            <i className="fas fa-cross" style={{ color: alpha(crimson, 0.5), fontSize: '0.7rem' }} />
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.35) }} />
          </Box>
        </Divider>

        {/* ── Copyright ── */}
        <Typography align="center" sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.72rem', color: alpha(goldLight, 0.28), letterSpacing: '0.07em' }}>
          {t('footer.copyright')}
        </Typography>
      </Container>
    </Box>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import { FaRegEnvelope, FaLinkedin, FaInstagram, FaFacebook, FaYoutube, FaMapMarkerAlt, FaPhone } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { gold, goldDark, crimson, textSecondary, textMuted } from '../theme';

const socialLinks = [
  { icon: FaRegEnvelope, href: 'mailto:nazarethholycross@gmail.com',                         label: 'footer.email',            color: gold },
  { icon: FaInstagram,   href: 'https://www.instagram.com/nazareth_holy_cross/',             label: 'footer.followInstagram',  color: '#E4405F' },
  { icon: FaFacebook,    href: 'https://www.facebook.com/profile.php?id=61566447860803',     label: 'footer.followFacebook',   color: '#1877F2' },
  { icon: FaYoutube,     href: 'https://www.youtube.com/@nazarethholycross',                 label: 'footer.subscribeYoutube', color: '#FF0000' },
];

const quickLinks = [
  { label: 'Home',        path: '/' },
  { label: 'Shop',        path: '/shop' },
  { label: 'Light a Candle', path: '/candle' },
  { label: 'Prayer Wall', path: '/prayer-wall' },
  { label: 'Live Stream', path: '/live' },
  { label: 'About',       path: '/about' },
  { label: 'Contact',     path: '/contact' },
];

const holySites = [
  { label: 'Latin Church',  path: '/gallery/latin' },
  { label: 'Greek Church',  path: '/gallery/greek' },
  { label: "Mary's Well",   path: '/gallery/maryswell' },
  { label: 'Old City',      path: '/gallery/old-city' },
  { label: 'Nazareth',      path: '/gallery/nazareth' },
];

function SectionLabel({ children }) {
  return (
    <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: 24, height: '2px', background: `linear-gradient(90deg, ${gold}, transparent)` }} />
      <Typography
        sx={{
          fontFamily: '"Cinzel", serif', fontSize: '0.58rem',
          letterSpacing: '0.28em', color: gold, textTransform: 'uppercase',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function FooterLink({ to, children }) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'block',
        fontFamily: '"Lato", sans-serif',
        fontWeight: 300,
        fontSize: '0.82rem',
        color: textSecondary,
        textDecoration: 'none',
        py: 0.4,
        transition: 'all 0.25s ease',
        '&:hover': { color: goldDark, transform: 'translateX(5px)' },
      }}
    >
      {children}
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
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${alpha(gold, 0.8)} 30%, ${gold} 50%, ${alpha(gold, 0.8)} 70%, transparent 100%)`,
          boxShadow: `0 0 12px 2px ${alpha(gold, 0.25)}`,
        },
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 7, md: 9 }, pb: 3 }}>
        <Grid container spacing={5}>

          {/* Column 1: Brand + tagline + social */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box sx={{ fontSize: '1.3rem', color: crimson, filter: `drop-shadow(0 0 8px ${alpha(crimson, 0.5)})` }}>✝</Box>
              <Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.14em', color: '#1C1208', lineHeight: 1.1 }}>NAZARETH</Box>
                <Box sx={{ fontFamily: '"Cinzel", serif', fontWeight: 400, fontSize: '0.6rem', letterSpacing: '0.22em', color: alpha(gold, 0.75), lineHeight: 1 }}>HOLY CROSS</Box>
              </Box>
            </Box>

            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                fontWeight: 400, fontSize: '0.82rem', color: textSecondary,
                lineHeight: 1.9, mb: 3,
              }}
            >
              {t('footer.aboutUsDescription')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {socialLinks.map(({ icon: Icon, href, label, color }) => (
                <Box
                  key={href}
                  component="a"
                  href={href}
                  target={href.startsWith('mailto') ? undefined : '_blank'}
                  rel={href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.2,
                    color: textSecondary, textDecoration: 'none',
                    fontSize: '0.78rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                    transition: 'all 0.25s ease',
                    '&:hover': { color: goldDark, transform: 'translateX(4px)' },
                    '&:hover .social-wrap': { borderColor: color, background: alpha(color, 0.1) },
                  }}
                >
                  <Box
                    className="social-wrap"
                    sx={{
                      width: 30, height: 30, borderRadius: '50%',
                      border: `1px solid ${alpha(color, 0.35)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.25s ease',
                    }}
                  >
                    <Icon size={12} color={color} />
                  </Box>
                  {t(label)}
                </Box>
              ))}
            </Box>
          </Grid>

          {/* Column 2: Quick Links */}
          <Grid item xs={12} sm={6} md={3}>
            <SectionLabel>Quick Links</SectionLabel>
            {quickLinks.map((link) => (
              <FooterLink key={link.path} to={link.path}>{link.label}</FooterLink>
            ))}
          </Grid>

          {/* Column 3: Holy Sites */}
          <Grid item xs={12} sm={6} md={3}>
            <SectionLabel>Holy Sites</SectionLabel>
            {holySites.map((link) => (
              <FooterLink key={link.path} to={link.path}>{link.label}</FooterLink>
            ))}
          </Grid>

          {/* Column 4: Contact */}
          <Grid item xs={12} sm={6} md={3}>
            <SectionLabel>{t('footer.contactUs')}</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                <FaMapMarkerAlt size={13} color={goldDark} style={{ marginTop: 3, flexShrink: 0 }} />
                <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.82rem', color: textSecondary, lineHeight: 1.7 }}>
                  Nazareth, Israel<br />The Holy Land
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <FaRegEnvelope size={13} color={goldDark} style={{ flexShrink: 0 }} />
                <Typography
                  component="a"
                  href="mailto:nazarethholycross@gmail.com"
                  sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.82rem', color: textSecondary, textDecoration: 'none', '&:hover': { color: goldDark } }}
                >
                  nazarethholycross@gmail.com
                </Typography>
              </Box>

              {/* Credits */}
              <Box sx={{ mt: 2 }}>
                <SectionLabel>{t('footer.credits')}</SectionLabel>
                {[
                  { href: 'https://www.linkedin.com/in/saher-saadi-a637b11b5/', label: 'footer.creditLink1' },
                  { href: 'http://linkedin.com/in/haythamt95',                  label: 'footer.creditLink2' },
                ].map(({ href, label }) => (
                  <Box
                    key={href}
                    component="a"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2,
                      color: textSecondary, textDecoration: 'none',
                      fontSize: '0.78rem', fontFamily: '"Lato", sans-serif', fontWeight: 300,
                      transition: 'all 0.25s ease',
                      '&:hover': { color: goldDark, transform: 'translateX(4px)' },
                    }}
                  >
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${alpha('#0A66C2', 0.35)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FaLinkedin size={12} color="#0A66C2" />
                    </Box>
                    {t(label)}
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider
          sx={{ my: 4, borderColor: 'transparent', '&::before, &::after': { borderColor: alpha(gold, 0.2) } }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.4) }} />
            <Box sx={{ fontSize: '0.7rem', color: alpha(crimson, 0.55) }}>✝</Box>
            <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(gold, 0.4) }} />
          </Box>
        </Divider>

        <Typography
          align="center"
          sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.72rem', color: textMuted, letterSpacing: '0.07em' }}
        >
          {t('footer.copyright')}
        </Typography>
      </Container>
    </Box>
  );
}

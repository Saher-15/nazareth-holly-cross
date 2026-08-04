'use client';
import React, { useState } from 'react';
import {
  Box, Container, Typography, Grid, Dialog, IconButton, Paper,
  Chip, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { colors } from '@/lib/theme';

export default function GalleryLayout({ title, subtitle, description, photos, mapUrl }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const openLightbox = (index) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const navigate = (dir) => {
    setCurrentIndex((prev) => (prev + dir + photos.length) % photos.length);
  };

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          background: 'linear-gradient(160deg, #1C0E06, #2C1810)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Typography
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              color: '#F7F2E8',
              mb: 1,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: '#C9A84C', fontSize: '1rem', mb: 1.5 }}>
              {subtitle}
            </Typography>
          )}
          {description && (
            <Typography sx={{ color: 'rgba(247,242,232,0.7)', fontSize: '0.9rem', maxWidth: 540, mx: 'auto', lineHeight: 1.7 }}>
              {description}
            </Typography>
          )}
          <Box sx={{ width: 60, height: 3, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', mx: 'auto', mt: 2 }} />
        </Container>
      </Box>

      {/* Masonry-style Grid */}
      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
        <Grid container spacing={1.5}>
          {photos.map((photo, index) => (
            <Grid
              item
              key={photo.id || index}
              xs={6}
              sm={4}
              md={index % 5 === 0 ? 4 : 3}
              lg={index % 7 === 0 ? 3 : 2}
            >
              <Box
                onClick={() => openLightbox(index)}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  aspectRatio: index % 3 === 0 ? '3/4' : '4/3',
                  backgroundColor: colors.surface,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)',
                    boxShadow: '0 8px 32px rgba(28,18,8,0.2)',
                    zIndex: 1,
                  },
                  '&:hover .gallery-overlay': {
                    opacity: 1,
                  },
                }}
              >
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.title || `Photo ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(135deg, #2C1810 0%, #8A6107 100%)`,
                      fontSize: '3rem',
                      color: 'rgba(247,242,232,0.2)',
                    }}
                  >
                    {photo.emoji || '✝'}
                  </Box>
                )}
                {/* Hover overlay */}
                <Box
                  className="gallery-overlay"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(28,18,8,0.5)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FullscreenIcon sx={{ color: 'rgba(247,242,232,0.9)', fontSize: '2rem' }} />
                </Box>
                {photo.title && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      p: 1.5,
                      background: 'linear-gradient(transparent, rgba(28,18,8,0.7))',
                    }}
                  >
                    <Typography sx={{ color: '#F7F2E8', fontSize: '0.72rem', fontFamily: 'Lato, sans-serif' }}>
                      {photo.title}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>

        {photos.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography sx={{ fontSize: '4rem', mb: 2 }}>🏛</Typography>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: colors.textPrimary }}>
              Gallery Coming Soon
            </Typography>
            <Typography sx={{ color: colors.textMuted, mt: 1 }}>
              Beautiful photos of {title} will be added soon.
            </Typography>
          </Box>
        )}

        {/* Map */}
        {mapUrl && (
          <Box sx={{ mt: 6 }}>
            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(201,168,76,0.2)' }}>
              <iframe
                src={mapUrl}
                width="100%"
                height="350"
                style={{ border: 0, display: 'block' }}
                allowFullScreen
                loading="lazy"
                title={`${title} Map`}
              />
            </Box>
          </Box>
        )}
      </Container>

      {/* Lightbox */}
      <Dialog
        fullScreen
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        PaperProps={{ sx: { backgroundColor: 'rgba(0,0,0,0.95)' } }}
      >
        <Box
          sx={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: '#F7F2E8',
              backgroundColor: 'rgba(255,255,255,0.1)',
              zIndex: 2,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          {photos.length > 1 && (
            <>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  position: 'absolute',
                  left: 16,
                  color: '#F7F2E8',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  zIndex: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
              <IconButton
                onClick={() => navigate(1)}
                sx={{
                  position: 'absolute',
                  right: 16,
                  color: '#F7F2E8',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  zIndex: 2,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </>
          )}

          {photos[currentIndex] && (
            <Box sx={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
              {photos[currentIndex].url ? (
                <img
                  src={photos[currentIndex].url}
                  alt={photos[currentIndex].title || `Photo ${currentIndex + 1}`}
                  style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                />
              ) : (
                <Box sx={{ width: 400, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(247,242,232,0.2)', fontSize: '6rem' }}>✝</Box>
              )}
              {photos[currentIndex].title && (
                <Typography sx={{ textAlign: 'center', color: 'rgba(247,242,232,0.7)', fontSize: '0.85rem', mt: 2, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  {photos[currentIndex].title}
                </Typography>
              )}
              <Typography sx={{ textAlign: 'center', color: 'rgba(247,242,232,0.4)', fontSize: '0.72rem', mt: 1 }}>
                {currentIndex + 1} / {photos.length}
              </Typography>
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import { SiGooglemaps } from 'react-icons/si';
import { gold, goldLight, goldDark, crimson, goldGradientText } from '../theme';

export default function GalleryPageLayout({ title, subtitle, mapsUrl, images, contentSections }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleNext = useCallback(() => {
    setSelectedIdx((i) => (i + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setSelectedIdx((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const handleClose = useCallback(() => setSelectedIdx(null), []);

  useEffect(() => {
    if (selectedIdx === null) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx, handleNext, handlePrev, handleClose]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    if (touchStartX !== null) {
      const diff = touchStartX - endX;
      if (Math.abs(diff) > 50) diff > 0 ? handleNext() : handlePrev();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <Box sx={{ minHeight: '80vh', pb: { xs: 8, md: 12 } }}>
      {/* Hero Header */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 280, md: 380 },
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: { xs: 5, md: 7 },
        }}
      >
        {images[0] && (
          <Box
            component="img"
            src={images[0]}
            alt={title}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.35) saturate(0.7)',
              transform: 'scale(1.05)',
            }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, ${alpha('#000', 0.3)} 0%, ${alpha('#000', 0.7)} 100%)`,
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', px: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 40, height: 1, background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.7)})` }} />
            <Typography variant="overline" sx={{ color: alpha(gold, 0.75), letterSpacing: '0.35em', fontSize: '0.62rem', fontFamily: '"Cinzel", serif' }}>
              Nazareth
            </Typography>
            <Box sx={{ width: 40, height: 1, background: `linear-gradient(90deg, ${alpha(gold, 0.7)}, transparent)` }} />
          </Box>

          <Typography
            component="h1"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', sm: '2.4rem', md: '3rem' },
              ...goldGradientText,
              mb: 2,
            }}
          >
            {title}
          </Typography>

          {mapsUrl && (
            <Chip
              icon={<PlaceIcon sx={{ fontSize: '0.9rem !important', color: `${crimson} !important` }} />}
              label="View on Maps"
              onClick={() => window.open(mapsUrl, '_blank')}
              sx={{
                fontFamily: '"Cinzel", serif',
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                backgroundColor: alpha('#000', 0.5),
                backdropFilter: 'blur(10px)',
                color: alpha(goldLight, 0.8),
                border: `1px solid ${alpha(gold, 0.3)}`,
                cursor: 'pointer',
                '&:hover': { backgroundColor: alpha(gold, 0.12), borderColor: alpha(gold, 0.5) },
                '& .MuiChip-icon': { color: crimson },
              }}
            />
          )}
        </Box>
      </Box>

      <Container maxWidth="lg">
        {/* Content Sections */}
        {contentSections && contentSections.length > 0 && (
          <Box
            sx={{
              p: { xs: 3, md: 5 },
              mb: { xs: 5, md: 7 },
              background: `linear-gradient(145deg, ${alpha('#1A1215', 0.7)} 0%, ${alpha('#0D0810', 0.8)} 100%)`,
              border: `1px solid ${alpha(gold, 0.1)}`,
              borderRadius: '12px',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                borderRadius: '12px 12px 0 0',
                background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
              },
            }}
          >
            {contentSections.map((section, i) => (
              <Box key={i} sx={{ mb: i < contentSections.length - 1 ? 3 : 0 }}>
                {section.title && (
                  <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', color: alpha(gold, 0.8), textTransform: 'uppercase', mb: 1 }}>
                    {section.title}
                  </Typography>
                )}
                <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: { xs: '0.92rem', md: '1rem' }, color: alpha(goldLight, 0.65), lineHeight: 1.9 }}>
                  {section.text}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Gallery */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 30, height: 1, background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.5)})` }} />
          <Typography variant="overline" sx={{ color: alpha(gold, 0.65), letterSpacing: '0.3em', fontSize: '0.62rem', fontFamily: '"Cinzel", serif' }}>
            Gallery
          </Typography>
          <Box sx={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${alpha(gold, 0.2)}, transparent)` }} />
        </Box>

        <Box
          sx={{
            columns: { xs: 2, sm: 3, md: 4 },
            columnGap: 1.5,
            '& img': {
              width: '100%',
              display: 'block',
              mb: 1.5,
              borderRadius: '6px',
              cursor: 'pointer',
              border: `1px solid ${alpha(gold, 0.08)}`,
              filter: 'brightness(0.85) saturate(0.9)',
              transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
              '&:hover': {
                filter: 'brightness(1) saturate(1.1)',
                border: `1px solid ${alpha(gold, 0.35)}`,
                transform: 'scale(1.02)',
                boxShadow: `0 8px 24px ${alpha('#000', 0.5)}`,
              },
            },
          }}
        >
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={`${title} ${index + 1}`}
              onClick={() => setSelectedIdx(index)}
              loading="lazy"
            />
          ))}
        </Box>
      </Container>

      {/* Lightbox Modal */}
      <Modal
        open={selectedIdx !== null}
        onClose={handleClose}
        closeAfterTransition
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Fade in={selectedIdx !== null}>
          <Box
            sx={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              outline: 'none',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Backdrop click */}
            <Box
              onClick={handleClose}
              sx={{
                position: 'fixed',
                inset: 0,
                backgroundColor: alpha('#000', 0.92),
                zIndex: -1,
              }}
            />

            <Box
              component="img"
              src={selectedIdx !== null ? images[selectedIdx] : ''}
              alt="Enlarged view"
              sx={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '8px',
                border: `1px solid ${alpha(gold, 0.2)}`,
                display: 'block',
              }}
            />

            {/* Counter */}
            <Typography
              sx={{
                position: 'absolute',
                bottom: -32,
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                color: alpha(gold, 0.5),
              }}
            >
              {selectedIdx !== null ? selectedIdx + 1 : 0} / {images.length}
            </Typography>

            {/* Close */}
            <IconButton
              onClick={handleClose}
              sx={{
                position: 'absolute',
                top: -44,
                right: 0,
                color: alpha(goldLight, 0.7),
                '&:hover': { color: gold },
              }}
            >
              <CloseIcon />
            </IconButton>

            {/* Prev */}
            <IconButton
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              sx={{
                position: 'absolute',
                left: -52,
                top: '50%',
                transform: 'translateY(-50%)',
                color: alpha(goldLight, 0.7),
                backgroundColor: alpha('#000', 0.4),
                border: `1px solid ${alpha(gold, 0.2)}`,
                backdropFilter: 'blur(10px)',
                '&:hover': { color: gold, backgroundColor: alpha('#000', 0.6), borderColor: alpha(gold, 0.5) },
              }}
            >
              <ChevronLeftIcon />
            </IconButton>

            {/* Next */}
            <IconButton
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              sx={{
                position: 'absolute',
                right: -52,
                top: '50%',
                transform: 'translateY(-50%)',
                color: alpha(goldLight, 0.7),
                backgroundColor: alpha('#000', 0.4),
                border: `1px solid ${alpha(gold, 0.2)}`,
                backdropFilter: 'blur(10px)',
                '&:hover': { color: gold, backgroundColor: alpha('#000', 0.6), borderColor: alpha(gold, 0.5) },
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Fade>
      </Modal>
    </Box>
  );
}

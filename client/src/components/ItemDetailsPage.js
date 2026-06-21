import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { gold, goldLight, goldDark, goldGradientText } from '../theme';

const ItemDetailsPage = () => {
  const { _id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    axios
      .get(`https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/product/getNProducts?_id=${_id}`)
      .then(res => { setItem(res.data); setLoading(false); })
      .catch(err => { console.error('Error fetching item:', err); setLoading(false); });
  }, [_id]);

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="md">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{
            mb: 4,
            fontFamily: '"Cinzel", serif',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            color: alpha(goldLight, 0.6),
            '&:hover': { color: gold, backgroundColor: alpha(gold, 0.05) },
          }}
        >
          Back
        </Button>

        {loading ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
              border: `1px solid ${alpha(gold, 0.1)}`,
              borderRadius: '12px',
            }}
          >
            <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
              <Skeleton variant="rectangular" sx={{ width: { xs: '100%', md: 320 }, height: 320, borderRadius: '8px', bgcolor: alpha(gold, 0.05) }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" sx={{ bgcolor: alpha(gold, 0.07), height: 40, mb: 2 }} />
                <Skeleton variant="text" sx={{ bgcolor: alpha(gold, 0.05), height: 24, mb: 1, width: '40%' }} />
                <Skeleton variant="rectangular" sx={{ bgcolor: alpha(gold, 0.04), height: 80, borderRadius: '4px' }} />
              </Box>
            </Box>
          </Paper>
        ) : item ? (
          <Paper
            elevation={0}
            sx={{
              overflow: 'hidden',
              background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
              border: `1px solid ${alpha(gold, 0.15)}`,
              borderRadius: '16px',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
              },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
              {/* Image */}
              <Box
                sx={{
                  width: { xs: '100%', md: '45%' },
                  position: 'relative',
                  overflow: 'hidden',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: { xs: 'none', md: `linear-gradient(to right, transparent 70%, ${alpha('#0D0810', 0.8)})` },
                  },
                }}
              >
                <Box
                  component="img"
                  src={item.img}
                  alt={item.name}
                  sx={{
                    width: '100%',
                    height: { xs: 280, md: '100%' },
                    minHeight: { md: 400 },
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.6s ease',
                    '&:hover': { transform: 'scale(1.04)' },
                  }}
                />
              </Box>

              {/* Info */}
              <Box sx={{ flex: 1, p: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.65rem',
                    letterSpacing: '0.3em',
                    color: alpha(gold, 0.6),
                    textTransform: 'uppercase',
                    mb: 1.5,
                  }}
                >
                  Product Details
                </Typography>

                <Typography
                  sx={{
                    fontFamily: '"Playfair Display", serif',
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', md: '2rem' },
                    color: goldLight,
                    lineHeight: 1.3,
                    mb: 2,
                  }}
                >
                  {item.name}
                </Typography>

                <Box sx={{ width: 40, height: 1, background: `linear-gradient(90deg, ${gold}, transparent)`, mb: 3 }} />

                <Typography
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontWeight: 700,
                    fontSize: '2rem',
                    ...goldGradientText,
                    mb: 3,
                  }}
                >
                  ${item.price}
                </Typography>

                {item.description && (
                  <Typography
                    sx={{
                      fontFamily: '"Lato", sans-serif',
                      fontWeight: 300,
                      fontSize: '0.9rem',
                      color: alpha(goldLight, 0.6),
                      lineHeight: 1.85,
                      mb: 4,
                    }}
                  >
                    {item.description}
                  </Typography>
                )}

                <Button
                  variant="contained"
                  onClick={() => navigate('/shop')}
                  sx={{
                    alignSelf: 'flex-start',
                    background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                    color: '#0a0608',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.75rem',
                    letterSpacing: '0.15em',
                    py: 1.5,
                    px: 4,
                    boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                    '&:hover': {
                      background: `linear-gradient(135deg, #E8D5A3 0%, ${gold} 100%)`,
                      boxShadow: `0 8px 30px ${alpha(gold, 0.55)}`,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Browse Shop
                </Button>
              </Box>
            </Box>
          </Paper>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: alpha(goldLight, 0.35) }}>
              Item not found.
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default ItemDetailsPage;

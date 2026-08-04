'use client';
import React from 'react';
import {
  Box, Container, Grid, Typography, Paper, Stack, Avatar, Rating, Chip,
} from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import StarIcon from '@mui/icons-material/Star';
import { colors } from '@/lib/theme';

// Sample reviews — in production fetch from API
const sampleReviews = [
  {
    _id: '1',
    name: 'Maria Santos',
    country: 'Portugal',
    flag: '🇵🇹',
    rating: 5,
    text: 'I ordered a candle to be lit for my late mother. I received a beautiful video from inside the church. It was deeply moving and brought me so much peace. Thank you for this sacred service.',
    date: '2024-01-15',
    product: 'Candle Prayer',
  },
  {
    _id: '2',
    name: 'Hans Mueller',
    country: 'Germany',
    flag: '🇩🇪',
    rating: 5,
    text: 'The olive wood cross I purchased is absolutely beautiful. The quality is exceptional and it arrived well packaged. It is now proudly displayed in our home chapel.',
    date: '2024-02-03',
    product: 'Olive Wood Cross',
  },
  {
    _id: '3',
    name: 'Elena Petrova',
    country: 'Russia',
    flag: '🇷🇺',
    rating: 5,
    text: 'An amazing service! The holy water arrived in a beautiful bottle with a blessing card. I use it every day in my prayers. Highly recommend to all believers.',
    date: '2024-01-28',
    product: 'Holy Water',
  },
  {
    _id: '4',
    name: 'Jean-Pierre Dubois',
    country: 'France',
    flag: '🇫🇷',
    rating: 5,
    text: 'The live stream from Nazareth was incredible. Being able to attend Christmas mass virtually from our home was a blessing. The connection to the Holy Land felt very real.',
    date: '2023-12-26',
    product: 'Live Stream',
  },
  {
    _id: '5',
    name: 'Isabella Rossi',
    country: 'Italy',
    flag: '🇮🇹',
    rating: 5,
    text: 'I have ordered multiple times. Every order is perfect. The candle videos are so personal and emotional. This ministry is doing beautiful work for Christians everywhere.',
    date: '2024-02-14',
    product: 'Candle Prayer',
  },
  {
    _id: '6',
    name: 'Ana Kowalski',
    country: 'Poland',
    flag: '🇵🇱',
    rating: 5,
    text: 'The sand from Nazareth I purchased is a true treasure. The packaging was beautiful and included a certificate of authenticity. A perfect gift for my grandmother.',
    date: '2024-01-10',
    product: 'Nazareth Sand',
  },
];

export default function ReviewsPage() {
  const avgRating = 5.0;

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(160deg, #1C0E06, #2C1810)', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: '#F7F2E8', mb: 1.5 }}>
            Testimonials
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'rgba(247,242,232,0.7)', fontSize: '1.1rem', mb: 4 }}>
            Words from the faithful around the world
          </Typography>
          <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '2.5rem', color: '#C9A84C', lineHeight: 1 }}>
                {avgRating.toFixed(1)}
              </Typography>
              <Rating value={avgRating} precision={0.1} readOnly size="small" sx={{ color: '#C9A84C', mt: 0.5 }} />
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(247,242,232,0.5)', mt: 0.5 }}>
                Average Rating
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: 60, backgroundColor: 'rgba(201,168,76,0.3)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '2.5rem', color: '#C9A84C', lineHeight: 1 }}>
                {sampleReviews.length}+
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(247,242,232,0.5)', mt: 0.5 }}>
                Happy Customers
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: 60, backgroundColor: 'rgba(201,168,76,0.3)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '2.5rem', color: '#C9A84C', lineHeight: 1 }}>
                9
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(247,242,232,0.5)', mt: 0.5 }}>
                Countries
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Reviews Grid */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={3}>
          {sampleReviews.map((review) => (
            <Grid xs={12} sm={6} md={4} key={review._id}>
              <Paper
                elevation={1}
                sx={{
                  p: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(201,168,76,0.12)',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(28,18,8,0.1)',
                    borderColor: 'rgba(201,168,76,0.3)',
                  },
                }}
              >
                <FormatQuoteIcon sx={{ color: 'rgba(201,168,76,0.25)', fontSize: '2.5rem', mb: 1 }} />
                <Typography sx={{ color: colors.textSecondary, lineHeight: 1.8, fontSize: '0.88rem', flexGrow: 1, mb: 3, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                  "{review.text}"
                </Typography>
                {review.product && (
                  <Chip
                    label={review.product}
                    size="small"
                    sx={{
                      mb: 2,
                      fontSize: '0.65rem',
                      fontFamily: 'Lato, sans-serif',
                      backgroundColor: 'rgba(201,168,76,0.1)',
                      color: colors.goldDark,
                      border: '1px solid rgba(201,168,76,0.2)',
                      alignSelf: 'flex-start',
                    }}
                  />
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                      fontFamily: 'Cinzel, serif',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: '#1C1208',
                    }}
                  >
                    {review.name.charAt(0)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.85rem', color: colors.textPrimary }}>
                      {review.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted }}>
                      {review.flag} {review.country}
                    </Typography>
                  </Box>
                  <Rating value={review.rating} readOnly size="small" sx={{ color: '#C9A84C' }} />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

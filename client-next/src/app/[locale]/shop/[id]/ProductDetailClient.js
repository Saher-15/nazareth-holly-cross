'use client';
import React, { useState } from 'react';
import {
  Box, Container, Grid, Typography, Button, Chip, IconButton,
  Stack, Accordion, AccordionSummary, AccordionDetails, Divider,
  Breadcrumbs, Link as MuiLink, Snackbar, Alert, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VerifiedIcon from '@mui/icons-material/Verified';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Link from 'next/link';
import { colors } from '@/lib/theme';
import { useShop } from '@/context/ShopContext';

export default function ProductDetailClient({ product, locale, id }) {
  const { addToCart, toggleWishlist, isInWishlist } = useShop();
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || null);
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);
  const [addedSnack, setAddedSnack] = useState(false);

  if (!product) {
    return (
      <Container maxWidth="lg" sx={{ py: 12, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: colors.textPrimary, mb: 2 }}>
          Product not found
        </Typography>
        <Button component={Link} href={`/${locale}/shop`} variant="outlined" sx={{ borderColor: colors.gold, color: colors.goldDark }}>
          Back to Shop
        </Button>
      </Container>
    );
  }

  const inWishlist = isInWishlist(product._id);
  const hasColors = product.colors && product.colors.length > 0;
  const imageUrl = product.imageUrl || product.image;

  const handleAddToCart = () => {
    addToCart(product, selectedColor, quantity);
    setAddedSnack(true);
  };

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 4, '& .MuiBreadcrumbs-separator': { color: colors.textMuted } }}
        >
          <MuiLink component={Link} href={`/${locale}`} sx={{ color: colors.textMuted, fontSize: '0.82rem', '&:hover': { color: colors.goldDark } }}>
            Home
          </MuiLink>
          <MuiLink component={Link} href={`/${locale}/shop`} sx={{ color: colors.textMuted, fontSize: '0.82rem', '&:hover': { color: colors.goldDark } }}>
            Shop
          </MuiLink>
          <Typography sx={{ color: colors.textSecondary, fontSize: '0.82rem' }}>
            {product.name}
          </Typography>
        </Breadcrumbs>

        <Grid container spacing={{ xs: 3, md: 6 }}>
          {/* Image */}
          <Grid xs={12} md={6}>
            <Box
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(201,168,76,0.15)',
                boxShadow: '0 8px 40px rgba(28,18,8,0.1)',
                backgroundColor: '#FFFFFF',
              }}
            >
              {!imageError && imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  onError={() => setImageError(true)}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box
                  sx={{
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    fontSize: '6rem',
                    color: 'rgba(201,168,76,0.3)',
                  }}
                >
                  ✝
                </Box>
              )}
            </Box>
          </Grid>

          {/* Details */}
          <Grid xs={12} md={6}>
            {product.category && (
              <Chip
                label={product.category}
                size="small"
                sx={{
                  mb: 2,
                  fontFamily: 'Lato, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(201,168,76,0.12)',
                  color: colors.goldDark,
                  border: '1px solid rgba(201,168,76,0.3)',
                }}
              />
            )}

            <Typography
              component="h1"
              sx={{
                fontFamily: 'Cinzel, serif',
                fontWeight: 700,
                fontSize: { xs: '1.5rem', md: '1.9rem' },
                color: colors.textPrimary,
                lineHeight: 1.3,
                mb: 1,
              }}
            >
              {product.name}
            </Typography>

            {/* Price */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
              <Typography
                sx={{
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  fontSize: '2rem',
                  color: colors.goldDark,
                }}
              >
                ${product.price}
              </Typography>
              {product.originalPrice && product.originalPrice > product.price && (
                <Typography
                  sx={{
                    fontSize: '1.1rem',
                    color: colors.textMuted,
                    textDecoration: 'line-through',
                  }}
                >
                  ${product.originalPrice}
                </Typography>
              )}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Description */}
            {product.description && (
              <Typography
                sx={{
                  color: colors.textSecondary,
                  lineHeight: 1.8,
                  mb: 3,
                  fontSize: '0.92rem',
                }}
              >
                {product.description}
              </Typography>
            )}

            {/* Color selector */}
            {hasColors && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    fontFamily: 'Lato, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: colors.textSecondary,
                    mb: 1.5,
                  }}
                >
                  Color: <span style={{ color: colors.textPrimary }}>{selectedColor}</span>
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} sx={{ gap: 1 }}>
                  {product.colors.map((color) => (
                    <Chip
                      key={color}
                      label={color}
                      onClick={() => setSelectedColor(color)}
                      variant={selectedColor === color ? 'filled' : 'outlined'}
                      sx={{
                        fontFamily: 'Lato, sans-serif',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        ...(selectedColor === color
                          ? { backgroundColor: colors.gold, color: '#1C1208', borderColor: colors.gold }
                          : { borderColor: 'rgba(201,168,76,0.4)', color: colors.textSecondary }),
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Quantity */}
            <Box sx={{ mb: 3 }}>
              <Typography
                sx={{
                  fontFamily: 'Lato, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                  mb: 1.5,
                }}
              >
                Quantity
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  size="small"
                  sx={{ border: '1px solid rgba(201,168,76,0.4)', color: colors.textSecondary }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography
                  sx={{
                    fontFamily: 'Cinzel, serif',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    minWidth: 40,
                    textAlign: 'center',
                  }}
                >
                  {quantity}
                </Typography>
                <IconButton
                  onClick={() => setQuantity(quantity + 1)}
                  size="small"
                  sx={{ border: '1px solid rgba(201,168,76,0.4)', color: colors.textSecondary }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            {/* Actions */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<ShoppingCartIcon />}
                onClick={handleAddToCart}
                sx={{
                  background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
                  color: '#1C1208',
                  fontFamily: 'Cinzel, serif',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  py: 1.75,
                  '&:hover': { background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' },
                }}
              >
                Add to Cart
              </Button>
              <Tooltip title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
                <IconButton
                  onClick={() => toggleWishlist(product)}
                  sx={{
                    border: '1.5px solid rgba(201,168,76,0.4)',
                    borderRadius: 1,
                    color: inWishlist ? colors.crimson : colors.textSecondary,
                    minWidth: 52,
                    '&:hover': { backgroundColor: 'rgba(139,26,26,0.05)', borderColor: colors.crimson },
                  }}
                >
                  {inWishlist ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Trust badges */}
            <Stack direction="row" spacing={3}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <LocalShippingIcon sx={{ fontSize: '1rem', color: colors.gold }} />
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                  Worldwide shipping
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <VerifiedIcon sx={{ fontSize: '1rem', color: colors.gold }} />
                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                  Authentic from Nazareth
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        {/* Accordion Details */}
        <Box sx={{ mt: 6 }}>
          {[
            { title: 'Product Details', content: product.details || product.description || 'No additional details available.' },
            { title: 'Shipping Information', content: 'We ship worldwide from Nazareth, Israel. Standard shipping takes 7-14 business days. Express shipping available at checkout. All items are carefully packaged to ensure they arrive safely.' },
            { title: 'Return Policy', content: 'We accept returns within 30 days of delivery. Items must be in their original condition. Contact us to initiate a return.' },
          ].map((item) => (
            <Accordion key={item.title} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '0.9rem', color: colors.textPrimary }}>
                  {item.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography sx={{ color: colors.textSecondary, lineHeight: 1.8, fontSize: '0.88rem' }}>
                  {item.content}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>

      <Snackbar
        open={addedSnack}
        autoHideDuration={3000}
        onClose={() => setAddedSnack(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setAddedSnack(false)}>
          {product.name} added to cart!
        </Alert>
      </Snackbar>
    </Box>
  );
}

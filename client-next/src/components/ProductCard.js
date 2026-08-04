'use client';
import React, { useState } from 'react';
import {
  Card, CardMedia, CardContent, CardActions, Box, Typography,
  Button, IconButton, Chip, Tooltip, Skeleton,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { colors } from '@/lib/theme';
import { useShop } from '@/context/ShopContext';

export default function ProductCard({ product, loading = false }) {
  const locale = useLocale();
  const { addToCart, toggleWishlist, isInWishlist } = useShop();
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <Skeleton variant="rectangular" height={220} animation="wave" />
        <CardContent>
          <Skeleton variant="text" width="80%" height={24} />
          <Skeleton variant="text" width="40%" height={20} />
        </CardContent>
      </Card>
    );
  }

  if (!product) return null;

  const inWishlist = isInWishlist(product._id);
  const hasColors = product.colors && product.colors.length > 0;
  const imageUrl = product.imageUrl || product.image || '/placeholder-product.jpg';

  const handleAddToCart = (e) => {
    e.preventDefault();
    const color = hasColors ? product.colors[0] : null;
    addToCart(product, color);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    toggleWishlist(product);
  };

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: '1px solid rgba(201,168,76,0.12)',
        transition: 'all 0.3s ease',
        transform: hovered ? 'translateY(-6px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(28,18,8,0.14)' : '0 2px 10px rgba(28,18,8,0.06)',
      }}
    >
      {/* Wishlist button */}
      <IconButton
        onClick={handleWishlist}
        size="small"
        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(4px)',
          width: 32,
          height: 32,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': { backgroundColor: '#FFFFFF' },
        }}
      >
        {inWishlist ? (
          <FavoriteIcon sx={{ fontSize: '1rem', color: colors.crimson }} />
        ) : (
          <FavoriteBorderIcon sx={{ fontSize: '1rem', color: colors.textMuted }} />
        )}
      </IconButton>

      {/* Product image */}
      <Box
        component={Link}
        href={`/${locale}/shop/${product._id}`}
        sx={{ display: 'block', position: 'relative', overflow: 'hidden', aspectRatio: '1', textDecoration: 'none' }}
      >
        {!imageError ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <img
              src={imageUrl}
              alt={product.name}
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.4s ease',
                transform: hovered ? 'scale(1.08)' : 'scale(1)',
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1',
              backgroundColor: colors.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
            }}
          >
            ✝
          </Box>
        )}

        {/* Quick view overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(28,18,8,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <Button
            variant="contained"
            size="small"
            startIcon={<VisibilityIcon />}
            sx={{
              backgroundColor: 'rgba(247,242,232,0.95)',
              color: colors.textPrimary,
              fontFamily: 'Cinzel, serif',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              '&:hover': { backgroundColor: '#FFFFFF' },
            }}
          >
            View Details
          </Button>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1, pt: 1.5, px: 1.5, pb: 0.5 }}>
        {product.category && (
          <Typography
            sx={{
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: colors.textMuted,
              fontFamily: 'Lato, sans-serif',
              fontWeight: 700,
              mb: 0.5,
            }}
          >
            {product.category}
          </Typography>
        )}
        <Typography
          component={Link}
          href={`/${locale}/shop/${product._id}`}
          sx={{
            fontFamily: 'Playfair Display, serif',
            fontWeight: 600,
            fontSize: { xs: '0.85rem', md: '0.95rem' },
            color: colors.textPrimary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            textDecoration: 'none',
            '&:hover': { color: colors.goldDark },
            transition: 'color 0.2s',
          }}
        >
          {product.name}
        </Typography>

        {/* Color dots */}
        {hasColors && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {product.colors.slice(0, 5).map((color) => (
              <Tooltip key={color} title={color}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: color.toLowerCase(),
                    border: '1.5px solid rgba(0,0,0,0.15)',
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            ))}
            {product.colors.length > 5 && (
              <Typography sx={{ fontSize: '0.6rem', color: colors.textMuted, lineHeight: '14px' }}>
                +{product.colors.length - 5}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 1.5, pb: 1.5, pt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Price */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          {product.originalPrice && product.originalPrice > product.price && (
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: colors.textMuted,
                textDecoration: 'line-through',
                fontFamily: 'Lato, sans-serif',
              }}
            >
              ${product.originalPrice}
            </Typography>
          )}
          <Typography
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: '1rem', md: '1.1rem' },
              color: colors.goldDark,
            }}
          >
            ${product.price}
          </Typography>
        </Box>

        {/* Add to cart */}
        {!hasColors ? (
          <IconButton
            onClick={handleAddToCart}
            size="small"
            aria-label="Add to cart"
            sx={{
              background: 'linear-gradient(135deg, #C9A84C, #8A6107)',
              color: '#1C1208',
              width: 36,
              height: 36,
              '&:hover': {
                background: 'linear-gradient(135deg, #E8C97A, #C9A84C)',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <ShoppingCartIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        ) : (
          <Button
            component={Link}
            href={`/${locale}/shop/${product._id}`}
            size="small"
            variant="outlined"
            sx={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.6rem',
              letterSpacing: '0.06em',
              px: 1.5,
              py: 0.5,
              borderColor: colors.gold,
              color: colors.goldDark,
              '&:hover': { backgroundColor: 'rgba(201,168,76,0.08)' },
            }}
          >
            Select
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

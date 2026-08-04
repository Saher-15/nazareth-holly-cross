import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { gold, goldDark, crimson, textSecondary } from '../theme';
import { useShopContext } from '../context/shop-context';

export default function CardItem({ product }) {
  const { addToCart } = useShopContext();
  const [wished, setWished] = useState(false);
  const [added,  setAdded]  = useState(false);

  if (!product) return null;

  const { _id, name, price, images, stock, rating } = product;
  const image      = images?.[0] || '/images/placeholder.jpg';
  const outOfStock = stock === 0;
  const stars      = Math.round(rating || 4);

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (outOfStock) return;
    addToCart({ ...product, color: product.color?.[0] || '' });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Card
      component={Link}
      to={`/shop/${_id}`}
      sx={{
        display: 'flex', flexDirection: 'column', height: '100%',
        textDecoration: 'none', position: 'relative', overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        border: `1px solid ${alpha(gold, 0.18)}`,
        borderRadius: '12px',
        boxShadow: `0 2px 16px ${alpha('#8A6107', 0.08)}`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          border: `1px solid ${alpha(gold, 0.4)}`,
          boxShadow: `0 12px 40px ${alpha('#8A6107', 0.18)}`,
          transform: 'translateY(-8px)',
          '& .card-image': { transform: 'scale(1.06)' },
          '& .card-overlay-actions': { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Image */}
      <Box sx={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden', backgroundColor: '#F7F2E8' }}>
        <Box
          className="card-image"
          component="img"
          src={image}
          alt={name}
          loading="lazy"
          sx={{
            width: '100%', height: '100%', objectFit: 'cover',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />

        {/* Out of stock overlay */}
        {outOfStock && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              backgroundColor: alpha('#1C0E06', 0.65),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.2em', color: alpha('#F7F2E8', 0.8) }}>
              OUT OF STOCK
            </Typography>
          </Box>
        )}

        {/* Wishlist button */}
        <IconButton
          size="small"
          onClick={(e) => { e.preventDefault(); setWished(!wished); }}
          sx={{
            position: 'absolute', top: 8, right: 8,
            backgroundColor: alpha('#FFFFFF', 0.85),
            backdropFilter: 'blur(4px)',
            width: 32, height: 32,
            '&:hover': { backgroundColor: '#FFFFFF' },
          }}
        >
          {wished
            ? <FavoriteIcon sx={{ fontSize: '1rem', color: crimson }} />
            : <FavoriteBorderIcon sx={{ fontSize: '1rem', color: textSecondary }} />
          }
        </IconButton>

        {/* Quick view overlay */}
        <Box
          className="card-overlay-actions"
          sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', gap: 1, p: 1.5, justifyContent: 'center',
            background: 'linear-gradient(to top, rgba(28,14,6,0.75), transparent)',
            opacity: 0, transform: 'translateY(10px)',
            transition: 'all 0.3s ease',
          }}
        >
          <Tooltip title="View Details">
            <IconButton
              component={Link}
              to={`/shop/${_id}`}
              size="small"
              onClick={(e) => e.stopPropagation()}
              sx={{ backgroundColor: alpha('#FFFFFF', 0.9), width: 32, height: 32, '&:hover': { backgroundColor: '#FFFFFF' } }}
            >
              <VisibilityOutlinedIcon sx={{ fontSize: '0.9rem', color: textSecondary }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Content */}
      <CardContent sx={{ flexGrow: 1, p: 2, pb: 1 }}>
        {/* Stars */}
        <Box sx={{ display: 'flex', gap: 0.2, mb: 0.8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon key={i} sx={{ fontSize: '0.75rem', color: i < stars ? gold : alpha(gold, 0.25) }} />
          ))}
        </Box>

        <Typography
          sx={{
            fontFamily: '"Cinzel", serif', fontSize: '0.78rem', fontWeight: 600,
            color: '#1C1208', letterSpacing: '0.05em', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1,
          }}
        >
          {name}
        </Typography>

        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1rem', fontWeight: 700, color: goldDark }}>
          ${price}
        </Typography>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<AddShoppingCartIcon sx={{ fontSize: '0.9rem !important' }} />}
          onClick={handleAddToCart}
          disabled={outOfStock}
          sx={{
            background: added
              ? 'linear-gradient(135deg, #2E7D32 0%, #43A047 100%)'
              : `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
            color: '#1C1208',
            py: 0.9, fontSize: '0.68rem', letterSpacing: '0.14em', boxShadow: 'none',
            '&:hover': { boxShadow: `0 4px 16px ${alpha(gold, 0.4)}`, transform: 'none' },
            '&.Mui-disabled': { background: alpha(gold, 0.2), color: alpha('#1C1208', 0.4) },
          }}
        >
          {added ? 'Added!' : outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </CardActions>
    </Card>
  );
}

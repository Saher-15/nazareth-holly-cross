import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { gold, goldDark } from '../../theme';

const Product = ({ item }) => {
  const { _id, name, price, img, color } = item;
  const { addToCart } = useShopContext();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imgSrc, setImgSrc] = useState(img);
  const [added, setAdded] = useState(false);

  const hasColors = color && color.length > 0;

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasColors) return;
    addToCart({ _id, name, price, img, color: '' });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Card
      component={Link}
      to={`/product/${_id}`}
      sx={{
        display: 'block',
        textDecoration: 'none',
        background: '#FFFFFF',
        border: `1px solid ${alpha(gold, 0.18)}`,
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        boxShadow: `0 2px 12px ${alpha(goldDark, 0.08)}`,
        '&:hover': {
          border: `1px solid ${alpha(gold, 0.4)}`,
          boxShadow: `0 20px 52px ${alpha(goldDark, 0.18)}, 0 0 28px ${alpha(gold, 0.1)}`,
          transform: 'translateY(-6px)',
          '& .product-img': {
            transform: 'scale(1.08)',
            filter: 'brightness(0.75) saturate(1.15)',
          },
          '& .quick-actions': { opacity: 1, transform: 'translateY(0)' },
          '& .price-tag': { opacity: 0 },
        },
      }}
    >
      {/* Image */}
      <Box sx={{ overflow: 'hidden', position: 'relative', height: { xs: 180, sm: 220 }, bgcolor: alpha(gold, 0.04) }}>
        {imgError ? (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <ImageNotSupportedIcon sx={{ fontSize: '2rem', color: alpha(gold, 0.25) }} />
            <Typography sx={{ fontSize: '0.65rem', color: alpha(goldDark, 0.4), fontFamily: '"Cinzel", serif', letterSpacing: '0.1em' }}>
              No Image
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={imgSrc}
            alt={name}
            className="product-img"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              if (retryCount < 2) {
                const t = setTimeout(() => {
                  setRetryCount(r => r + 1);
                  setImgSrc(`${img}${img.includes('?') ? '&' : '?'}_r=${retryCount + 1}`);
                }, 1500 * (retryCount + 1));
                return () => clearTimeout(t);
              }
              setImgError(true);
            }}
            sx={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'brightness(1) saturate(1)',
              opacity: imgLoaded ? 1 : 0,
            }}
          />
        )}

        {/* Bottom gradient — warm cream fade */}
        {!imgError && (
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: `linear-gradient(to top, rgba(247,242,232,0.9), transparent)`, pointerEvents: 'none' }} />
        )}

        {/* Hover quick-action overlay */}
        <Box
          className="quick-actions"
          sx={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
            opacity: 0, transform: 'translateY(8px)',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {hasColors ? (
            <Tooltip title="Choose options" placement="top">
              <Box
                sx={{
                  px: 2.5, py: 1,
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 0.8,
                  boxShadow: `0 4px 16px ${alpha(gold, 0.5)}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': { background: `linear-gradient(135deg, #D4B86A 0%, ${gold} 100%)` },
                }}
              >
                <VisibilityIcon sx={{ fontSize: '0.85rem' }} />
                View Options
              </Box>
            </Tooltip>
          ) : (
            <Tooltip title={added ? 'Added!' : 'Quick add'} placement="top">
              <IconButton
                onClick={handleQuickAdd}
                sx={{
                  width: 48, height: 48,
                  background: added
                    ? `linear-gradient(135deg, #2E7D32, #388E3C)`
                    : `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208',
                  boxShadow: `0 4px 20px ${alpha(added ? '#4CAF50' : gold, 0.55)}`,
                  border: `2px solid ${added ? alpha('#4CAF50', 0.5) : alpha(gold, 0.4)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: added
                      ? `linear-gradient(135deg, #2E7D32, #388E3C)`
                      : `linear-gradient(135deg, #D4B86A 0%, ${gold} 100%)`,
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {added ? <CheckIcon sx={{ fontSize: '1.2rem' }} /> : <AddShoppingCartIcon sx={{ fontSize: '1.2rem' }} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Info */}
      <Box sx={{ p: 2, position: 'relative' }}>
        <Typography
          sx={{
            fontFamily: '"Playfair Display", serif', fontWeight: 500,
            fontSize: '0.85rem', color: '#3D2B1F',
            mb: 0.6, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {name}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography
            className="price-tag"
            sx={{
              fontFamily: '"Cinzel", serif', fontWeight: 700,
              fontSize: '0.9rem', color: goldDark, letterSpacing: '0.04em',
              transition: 'opacity 0.3s ease',
            }}
          >
            ${price}
          </Typography>

          {hasColors && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {color.slice(0, 4).map((c) => (
                <Box
                  key={c}
                  sx={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: c,
                    border: `1px solid ${alpha(goldDark, 0.2)}`,
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Top gold accent bar — appears on hover */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.5)}, transparent)`, opacity: 0, transition: 'opacity 0.35s ease', '.MuiCard-root:hover &': { opacity: 1 } }} />
    </Card>
  );
};

export default Product;

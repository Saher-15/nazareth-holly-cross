import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import { gold, goldLight } from '../../theme';

const Product = ({ item }) => {
  const { _id, name, price, img } = item;
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imgSrc, setImgSrc] = useState(img);

  return (
    <Card
      sx={{
        background: `linear-gradient(145deg, ${alpha('#1A1215', 0.9)} 0%, ${alpha('#0D0810', 0.95)} 100%)`,
        border: `1px solid ${alpha(gold, 0.1)}`,
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          border: `1px solid ${alpha(gold, 0.35)}`,
          boxShadow: `0 16px 48px ${alpha('#000', 0.6)}, 0 0 24px ${alpha(gold, 0.08)}`,
          transform: 'translateY(-6px)',
          '& .product-img': {
            transform: 'scale(1.06)',
            filter: 'brightness(0.8) saturate(1.2)',
          },
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={`/product/${_id}`}
        sx={{ textDecoration: 'none', '&:hover .MuiCardActionArea-focusHighlight': { opacity: 0 } }}
      >
        {/* Image */}
        <Box sx={{ overflow: 'hidden', position: 'relative', height: { xs: 180, sm: 220 }, bgcolor: alpha(gold, 0.04) }}>
          {imgError ? (
            /* Fallback when image fails */
            <Box sx={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <ImageNotSupportedIcon sx={{ fontSize: '2rem', color: alpha(gold, 0.2) }} />
              <Typography sx={{ fontSize: '0.65rem', color: alpha(gold, 0.3), fontFamily: '"Cinzel", serif', letterSpacing: '0.1em' }}>
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
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: 'brightness(0.88) saturate(0.9)',
                opacity: imgLoaded ? 1 : 0,
              }}
            />
          )}

          {/* Bottom gradient overlay */}
          {!imgError && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: '40%',
                background: `linear-gradient(to top, ${alpha('#0a0608', 0.8)}, transparent)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>

        {/* Info */}
        <Box sx={{ p: 2 }}>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500,
              fontSize: '0.85rem',
              color: alpha(goldLight, 0.8),
              mb: 0.8,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {name}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: gold,
              letterSpacing: '0.04em',
            }}
          >
            ${price}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default Product;

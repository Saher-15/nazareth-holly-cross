import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { gold, goldLight, goldDark, crimson } from '../../theme';

const CartItem = ({ data }) => {
  const navigate = useNavigate();
  const { _id, name, price, img, quantity, color } = data;
  const { addToCart, updateCartItemCount, decreaseFromCart, removeFromCart } = useShopContext();
  const { t } = useTranslation();

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        gap: { xs: 2, sm: 3 },
        p: { xs: 2, sm: 3 },
        mb: 2,
        background: `linear-gradient(145deg, ${alpha('#1A1215', 0.85)} 0%, ${alpha('#0D0810', 0.9)} 100%)`,
        border: `1px solid ${alpha(gold, 0.1)}`,
        borderRadius: '10px',
        transition: 'all 0.3s ease',
        '&:hover': {
          border: `1px solid ${alpha(gold, 0.25)}`,
          boxShadow: `0 8px 24px ${alpha('#000', 0.4)}`,
        },
      }}
    >
      {/* Product Image */}
      <Box
        component="img"
        src={img}
        alt={name}
        onClick={() => navigate(`/product/${_id}`)}
        sx={{
          width: { xs: 80, sm: 110 },
          height: { xs: 80, sm: 110 },
          objectFit: 'cover',
          borderRadius: '6px',
          cursor: 'pointer',
          flexShrink: 0,
          border: `1px solid ${alpha(gold, 0.15)}`,
          transition: 'all 0.3s ease',
          '&:hover': {
            border: `1px solid ${alpha(gold, 0.4)}`,
            transform: 'scale(1.02)',
          },
        }}
      />

      {/* Details */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 600,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              color: goldLight,
              mb: 0.5,
            }}
          >
            {name}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Cinzel", serif',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: gold,
              letterSpacing: '0.06em',
            }}
          >
            ${price.toFixed(2)}
          </Typography>
          {color && (
            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.75rem', color: alpha(goldLight, 0.45), mt: 0.3 }}>
              {color}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
          {/* Quantity controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${alpha(gold, 0.25)}`,
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            <IconButton
              size="small"
              onClick={() => { if (quantity > 1) decreaseFromCart(_id, color); }}
              disabled={quantity <= 1}
              sx={{
                color: alpha(goldLight, 0.6),
                borderRadius: 0,
                width: 30,
                height: 30,
                '&:hover': { backgroundColor: alpha(gold, 0.1), color: gold },
                '&.Mui-disabled': { color: alpha(goldLight, 0.2) },
              }}
            >
              <RemoveIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
            <Box
              sx={{
                width: 36,
                textAlign: 'center',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: goldLight,
                backgroundColor: alpha(gold, 0.06),
                py: '4px',
              }}
            >
              {quantity}
            </Box>
            <IconButton
              size="small"
              onClick={() => addToCart({ ...data, color })}
              sx={{
                color: alpha(goldLight, 0.6),
                borderRadius: 0,
                width: 30,
                height: 30,
                '&:hover': { backgroundColor: alpha(gold, 0.1), color: gold },
              }}
            >
              <AddIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Box>

          {/* Remove button */}
          <Button
            size="small"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: '0.9rem' }} />}
            onClick={() => removeFromCart(_id, color)}
            sx={{
              fontFamily: '"Cinzel", serif',
              fontSize: '0.62rem',
              letterSpacing: '0.1em',
              color: alpha(crimson, 0.7),
              border: `1px solid ${alpha(crimson, 0.2)}`,
              borderRadius: '6px',
              px: 1.5,
              py: 0.5,
              minHeight: 30,
              '&:hover': {
                backgroundColor: alpha(crimson, 0.08),
                borderColor: alpha(crimson, 0.5),
                color: crimson,
              },
            }}
          >
            {t('cart.remove')}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default CartItem;

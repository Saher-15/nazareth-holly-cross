import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config.js';
import { useParams } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import LoadingLogo from './loading';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import { alpha } from '@mui/material/styles';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { gold, goldDark, crimson, goldGradientText, textSecondary, textMuted } from '../../theme';

const ProductPage = () => {
  const { t } = useTranslation();
  const { addToCart } = useShopContext();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [colorSelectionMessage, setColorSelectionMessage] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchProduct = async () => {
      try {
        const response = await fetch(`${API_URL}/product/getProduct/${id}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        const data = await response.json();
        setProduct(data);
        setSelectedColor('');
        setColorSelectionMessage('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    document.body.style.overflow = zoomOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [zoomOpen]);

  const handleAddToCart = () => {
    if (!selectedColor && product.color && product.color.length > 0) {
      setColorSelectionMessage(t('product.error.selectColor'));
      setTimeout(() => setColorSelectionMessage(''), 2500);
      return;
    }
    let selectedImage = product.img;
    if (product.color?.length > 0 && selectedColor) {
      const colorIndex = product.color.indexOf(selectedColor);
      if (colorIndex !== -1 && product.additionalImageUrls?.length > colorIndex) {
        selectedImage = product.additionalImageUrls[colorIndex];
      }
    }
    addToCart({ _id: product._id, name: product.name, price: product.price, img: selectedImage, color: selectedColor });
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2500);
  };

  const handleImageClick = (index) => {
    if (product.color?.length > 0) {
      if (index === 0) { setSelectedColor(''); setCurrentImage(0); }
      else { setSelectedColor(product.color[index - 1]); setCurrentImage(index); }
    } else {
      setCurrentImage(index);
    }
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };

  if (loading) return <LoadingLogo />;
  if (error || !product) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography sx={{ color: textMuted, fontFamily: '"Playfair Display", serif', fontStyle: 'italic' }}>
          {error || t('product.error.productNotFound')}
        </Typography>
      </Box>
    );
  }

  const { name, price, img, description, additionalImageUrls, color } = product;
  const displayedImage = currentImage === 0 ? img : additionalImageUrls[currentImage - 1];
  const allImages = [img, ...(additionalImageUrls || [])];

  return (
    <Box sx={{ minHeight: '80vh', bgcolor: '#F7F2E8', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="flex-start">
          {/* Image Panel */}
          <Grid size={{ xs: 12, md: 6 }}>
            {/* Main image */}
            <Box
              sx={{
                position: 'relative',
                background: '#FFFFFF',
                border: `1px solid ${alpha(gold, 0.25)}`,
                borderRadius: '10px',
                overflow: 'hidden',
                cursor: 'crosshair',
                mb: 2,
                boxShadow: `0 4px 20px ${alpha(goldDark, 0.1)}`,
                '&:hover .zoom-lens': { opacity: 1 },
              }}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setZoomOpen(true)}
              onMouseLeave={() => setZoomOpen(false)}
            >
              <Box
                component="img"
                src={displayedImage}
                alt={name}
                onError={(e) => { e.currentTarget.style.opacity = '0.15'; }}
                sx={{
                  width: '100%',
                  height: { xs: 300, sm: 420 },
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s ease',
                }}
              />
              {/* Zoom overlay */}
              {zoomOpen && (
                <Box
                  className="zoom-lens"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${displayedImage})`,
                    backgroundSize: '250%',
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: 'none',
                    '.MuiBox-root:hover &': { opacity: 1 },
                  }}
                />
              )}
            </Box>

            {/* Thumbnails */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {allImages.map((imgSrc, index) => (
                <Box
                  key={index}
                  component="img"
                  src={imgSrc}
                  alt={`${name} ${index}`}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  onClick={() => handleImageClick(index)}
                  sx={{
                    width: 64,
                    height: 64,
                    objectFit: 'cover',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: currentImage === index
                      ? `2px solid ${gold}`
                      : `1px solid ${alpha(gold, 0.2)}`,
                    opacity: currentImage === index ? 1 : 0.65,
                    transition: 'all 0.3s ease',
                    filter: currentImage === index ? 'none' : 'grayscale(15%)',
                    '&:hover': { opacity: 1, borderColor: alpha(gold, 0.5) },
                  }}
                />
              ))}
            </Box>
          </Grid>

          {/* Product Info Panel */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                p: { xs: 3, md: 4 },
                background: '#FFFFFF',
                border: `1px solid ${alpha(gold, 0.2)}`,
                borderRadius: '12px',
                boxShadow: `0 4px 24px ${alpha(goldDark, 0.1)}`,
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
              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '1.8rem' },
                  ...goldGradientText,
                  mb: 1,
                  lineHeight: 1.3,
                }}
              >
                {name}
              </Typography>

              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontWeight: 700,
                  fontSize: '1.6rem',
                  color: goldDark,
                  mb: 3,
                  letterSpacing: '0.04em',
                }}
              >
                ${price}
              </Typography>

              {/* Color selection */}
              {color?.length > 0 && name !== 'Nazareth city puzzle' && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.7rem',
                      letterSpacing: '0.2em',
                      color: goldDark,
                      textTransform: 'uppercase',
                      mb: 1.5,
                    }}
                  >
                    Color
                    {selectedColor && (
                      <Box component="span" sx={{ ml: 1, color: '#2C1810', fontFamily: '"Lato", sans-serif', fontSize: '0.8rem', letterSpacing: 'normal', textTransform: 'none' }}>
                        — {selectedColor}
                      </Box>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                    {color.map((colorValue, index) => (
                      <Tooltip key={colorValue} title={colorValue} placement="top">
                        <Box
                          onClick={() => { setSelectedColor(colorValue); setCurrentImage(index + 1); }}
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: colorValue,
                            cursor: 'pointer',
                            border: selectedColor === colorValue
                              ? `3px solid ${gold}`
                              : `2px solid ${alpha(goldDark, 0.2)}`,
                            boxShadow: selectedColor === colorValue
                              ? `0 0 12px ${alpha(colorValue, 0.6)}, 0 0 0 2px ${alpha(gold, 0.3)}`
                              : 'none',
                            transition: 'all 0.3s ease',
                            '&:hover': { transform: 'scale(1.15)', border: `2px solid ${alpha(gold, 0.6)}` },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}

              <Typography
                sx={{
                  fontFamily: '"Lato", sans-serif',
                  fontWeight: 300,
                  fontSize: '0.9rem',
                  color: textSecondary,
                  lineHeight: 1.8,
                  mb: 3,
                }}
              >
                {description}
              </Typography>

              {/* Shipping note */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 3,
                  p: 1.5,
                  borderRadius: '6px',
                  backgroundColor: alpha(gold, 0.07),
                  border: `1px solid ${alpha(gold, 0.18)}`,
                }}
              >
                <LocalShippingIcon sx={{ fontSize: '1rem', color: alpha(goldDark, 0.6) }} />
                <Typography sx={{ fontFamily: '"Lato", sans-serif', fontWeight: 300, fontSize: '0.78rem', color: textMuted }}>
                  {t('product.note.shippingFee')}
                </Typography>
              </Box>

              {/* Alerts */}
              <Collapse in={!!colorSelectionMessage}>
                <Alert severity="warning" sx={{ mb: 2, backgroundColor: alpha('#B8860B', 0.08), color: '#5D3E2C', border: `1px solid ${alpha(gold, 0.35)}`, '& .MuiAlert-icon': { color: goldDark } }}>
                  {colorSelectionMessage}
                </Alert>
              </Collapse>

              <Collapse in={showMessage}>
                <Alert
                  icon={<CheckCircleIcon />}
                  severity="success"
                  sx={{ mb: 2, backgroundColor: alpha('#2E7D32', 0.08), color: '#1C1208', border: `1px solid ${alpha('#2E7D32', 0.35)}`, '& .MuiAlert-icon': { color: '#2E7D32' } }}
                >
                  {t('product.message.productAdded')}
                </Alert>
              </Collapse>

              <Button
                variant="contained"
                fullWidth
                startIcon={<AddShoppingCartIcon />}
                onClick={handleAddToCart}
                sx={{
                  background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                  color: '#1C1208',
                  py: 1.8,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.78rem',
                  letterSpacing: '0.18em',
                  boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                  '&:hover': {
                    background: `linear-gradient(135deg, #D4B86A 0%, ${gold} 100%)`,
                    boxShadow: `0 8px 30px ${alpha(gold, 0.55)}`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {t('product.button.addToCart')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ProductPage;

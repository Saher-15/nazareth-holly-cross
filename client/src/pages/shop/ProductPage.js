import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShopContext } from '../../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha } from '@mui/material/styles';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import api from '../../api';
import { gold, goldDark, crimson, goldGradientText, textSecondary } from '../../theme';

export default function ProductPage() {
  const { t } = useTranslation();
  const { addToCart } = useShopContext();
  const { id } = useParams();
  const [product,       setProduct]       = useState(null);
  const [currentImage,  setCurrentImage]  = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [showMessage,   setShowMessage]   = useState(false);
  const [selectedColor, setSelectedColor] = useState('');
  const [activeTab,     setActiveTab]     = useState(0);
  const [qty,           setQty]           = useState(1);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/product/getProduct/${id}`);
        setProduct(data);
        setSelectedColor('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    if (product.color?.length > 0 && !selectedColor) return;
    for (let i = 0; i < qty; i++) addToCart({ ...product, color: selectedColor });
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 2500);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Grid container spacing={5}>
          <Grid item xs={12} md={6}><Skeleton variant="rectangular" height={480} sx={{ borderRadius: '12px' }} /></Grid>
          <Grid item xs={12} md={6}><Skeleton height={40} sx={{ mb: 2 }} /><Skeleton height={24} sx={{ mb: 1 }} /><Skeleton height={24} width="60%" /></Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: '"Cinzel", serif', color: goldDark, mb: 3 }}>
          Product not found or failed to load.
        </Typography>
        <Button component={Link} to="/shop" startIcon={<ArrowBackIcon />} variant="outlined" sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.12em', borderColor: alpha(gold, 0.4), color: goldDark }}>
          Back to Shop
        </Button>
      </Container>
    );
  }

  const images  = product.images || [];
  const outOfStock = product.stock === 0;
  const stars = Math.round(product.rating || 4);

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh', pb: { xs: 8, md: 12 } }}>
      {/* Breadcrumb */}
      <Box sx={{ backgroundColor: '#EDE6D4', borderBottom: `1px solid ${alpha(gold, 0.15)}`, py: 1.5, px: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component={Link} to="/shop" sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: goldDark, textDecoration: 'none', '&:hover': { color: gold } }}>
            Shop
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: alpha(goldDark, 0.5) }}>/</Typography>
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em', color: '#1C1208' }}>
            {product.name}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 7 } }}>
        <Grid container spacing={{ xs: 4, md: 7 }}>
          {/* Images */}
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'sticky', top: 100 }}>
              {/* Main image */}
              <Box
                sx={{
                  width: '100%', aspectRatio: '1', overflow: 'hidden',
                  borderRadius: '12px', mb: 2,
                  border: `1px solid ${alpha(gold, 0.2)}`,
                  boxShadow: `0 4px 24px ${alpha('#8A6107', 0.1)}`,
                  backgroundColor: '#F7F2E8',
                  cursor: 'zoom-in',
                }}
              >
                <Box
                  component="img"
                  src={images[currentImage] || '/images/placeholder.jpg'}
                  alt={product.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.04)' } }}
                />
              </Box>
              {/* Thumbnails */}
              {images.length > 1 && (
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <Box
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      sx={{
                        width: 70, height: 70, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                        border: `2px solid ${i === currentImage ? gold : alpha(gold, 0.2)}`,
                        transition: 'border-color 0.2s ease',
                        '&:hover': { borderColor: gold },
                      }}
                    >
                      <Box component="img" src={img} alt={`${product.name} ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Grid>

          {/* Info */}
          <Grid item xs={12} md={6}>
            {/* Stars */}
            <Box sx={{ display: 'flex', gap: 0.25, mb: 1.5 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} sx={{ fontSize: '1rem', color: i < stars ? gold : alpha(gold, 0.2) }} />
              ))}
            </Box>

            <Typography variant="h2" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '1.4rem', md: '1.8rem' }, color: '#1C1208', mb: 1.5, letterSpacing: '0.05em' }}>
              {product.name}
            </Typography>

            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '2rem', color: goldDark, mb: 3 }}>
              ${product.price}
            </Typography>

            {/* Stock status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              {outOfStock ? (
                <Chip label="Out of Stock" size="small" sx={{ backgroundColor: alpha(crimson, 0.1), color: crimson, fontFamily: '"Cinzel", serif', fontSize: '0.65rem', border: `1px solid ${alpha(crimson, 0.3)}` }} />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: '1rem' }} />
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: '#4CAF50' }}>In Stock</Typography>
                </Box>
              )}
            </Box>

            {/* Color selection */}
            {product.color?.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.18em', color: goldDark, mb: 1.5, textTransform: 'uppercase' }}>
                  Color
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {product.color.map((c) => (
                    <Box
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      sx={{
                        px: 2, py: 0.8, borderRadius: '6px', cursor: 'pointer',
                        border: `2px solid ${selectedColor === c ? gold : alpha(gold, 0.25)}`,
                        backgroundColor: selectedColor === c ? alpha(gold, 0.12) : '#FFFFFF',
                        fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: '#1C1208',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: gold },
                      }}
                    >
                      {c}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Quantity */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.18em', color: goldDark, textTransform: 'uppercase' }}>Qty</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', border: `1px solid ${alpha(gold, 0.3)}`, borderRadius: '6px', overflow: 'hidden' }}>
                <Box
                  component="button"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  sx={{ px: 1.5, py: 1, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Cinzel", serif', fontSize: '1rem', color: goldDark, '&:hover': { backgroundColor: alpha(gold, 0.08) } }}
                >−</Box>
                <Box sx={{ px: 2.5, py: 1, fontFamily: '"Cinzel", serif', fontSize: '0.9rem', color: '#1C1208', borderLeft: `1px solid ${alpha(gold, 0.2)}`, borderRight: `1px solid ${alpha(gold, 0.2)}` }}>
                  {qty}
                </Box>
                <Box
                  component="button"
                  onClick={() => setQty(q => q + 1)}
                  sx={{ px: 1.5, py: 1, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Cinzel", serif', fontSize: '1rem', color: goldDark, '&:hover': { backgroundColor: alpha(gold, 0.08) } }}
                >+</Box>
              </Box>
            </Box>

            {/* Add to cart */}
            <Collapse in={showMessage}>
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                Added to your cart!
              </Alert>
            </Collapse>
            <Button
              fullWidth variant="contained"
              startIcon={<AddShoppingCartIcon />}
              onClick={handleAddToCart}
              disabled={outOfStock}
              sx={{
                background: `linear-gradient(135deg, ${gold} 0%, ${goldDark} 100%)`,
                color: '#1C1208', py: 1.6, mb: 2,
                boxShadow: `0 4px 20px ${alpha(gold, 0.35)}`,
                '&:hover': { boxShadow: `0 8px 32px ${alpha(gold, 0.5)}`, transform: 'translateY(-2px)' },
                '&.Mui-disabled': { background: alpha(gold, 0.25), color: alpha('#1C1208', 0.4) },
              }}
            >
              {outOfStock ? 'Out of Stock' : 'Add to Cart'}
            </Button>

            {/* Shipping note */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderRadius: '8px', backgroundColor: alpha(gold, 0.06), border: `1px solid ${alpha(gold, 0.15)}` }}>
              <LocalShippingIcon sx={{ color: goldDark, fontSize: '1.2rem' }} />
              <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.8rem', color: textSecondary }}>
                Ships from Nazareth, Israel · Worldwide delivery
              </Typography>
            </Box>

            {/* Tabs */}
            <Box sx={{ mt: 4 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: `1px solid ${alpha(gold, 0.2)}`, mb: 3 }}>
                {['Description', 'Details', 'Shipping'].map((tab, i) => (
                  <Tab key={i} label={tab} sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', letterSpacing: '0.1em', color: textSecondary, '&.Mui-selected': { color: goldDark } }} />
                ))}
              </Tabs>
              {activeTab === 0 && (
                <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.9rem', color: textSecondary, lineHeight: 1.85 }}>
                  {product.description || 'A beautiful sacred item handcrafted in Nazareth, the Holy Land.'}
                </Typography>
              )}
              {activeTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {product.color?.length > 0 && <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}><strong>Colors:</strong> {product.color.join(', ')}</Typography>}
                  {product.stock !== undefined && <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}><strong>Stock:</strong> {product.stock} available</Typography>}
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}><strong>Origin:</strong> Nazareth, Israel</Typography>
                </Box>
              )}
              {activeTab === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}>• Standard international shipping 10–21 business days</Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}>• Express shipping available at checkout</Typography>
                  <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem', color: textSecondary }}>• Each item carefully packaged from Nazareth</Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

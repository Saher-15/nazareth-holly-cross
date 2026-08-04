import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config.js';
import axios from 'axios';
import Product from './product';
import LoadingLogo from './loading';
import { useShopContext } from '../../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { gold, goldDark, crimson, goldGradientText, textSecondary, textMuted } from '../../theme';

const Shop = () => {
  const { t } = useTranslation();
  const { getTotalCartQuantity } = useShopContext();
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => Number(localStorage.getItem('currentPage')) || 1);
  const [sortOrder, setSortOrder] = useState(localStorage.getItem('sortOrder') || 'rateDesc');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(localStorage.getItem('searchQuery') || '');
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/product/getNProducts?page=${currentPage}&size=15`);
        window.scrollTo(0, 0);
        setAllProducts(res.data.data);
        setHasNext(!!res.data.next);
        setHasPrev(!!res.data.previous);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
    localStorage.setItem('sortOrder', sortOrder);
    localStorage.setItem('searchQuery', searchQuery);
  }, [currentPage, sortOrder, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortOrder('rateDesc');
    setCurrentPage(1);
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
    localStorage.setItem('currentPage', 1);
  };

  const filteredProducts = allProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === 'lowToHigh') return a.price - b.price;
    if (sortOrder === 'highToLow') return b.price - a.price;
    if (sortOrder === 'rateDesc') return b.rate - a.rate;
    return 0;
  });

  if (loading) return <LoadingLogo />;

  return (
    <Box sx={{ minHeight: '80vh', bgcolor: '#F7F2E8', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 8 }, position: 'relative' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.55)})` }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(crimson, 0.9), boxShadow: `0 0 8px ${alpha(crimson, 0.7)}` }} />
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.58rem', letterSpacing: '0.42em', color: alpha(goldDark, 0.75), textTransform: 'uppercase' }}>
                Holy Land Gifts
              </Typography>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: alpha(crimson, 0.9), boxShadow: `0 0 8px ${alpha(crimson, 0.7)}` }} />
            </Box>
            <Box sx={{ width: 50, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.55)}, transparent)` }} />
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Cinzel", serif', fontWeight: 700,
              fontSize: { xs: '2rem', md: '3rem' },
              ...goldGradientText, mb: 1.5,
            }}
          >
            {t('navbar.shop') || 'Sacred Shop'}
          </Typography>

          <Typography sx={{
            fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
            color: textSecondary, fontSize: { xs: '0.88rem', md: '0.95rem' },
            maxWidth: 460, mx: 'auto',
          }}>
            Handcrafted treasures from the heart of Nazareth
          </Typography>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            mb: 5,
            alignItems: 'center',
            p: 3,
            background: '#FFFFFF',
            border: `1px solid ${alpha(gold, 0.25)}`,
            borderRadius: '10px',
            boxShadow: `0 4px 20px ${alpha(goldDark, 0.08)}`,
          }}
        >
          <TextField
            placeholder={t('shop.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value.toLowerCase()); setCurrentPage(1); }}
            size="small"
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 250px' },
              '& .MuiOutlinedInput-root': {
                color: '#1C1208',
                fontSize: '0.85rem',
                backgroundColor: '#FFFFFF',
                '& fieldset': { borderColor: alpha(gold, 0.3) },
                '&:hover fieldset': { borderColor: alpha(gold, 0.55) },
                '&.Mui-focused fieldset': { borderColor: gold },
              },
              '& .MuiInputLabel-root': { color: textMuted },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: alpha(goldDark, 0.5), fontSize: '1rem' }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ color: textMuted, fontSize: '0.85rem' }}>Sort</InputLabel>
            <Select
              value={sortOrder}
              label="Sort"
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
              sx={{
                color: '#1C1208',
                fontSize: '0.85rem',
                backgroundColor: '#FFFFFF',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.3) },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.55) },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
                '& .MuiSvgIcon-root': { color: alpha(goldDark, 0.7) },
              }}
            >
              <MenuItem value="rateDesc">{t('shop.sortNone')}</MenuItem>
              <MenuItem value="lowToHigh">{t('shop.sortLowToHigh')}</MenuItem>
              <MenuItem value="highToLow">{t('shop.sortHighToLow')}</MenuItem>
            </Select>
          </FormControl>

          <Button
            onClick={handleResetFilters}
            startIcon={<RefreshIcon />}
            variant="outlined"
            size="small"
            sx={{
              borderColor: alpha(gold, 0.4),
              color: goldDark,
              fontSize: '0.72rem',
              fontFamily: '"Cinzel", serif',
              letterSpacing: '0.1em',
              '&:hover': {
                borderColor: gold,
                backgroundColor: alpha(gold, 0.07),
                color: goldDark,
              },
            }}
          >
            {t('shop.resetFilters')}
          </Button>
        </Box>

        {/* Products Grid */}
        {sortedProducts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: '1.2rem',
                color: textMuted,
              }}
            >
              {t('shop.noProducts')}
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={2.5}>
              {sortedProducts.map((item) => (
                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={item._id}>
                  <Product item={item} />
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {(hasPrev || hasNext) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 6 }}>
                <Button
                  disabled={!hasPrev}
                  onClick={() => { setCurrentPage((p) => p - 1); window.scrollTo(0, 0); }}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: alpha(gold, hasPrev ? 0.4 : 0.15),
                    color: hasPrev ? goldDark : textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.72rem',
                    letterSpacing: '0.1em',
                    backgroundColor: '#FFFFFF',
                    '&:hover': { borderColor: gold, backgroundColor: alpha(gold, 0.07), color: goldDark },
                    '&.Mui-disabled': { color: textMuted, borderColor: alpha(gold, 0.12) },
                  }}
                >
                  {t('shop.prevPage') || 'Previous'}
                </Button>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', color: goldDark, letterSpacing: '0.1em' }}>
                  {currentPage}
                </Typography>
                <Button
                  disabled={!hasNext}
                  onClick={() => { setCurrentPage((p) => p + 1); window.scrollTo(0, 0); }}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: alpha(gold, hasNext ? 0.4 : 0.15),
                    color: hasNext ? goldDark : textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.72rem',
                    letterSpacing: '0.1em',
                    backgroundColor: '#FFFFFF',
                    '&:hover': { borderColor: gold, backgroundColor: alpha(gold, 0.07), color: goldDark },
                    '&.Mui-disabled': { color: textMuted, borderColor: alpha(gold, 0.12) },
                  }}
                >
                  {t('shop.nextPage') || 'Next'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default Shop;

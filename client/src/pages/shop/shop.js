import React, { useState, useEffect } from 'react';
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
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { gold, goldLight, goldDark, darkBg, goldGradientText } from '../../theme';

const Shop = () => {
  const { t } = useTranslation();
  const { getTotalCartQuantity } = useShopContext();
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => Number(localStorage.getItem('currentPage')) || 1);
  const [sortOrder, setSortOrder] = useState(localStorage.getItem('sortOrder') || 'rateDesc');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(localStorage.getItem('searchQuery') || '');
  const itemsPerPage = 15;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await axios.get('https://nazareth-holy-cross-c5896e0462c5.herokuapp.com/product/getAllProducts');
        window.scrollTo(0, 0);
        setAllProducts(res.data);
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

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <LoadingLogo />;

  return (
    <Box sx={{ minHeight: '80vh', py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.8rem' },
              ...goldGradientText,
              mb: 1,
            }}
          >
            {t('navbar.shop') || 'Sacred Shop'}
          </Typography>
          <Box sx={{ width: 60, height: 2, mx: 'auto', background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
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
            background: `linear-gradient(145deg, ${alpha('#1A1215', 0.8)} 0%, ${alpha('#0D0810', 0.9)} 100%)`,
            border: `1px solid ${alpha(gold, 0.12)}`,
            borderRadius: '10px',
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
                color: goldLight,
                fontSize: '0.85rem',
                '& fieldset': { borderColor: alpha(gold, 0.2) },
                '&:hover fieldset': { borderColor: alpha(gold, 0.4) },
                '&.Mui-focused fieldset': { borderColor: gold },
              },
              '& .MuiInputLabel-root': { color: alpha(goldLight, 0.5) },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: alpha(gold, 0.5), fontSize: '1rem' }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ color: alpha(goldLight, 0.5), fontSize: '0.85rem' }}>Sort</InputLabel>
            <Select
              value={sortOrder}
              label="Sort"
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
              sx={{
                color: goldLight,
                fontSize: '0.85rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.2) },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(gold, 0.4) },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: gold },
                '& .MuiSvgIcon-root': { color: alpha(goldLight, 0.6) },
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
              borderColor: alpha(gold, 0.25),
              color: alpha(goldLight, 0.6),
              fontSize: '0.72rem',
              fontFamily: '"Cinzel", serif',
              letterSpacing: '0.1em',
              '&:hover': {
                borderColor: alpha(gold, 0.5),
                backgroundColor: alpha(gold, 0.06),
                color: goldLight,
              },
            }}
          >
            {t('shop.resetFilters')}
          </Button>
        </Box>

        {/* Products Grid */}
        {paginatedProducts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontSize: '1.2rem',
                color: alpha(goldLight, 0.4),
              }}
            >
              {t('shop.noProducts')}
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={2.5}>
              {paginatedProducts.map((item) => (
                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={item._id}>
                  <Product item={item} />
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => { setCurrentPage(page); window.scrollTo(0, 0); }}
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: alpha(goldLight, 0.6),
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.75rem',
                      border: `1px solid ${alpha(gold, 0.15)}`,
                      '&:hover': { backgroundColor: alpha(gold, 0.1), borderColor: alpha(gold, 0.4) },
                      '&.Mui-selected': {
                        backgroundColor: alpha(gold, 0.2),
                        color: gold,
                        borderColor: alpha(gold, 0.5),
                        '&:hover': { backgroundColor: alpha(gold, 0.28) },
                      },
                    },
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default Shop;

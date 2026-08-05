import React, { useState, useEffect } from 'react';
import { useShopContext } from '../../context/shop-context';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import CardItem from '../../components/CardItem';
import api from '../../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../../theme';

const PAGE_SIZE = 12;

export default function Shop() {
  const { t } = useTranslation();
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => Number(localStorage.getItem('currentPage')) || 1);
  const [sortOrder,   setSortOrder]   = useState(localStorage.getItem('sortOrder') || 'rateDesc');
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState(localStorage.getItem('searchQuery') || '');

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/product/getNProducts?page=1&size=200`);
        setAllProducts(Array.isArray(data) ? data : data.data || data.products || []);
      } catch { setAllProducts([]); } finally { setLoading(false); }
    };
    fetchProducts();
  }, []);

  const sorted = [...allProducts]
    .filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'priceAsc') return a.price - b.price;
      if (sortOrder === 'priceDesc') return b.price - a.price;
      if (sortOrder === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
      return (b.rating || 0) - (a.rating || 0); // rateDesc default
    });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    localStorage.setItem('searchQuery', e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (e) => {
    setSortOrder(e.target.value);
    localStorage.setItem('sortOrder', e.target.value);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSortOrder('rateDesc');
    setCurrentPage(1);
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('sortOrder');
  };

  return (
    <Box sx={{ backgroundColor: '#F7F2E8', minHeight: '80vh' }}>
      {/* Header */}
      <Box sx={{
        position: 'relative', py: { xs: 10, md: 14 },
        background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 50%, #1C0E06 100%)',
        textAlign: 'center', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to bottom, transparent, #F7F2E8)' },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <StorefrontOutlinedIcon sx={{ color: gold, fontSize: '2rem', mb: 1, display: 'block', mx: 'auto' }} />
          <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.35em', color: alpha(gold, 0.7), textTransform: 'uppercase', mb: 2 }}>
            Sacred Items from Nazareth
          </Typography>
          <Typography variant="h1" sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: { xs: '2rem', md: '3rem' }, ...goldGradientText }}>
            {t('common.shop') || 'Sacred Shop'}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 }, px: { xs: 2, sm: 3 } }}>
        {/* Filter Bar */}
        <Box
          sx={{
            display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 5,
            p: { xs: 2, md: 3 }, backgroundColor: '#FFFFFF', borderRadius: '12px',
            border: `1px solid ${alpha(gold, 0.18)}`,
            boxShadow: `0 2px 12px ${alpha('#8A6107', 0.07)}`,
            position: 'sticky', top: { xs: 64, md: 72 }, zIndex: 10,
          }}
        >
          <TextField
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search products..."
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1rem', color: alpha(goldDark, 0.5) }} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem' }}>Sort by</InputLabel>
            <Select value={sortOrder} onChange={handleSort} label="Sort by">
              <MenuItem value="rateDesc">Best Rated</MenuItem>
              <MenuItem value="priceAsc">Price: Low → High</MenuItem>
              <MenuItem value="priceDesc">Price: High → Low</MenuItem>
              <MenuItem value="nameAsc">Name A–Z</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em', borderColor: alpha(gold, 0.35), color: goldDark, whiteSpace: 'nowrap' }}
          >
            Reset
          </Button>
          <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.78rem', color: textSecondary, ml: 'auto', whiteSpace: 'nowrap' }}>
            {sorted.length} item{sorted.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {/* Products grid */}
        <Grid container spacing={3}>
          {loading
            ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
                  <Skeleton variant="rectangular" height={380} sx={{ borderRadius: '12px' }} />
                </Grid>
              ))
            : paginated.map(product => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product._id}>
                  <CardItem product={product} />
                </Grid>
              ))
          }
          {!loading && paginated.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <StorefrontOutlinedIcon sx={{ fontSize: '3rem', color: alpha(gold, 0.35), mb: 2 }} />
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '1rem', color: goldDark }}>
                  No products found. Try a different search.
                </Typography>
                <Button variant="outlined" onClick={handleReset} sx={{ mt: 3, fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.12em', borderColor: alpha(gold, 0.4), color: goldDark }}>
                  Clear Search
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, v) => { setCurrentPage(v); localStorage.setItem('currentPage', v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              shape="rounded"
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}

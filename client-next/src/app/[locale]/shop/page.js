'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Grid, Typography, TextField, Select, MenuItem,
  FormControl, InputLabel, InputAdornment, IconButton, Chip, Stack,
  Button, Skeleton, Pagination, Collapse, useMediaQuery, useTheme,
  Paper, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import api from '@/lib/api';
import { colors } from '@/lib/theme';
import ProductCard from '@/components/ProductCard';

const ITEMS_PER_PAGE = 20;

const CATEGORIES = [
  'All', 'Crosses', 'Jewelry', 'Art', 'Holy Water', 'Olive Wood',
  'Sand', 'Candles', 'Paintings', 'Clothing', 'Books', 'Other',
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'newest', label: 'Newest First' },
];

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await api.get('/product/getNProducts?limit=200');
        const data = res.data?.products || res.data || [];
        setProducts(data);
        setFilteredProducts(data);
      } catch (e) {
        console.error('Failed to fetch products:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const applyFilters = useCallback(() => {
    let result = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }
    if (category !== 'All') {
      result = result.filter((p) => p.category === category);
    }
    switch (sort) {
      case 'price_asc': result.sort((a, b) => a.price - b.price); break;
      case 'price_desc': result.sort((a, b) => b.price - a.price); break;
      case 'name_asc': result.sort((a, b) => a.name?.localeCompare(b.name)); break;
      case 'newest': result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }
    setFilteredProducts(result);
    setPage(1);
  }, [products, search, category, sort]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const paginatedProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setSearch('');
    setCategory('All');
    setSort('default');
  };

  const activeFilterCount = (search ? 1 : 0) + (category !== 'All' ? 1 : 0) + (sort !== 'default' ? 1 : 0);

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Page Header */}
      <Box
        sx={{
          py: { xs: 6, md: 10 },
          background: 'linear-gradient(160deg, #1C0E06 0%, #2C1810 100%)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.8rem' },
              color: '#F7F2E8',
              mb: 1,
            }}
          >
            Sacred Shop
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Playfair Display, serif',
              fontStyle: 'italic',
              color: 'rgba(247,242,232,0.7)',
              fontSize: '1.1rem',
              mb: 0,
            }}
          >
            Authentic goods from the Holy Land of Nazareth
          </Typography>
          <Box
            sx={{
              width: 60,
              height: 3,
              background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
              mx: 'auto',
              mt: 2,
            }}
          />
        </Container>
      </Box>

      {/* Sticky Filter Bar */}
      <Paper
        elevation={2}
        sx={{
          position: 'sticky',
          top: { xs: 64, md: 72 },
          zIndex: 100,
          backgroundColor: 'rgba(247,242,232,0.97)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ py: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <TextField
              placeholder="Search sacred goods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 240 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: colors.textMuted, fontSize: '1.1rem' }} />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
            />

            {/* Sort */}
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sort}
                label="Sort By"
                onChange={(e) => setSort(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Filter toggle on mobile */}
            {isMobile && (
              <Button
                startIcon={<TuneIcon />}
                onClick={() => setFiltersOpen(!filtersOpen)}
                variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
                size="small"
                sx={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '0.7rem',
                  ...(activeFilterCount > 0
                    ? { background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208' }
                    : { borderColor: colors.gold, color: colors.goldDark }),
                }}
              >
                Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </Button>
            )}

            {/* Category chips — shown on desktop or when filters open on mobile */}
            {(!isMobile || filtersOpen) && (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} sx={{ gap: 0.75 }}>
                {CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    onClick={() => setCategory(cat)}
                    size="small"
                    variant={category === cat ? 'filled' : 'outlined'}
                    sx={{
                      fontFamily: 'Lato, sans-serif',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      ...(category === cat
                        ? {
                            backgroundColor: colors.gold,
                            color: '#1C1208',
                            borderColor: colors.gold,
                          }
                        : {
                            borderColor: 'rgba(201,168,76,0.4)',
                            color: colors.textSecondary,
                            '&:hover': { borderColor: colors.gold, color: colors.goldDark },
                          }),
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <Button
                size="small"
                onClick={handleClearFilters}
                startIcon={<ClearIcon />}
                sx={{ color: colors.textMuted, fontFamily: 'Lato, sans-serif', fontSize: '0.75rem' }}
              >
                Clear
              </Button>
            )}

            <Box sx={{ ml: 'auto' }}>
              <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted }}>
                {filteredProducts.length} items
              </Typography>
            </Box>
          </Box>
        </Container>
      </Paper>

      {/* Products Grid */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {loading ? (
          <Grid container spacing={2.5}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Grid xs={6} sm={4} md={3} lg={2.4} key={i}>
                <ProductCard loading />
              </Grid>
            ))}
          </Grid>
        ) : paginatedProducts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Typography sx={{ fontSize: '4rem', mb: 2 }}>🔍</Typography>
            <Typography
              sx={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: colors.textPrimary, mb: 1 }}
            >
              No products found
            </Typography>
            <Typography sx={{ color: colors.textMuted, mb: 3 }}>
              Try adjusting your search or filters
            </Typography>
            <Button onClick={handleClearFilters} variant="outlined" sx={{ borderColor: colors.gold, color: colors.goldDark }}>
              Clear Filters
            </Button>
          </Box>
        ) : (
          <>
            <Grid container spacing={2.5}>
              {paginatedProducts.map((product) => (
                <Grid xs={6} sm={4} md={3} lg={2.4} key={product._id}>
                  <ProductCard product={product} />
                </Grid>
              ))}
            </Grid>

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    '& .MuiPaginationItem-root': {
                      fontFamily: 'Cinzel, serif',
                      color: colors.textSecondary,
                    },
                    '& .Mui-selected': {
                      backgroundColor: `${colors.gold} !important`,
                      color: '#1C1208',
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
}

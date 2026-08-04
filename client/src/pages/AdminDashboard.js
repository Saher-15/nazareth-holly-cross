import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Typography, AppBar, Toolbar, IconButton, Button, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Card, CardContent, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Alert, Snackbar,
  CircularProgress, Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import FavoriteIcon from '@mui/icons-material/Favorite';

const DRAWER_WIDTH = 240;
const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { key: 'prayers', label: 'Prayers', icon: <AutoAwesomeIcon /> },
  { key: 'candles', label: 'Candles', icon: <WbSunnyIcon /> },
  { key: 'products', label: 'Products', icon: <ShoppingBagIcon /> },
];

const PRODUCT_CATEGORIES = ['Jewelry', 'Rosaries', 'Icons', 'Olive Wood', 'Candles', 'Wellness', 'Sacred', 'Books', 'Food'];

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('adminToken')}` };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [prayers, setPrayers] = useState([]);
  const [candles, setCandles] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Product dialog state
  const [productDialog, setProductDialog] = useState({ open: false, mode: 'add', data: null });
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '', description: '', badge: '', imageUrl: '', inStock: true });

  const username = localStorage.getItem('adminUsername') || 'Admin';

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/stats', { headers: authHeader() });
      setStats(data);
    } catch {
      handleAuthError();
    }
  }, []);

  const fetchPrayers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/admin/prayers', { headers: authHeader() });
      setPrayers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/admin/candles', { headers: authHeader() });
      setCandles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/admin/products', { headers: authHeader() });
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleAuthError() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin/login');
      return;
    }
    fetchStats();
  }, [fetchStats, navigate]);

  useEffect(() => {
    if (tab === 'prayers') fetchPrayers();
    if (tab === 'candles') fetchCandles();
    if (tab === 'products') fetchProducts();
  }, [tab, fetchPrayers, fetchCandles, fetchProducts]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    navigate('/admin/login');
  };

  const deletePrayer = async (id) => {
    if (!window.confirm('Delete this prayer?')) return;
    await axios.delete(`/api/admin/prayers/${id}`, { headers: authHeader() });
    setPrayers((prev) => prev.filter((p) => p._id !== id));
    fetchStats();
    showSnack('Prayer deleted');
  };

  const deleteCandle = async (id) => {
    if (!window.confirm('Delete this candle?')) return;
    await axios.delete(`/api/admin/candles/${id}`, { headers: authHeader() });
    setCandles((prev) => prev.filter((c) => c._id !== id));
    fetchStats();
    showSnack('Candle deleted');
  };

  const openAddProduct = () => {
    setProductForm({ name: '', price: '', category: '', description: '', badge: '', imageUrl: '', inStock: true });
    setProductDialog({ open: true, mode: 'add', data: null });
  };

  const openEditProduct = (product) => {
    setProductForm({
      name: product.name,
      price: product.price,
      category: product.category,
      description: product.description || '',
      badge: product.badge || '',
      imageUrl: product.imageUrl || '',
      inStock: product.inStock !== false,
    });
    setProductDialog({ open: true, mode: 'edit', data: product });
  };

  const saveProduct = async () => {
    try {
      const payload = { ...productForm, price: Number(productForm.price) };
      if (productDialog.mode === 'add') {
        const { data } = await axios.post('/api/admin/products', payload, { headers: authHeader() });
        setProducts((prev) => [data, ...prev]);
        showSnack('Product added');
      } else {
        const { data } = await axios.put(`/api/admin/products/${productDialog.data._id}`, payload, { headers: authHeader() });
        setProducts((prev) => prev.map((p) => (p._id === data._id ? data : p)));
        showSnack('Product updated');
      }
      setProductDialog({ open: false, mode: 'add', data: null });
      fetchStats();
    } catch (err) {
      showSnack(err.response?.data?.error || 'Save failed', 'error');
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await axios.delete(`/api/admin/products/${id}`, { headers: authHeader() });
    setProducts((prev) => prev.filter((p) => p._id !== id));
    fetchStats();
    showSnack('Product deleted');
  };

  const statCards = stats
    ? [
        { label: 'Prayers', value: stats.prayers, icon: <AutoAwesomeIcon />, color: '#7B68EE' },
        { label: 'Candles Lit', value: stats.candles, icon: <WbSunnyIcon />, color: '#FF8C00' },
        { label: 'Products', value: stats.products, icon: <ShoppingBagIcon />, color: '#2E8B57' },
        { label: 'Total Likes', value: stats.totalLikes, icon: <FavoriteIcon />, color: '#DC143C' },
      ]
    : [];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F5F5F5' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #2A1005 0%, #8B4513 100%)',
            color: '#fff',
          },
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography variant="h6" fontWeight={700} color="#DAA520">
            ✝ Admin Panel
          </Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.6)">
            Nazareth Holy Cross
          </Typography>
        </Box>
        <List sx={{ pt: 1 }}>
          {TABS.map((t) => (
            <ListItemButton
              key={t.key}
              selected={tab === t.key}
              onClick={() => setTab(t.key)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 2,
                color: 'rgba(255,255,255,0.85)',
                '&.Mui-selected': { bgcolor: 'rgba(218,165,32,0.25)', color: '#DAA520' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{t.icon}</ListItemIcon>
              <ListItemText primary={t.label} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ mt: 'auto', p: 2 }}>
          <Typography variant="caption" color="rgba(255,255,255,0.5)">
            Signed in as <b>{username}</b>
          </Typography>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#fff', color: 'text.primary', borderBottom: '1px solid #E0E0E0' }}>
          <Toolbar>
            <Typography variant="h6" fontWeight={700} sx={{ flex: 1, color: '#8B4513' }}>
              {TABS.find((t) => t.key === tab)?.label}
            </Typography>
            <Button
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              color="inherit"
              size="small"
            >
              Logout
            </Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3, flex: 1 }}>
          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <Box>
              <Typography variant="h5" fontWeight={700} mb={3} color="#2A1005">
                Welcome back, {username}
              </Typography>
              <Grid container spacing={3} mb={4}>
                {statCards.map((card) => (
                  <Grid item xs={12} sm={6} md={3} key={card.label}>
                    <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            bgcolor: card.color + '22',
                            borderRadius: 2,
                            p: 1.5,
                            color: card.color,
                            display: 'flex',
                          }}
                        >
                          {card.icon}
                        </Box>
                        <Box>
                          <Typography variant="h4" fontWeight={800}>
                            {card.value}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {card.label}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Use the sidebar to manage prayers, candles, and products. All data is persisted in MongoDB.
              </Alert>
            </Box>
          )}

          {/* PRAYERS */}
          {tab === 'prayers' && (
            <Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#2A1005' }}>
                      <TableRow>
                        {['Name', 'Country', 'Category', 'Likes', 'Prayer', 'Date', 'Actions'].map((h) => (
                          <TableCell key={h} sx={{ color: '#DAA520', fontWeight: 700 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {prayers.map((p) => (
                        <TableRow key={p._id} hover>
                          <TableCell><b>{p.name}</b></TableCell>
                          <TableCell>{p.country}</TableCell>
                          <TableCell>
                            <Chip label={p.category} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <FavoriteIcon sx={{ fontSize: 14, color: '#DC143C' }} />
                              {p.likes}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="body2" noWrap title={p.prayer}>{p.prayer}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Delete">
                              <IconButton color="error" size="small" onClick={() => deletePrayer(p._id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {prayers.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No prayers found
                    </Box>
                  )}
                </TableContainer>
              )}
            </Box>
          )}

          {/* CANDLES */}
          {tab === 'candles' && (
            <Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#2A1005' }}>
                      <TableRow>
                        {['Name', 'Country', 'Type', 'Duration', 'Dedication', 'Date', 'Actions'].map((h) => (
                          <TableCell key={h} sx={{ color: '#DAA520', fontWeight: 700 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {candles.map((c) => (
                        <TableRow key={c._id} hover>
                          <TableCell><b>{c.name}</b></TableCell>
                          <TableCell>{c.country}</TableCell>
                          <TableCell>
                            <Chip label={c.type} size="small" sx={{ bgcolor: '#DAA52033', color: '#8B4513' }} />
                          </TableCell>
                          <TableCell>{c.duration}</TableCell>
                          <TableCell sx={{ maxWidth: 240 }}>
                            <Typography variant="body2" noWrap title={c.dedication}>{c.dedication}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Delete">
                              <IconButton color="error" size="small" onClick={() => deleteCandle(c._id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {candles.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No candles found
                    </Box>
                  )}
                </TableContainer>
              )}
            </Box>
          )}

          {/* PRODUCTS */}
          {tab === 'products' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAddProduct}>
                  Add Product
                </Button>
              </Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#2A1005' }}>
                      <TableRow>
                        {['Name', 'Price', 'Category', 'Badge', 'In Stock', 'Actions'].map((h) => (
                          <TableCell key={h} sx={{ color: '#DAA520', fontWeight: 700 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p._id} hover>
                          <TableCell><b>{p.name}</b></TableCell>
                          <TableCell>${p.price}</TableCell>
                          <TableCell>{p.category}</TableCell>
                          <TableCell>
                            {p.badge ? <Chip label={p.badge} size="small" color="secondary" /> : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={p.inStock ? 'In Stock' : 'Out of Stock'}
                              size="small"
                              color={p.inStock ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit">
                              <IconButton size="small" color="primary" onClick={() => openEditProduct(p)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => deleteProduct(p._id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {products.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      No products found
                    </Box>
                  )}
                </TableContainer>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Product Dialog */}
      <Dialog open={productDialog.open} onClose={() => setProductDialog({ open: false, mode: 'add', data: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{productDialog.mode === 'add' ? 'Add Product' : 'Edit Product'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            <TextField label="Price ($)" type="number" fullWidth required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>
                {PRODUCT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Description" fullWidth multiline rows={2} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            <TextField label="Badge (optional, e.g. Bestseller)" fullWidth value={productForm.badge} onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })} />
            <TextField label="Image URL" fullWidth value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} />
            <FormControl fullWidth>
              <InputLabel>Stock Status</InputLabel>
              <Select label="Stock Status" value={productForm.inStock} onChange={(e) => setProductForm({ ...productForm, inStock: e.target.value })}>
                <MenuItem value={true}>In Stock</MenuItem>
                <MenuItem value={false}>Out of Stock</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProductDialog({ open: false, mode: 'add', data: null })}>Cancel</Button>
          <Button variant="contained" onClick={saveProduct}>
            {productDialog.mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

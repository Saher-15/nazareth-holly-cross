'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Container, Grid, Typography, Paper, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider,
  useMediaQuery, useTheme, Stack, Chip, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PeopleIcon from '@mui/icons-material/People';
import StarIcon from '@mui/icons-material/Star';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { colors } from '@/lib/theme';
import api from '@/lib/api';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'products', label: 'Products', icon: <ShoppingBagIcon /> },
  { id: 'candles', label: 'Candle Orders', icon: <LocalFireDepartmentIcon /> },
  { id: 'orders', label: 'Shop Orders', icon: <PeopleIcon /> },
  { id: 'reviews', label: 'Reviews', icon: <StarIcon /> },
];

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState({ products: 0, candles: 0, orders: 0, reviews: 0 });
  const [products, setProducts] = useState([]);
  const [productDialog, setProductDialog] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', category: '', description: '', imageUrl: '', colors: '' });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const router = useRouter();
  const locale = useLocale();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push(`/${locale}/admin/login`);
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes] = await Promise.allSettled([
        api.get('/product/getNProducts?limit=100'),
      ]);
      if (prodRes.status === 'fulfilled') {
        const prods = prodRes.value.data?.products || prodRes.value.data || [];
        setProducts(prods);
        setStats((s) => ({ ...s, products: prods.length }));
      }
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    router.push(`/${locale}/admin/login`);
  };

  const handleProductSave = async () => {
    try {
      const data = {
        ...productForm,
        price: parseFloat(productForm.price),
        colors: productForm.colors ? productForm.colors.split(',').map((c) => c.trim()) : [],
      };
      if (editProduct) {
        await api.put(`/product/updateProduct/${editProduct._id}`, data);
      } else {
        await api.post('/product/addProduct', data);
      }
      setSnack({ open: true, message: editProduct ? 'Product updated!' : 'Product added!', severity: 'success' });
      setProductDialog(false);
      setEditProduct(null);
      setProductForm({ name: '', price: '', category: '', description: '', imageUrl: '', colors: '' });
      fetchData();
    } catch (e) {
      setSnack({ open: true, message: 'Operation failed.', severity: 'error' });
    }
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setProductForm({
      name: product.name || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      colors: product.colors?.join(', ') || '',
    });
    setProductDialog(true);
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
        <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.9rem', color: colors.textPrimary }}>
          Admin Panel
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, fontStyle: 'italic' }}>
          Nazareth Holy Cross
        </Typography>
      </Box>
      <List sx={{ flexGrow: 1, py: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              selected={activeSection === item.id}
              onClick={() => { setActiveSection(item.id); setMobileOpen(false); }}
              sx={{
                py: 1.5,
                '&.Mui-selected': { backgroundColor: 'rgba(201,168,76,0.1)', borderRight: `3px solid ${colors.gold}` },
              }}
            >
              <ListItemIcon sx={{ color: activeSection === item.id ? colors.goldDark : colors.textMuted, minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontFamily: 'Lato, sans-serif',
                  fontWeight: activeSection === item.id ? 700 : 400,
                  fontSize: '0.875rem',
                  color: activeSection === item.id ? colors.goldDark : colors.textSecondary,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ py: 1.5 }}>
            <ListItemIcon sx={{ color: colors.crimson, minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontFamily: 'Lato, sans-serif', fontSize: '0.875rem', color: colors.crimson }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: DRAWER_WIDTH, border: 'none' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              border: 'none',
              borderRight: '1px solid rgba(201,168,76,0.15)',
              position: 'relative',
              height: 'auto',
            },
          }}
          sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, overflowX: 'hidden' }}>
        {isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 1.5 }}>
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: colors.textPrimary }}>
              Admin Panel
            </Typography>
          </Box>
        )}

        {/* Dashboard */}
        {activeSection === 'dashboard' && (
          <Box>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.3rem', color: colors.textPrimary, mb: 3 }}>
              Dashboard
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {[
                { label: 'Products', value: stats.products || products.length, icon: '🛒', color: colors.gold },
                { label: 'Candle Orders', value: stats.candles, icon: '🕯', color: colors.crimson },
                { label: 'Shop Orders', value: stats.orders, icon: '📦', color: '#1565C0' },
                { label: 'Reviews', value: stats.reviews, icon: '⭐', color: '#2E7D32' },
              ].map(({ label, value, icon, color }) => (
                <Grid xs={6} md={3} key={label}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: { xs: 2, md: 3 },
                      border: '1px solid rgba(201,168,76,0.12)',
                      borderTop: `3px solid ${color}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography sx={{ fontSize: '2rem', mb: 1 }}>{icon}</Typography>
                    <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, color: colors.textPrimary, lineHeight: 1 }}>
                      {value}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted, mt: 0.5 }}>{label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
            <Typography sx={{ color: colors.textMuted, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
              Welcome to the Nazareth Holy Cross admin panel. Use the sidebar to manage your content.
            </Typography>
          </Box>
        )}

        {/* Products */}
        {activeSection === 'products' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary }}>
                Products ({products.length})
              </Typography>
              <Button
                onClick={() => { setEditProduct(null); setProductForm({ name: '', price: '', category: '', description: '', imageUrl: '', colors: '' }); setProductDialog(true); }}
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}
              >
                Add Product
              </Button>
            </Box>
            <TableContainer component={Paper} elevation={1} sx={{ border: '1px solid rgba(201,168,76,0.12)', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: colors.surface }}>
                    {['Name', 'Category', 'Price', 'Colors', 'Actions'].map((h) => (
                      <TableCell key={h} sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product._id} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', color: colors.textPrimary }}>{product.name}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: colors.textMuted }}>{product.category || '—'}</TableCell>
                      <TableCell sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: colors.goldDark }}>${product.price}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: colors.textMuted }}>{product.colors?.join(', ') || '—'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => openEdit(product)} sx={{ color: colors.goldDark }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Other sections placeholder */}
        {['candles', 'orders', 'reviews'].includes(activeSection) && (
          <Box>
            <Typography sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.2rem', color: colors.textPrimary, mb: 2, textTransform: 'capitalize' }}>
              {activeSection}
            </Typography>
            <Paper elevation={1} sx={{ p: 4, border: '1px solid rgba(201,168,76,0.12)', borderRadius: 2, textAlign: 'center' }}>
              <Typography sx={{ color: colors.textMuted, fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>
                Data from the API will be displayed here. Connect your backend to view {activeSection}.
              </Typography>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Product Dialog */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontFamily: 'Cinzel, serif', fontWeight: 700, color: colors.textPrimary }}>
          {editProduct ? 'Edit Product' : 'Add Product'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth label="Product Name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
            <Grid container spacing={2}>
              <Grid xs={6}>
                <TextField fullWidth label="Price ($)" type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
              </Grid>
              <Grid xs={6}>
                <TextField fullWidth label="Category" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} />
              </Grid>
            </Grid>
            <TextField fullWidth label="Image URL" value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} placeholder="https://..." />
            <TextField fullWidth label="Colors (comma-separated)" value={productForm.colors} onChange={(e) => setProductForm({ ...productForm, colors: e.target.value })} placeholder="Red, Blue, Green" />
            <TextField fullWidth multiline rows={3} label="Description" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setProductDialog(false)} sx={{ color: colors.textMuted, fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}>Cancel</Button>
          <Button onClick={handleProductSave} variant="contained" sx={{ background: 'linear-gradient(135deg, #C9A84C, #8A6107)', color: '#1C1208', fontFamily: 'Cinzel, serif' }}>
            {editProduct ? 'Update' : 'Add'} Product
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

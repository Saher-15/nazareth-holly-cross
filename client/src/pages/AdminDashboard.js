import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../api';
import { gold, goldDark, crimson, textSecondary, goldGradientText } from '../theme';

const DRAWER_WIDTH = 220;

const NAV_TABS = [
  { key: 'products',  label: 'Products',  icon: <InventoryIcon /> },
  { key: 'candles',   label: 'Candles',   icon: <LocalFireDepartmentIcon /> },
  { key: 'prayers',   label: 'Prayers',   icon: <SelfImprovementIcon /> },
  { key: 'live',      label: 'Live',      icon: <LiveTvIcon /> },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab,    setActiveTab]    = useState('products');
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [products,     setProducts]     = useState([]);
  const [candles,      setCandles]      = useState([]);
  const [prayers,      setPrayers]      = useState([]);
  const [roomId,       setRoomId]       = useState('');
  const [currentRoom,  setCurrentRoom]  = useState('');
  const [loading,      setLoading]      = useState(false);
  const [snackbar,     setSnackbar]     = useState({ open: false, message: '', severity: 'success' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, type: '' });

  const username = localStorage.getItem('adminUsername') || 'Admin';

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    navigate('/admin');
  };

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/product/getNProducts?page=1&size=200');
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch { notify('Failed to load products', 'error'); }
  }, []);

  const fetchCandles = useCallback(async () => {
    try {
      const { data } = await api.get('/candle/getCandles');
      setCandles(Array.isArray(data) ? data : []);
    } catch { setCandles([]); }
  }, []);

  const fetchPrayers = useCallback(async () => {
    try {
      const { data } = await api.get('/prayer/getPrayers');
      setPrayers(Array.isArray(data) ? data : []);
    } catch { setPrayers([]); }
  }, []);

  const fetchRoomId = useCallback(async () => {
    try {
      const { data } = await api.get('/live/room_id');
      setCurrentRoom(data?.roomId || '');
    } catch { setCurrentRoom(''); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/admin'); return; }
    fetchProducts();
    fetchCandles();
    fetchPrayers();
    fetchRoomId();
  }, [navigate, fetchProducts, fetchCandles, fetchPrayers, fetchRoomId]);

  const handleSetRoom = async () => {
    try {
      await api.post('/live/set_room', { roomId });
      setCurrentRoom(roomId);
      notify('Live room set successfully!');
    } catch { notify('Failed to set room', 'error'); }
  };

  const handleClearRoom = async () => {
    try {
      await api.post('/live/set_room', { roomId: '' });
      setCurrentRoom('');
      setRoomId('');
      notify('Live room cleared.');
    } catch { notify('Failed to clear room', 'error'); }
  };

  const confirmDelete = async () => {
    const { id, type } = deleteDialog;
    try {
      if (type === 'product') { await api.delete(`/product/deleteProduct/${id}`); fetchProducts(); }
      if (type === 'candle')  { await api.delete(`/candle/deleteCandle/${id}`);   fetchCandles(); }
      if (type === 'prayer')  { await api.delete(`/prayer/delete/${id}`);         fetchPrayers(); }
      notify(`${type} deleted.`);
    } catch { notify('Delete failed', 'error'); }
    setDeleteDialog({ open: false, id: null, type: '' });
  };

  const sidebar = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', backgroundColor: '#1C0E06', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${alpha(gold, 0.15)}` }}>
        <Box sx={{ fontSize: '1.5rem', mb: 0.5 }}>✝</Box>
        <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.72rem', color: gold, letterSpacing: '0.15em' }}>
          ADMIN PANEL
        </Typography>
        <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.7rem', color: alpha('#F7F2E8', 0.4), mt: 0.5 }}>
          {username}
        </Typography>
      </Box>
      <List sx={{ flex: 1, pt: 1 }}>
        {NAV_TABS.map(tab => (
          <ListItemButton
            key={tab.key}
            selected={activeTab === tab.key}
            onClick={() => { setActiveTab(tab.key); setMobileOpen(false); }}
            sx={{
              mx: 1, mb: 0.5, borderRadius: '8px',
              color: alpha('#F7F2E8', 0.7),
              '&.Mui-selected': { backgroundColor: alpha(gold, 0.12), color: gold },
              '&:hover': { backgroundColor: alpha(gold, 0.07), color: gold },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{tab.icon}</ListItemIcon>
            <ListItemText primary={tab.label} primaryTypographyProps={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', letterSpacing: '0.1em' }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2, borderTop: `1px solid ${alpha(gold, 0.12)}` }}>
        <Button
          fullWidth startIcon={<LogoutIcon />} onClick={handleLogout}
          sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.12em', color: alpha('#F7F2E8', 0.6), '&:hover': { color: crimson, background: alpha(crimson, 0.08) } }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F7F2E8' }}>
      {/* Desktop sidebar */}
      <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: DRAWER_WIDTH, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' } }}>
        {sidebar}
      </Drawer>

      {/* Mobile sidebar */}
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
        {sidebar}
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', ml: { md: `${DRAWER_WIDTH}px` } }}>
        <AppBar position="static" elevation={0} sx={{ backgroundColor: '#FFFFFF', borderBottom: `1px solid ${alpha(gold, 0.15)}` }}>
          <Toolbar>
            <IconButton sx={{ display: { md: 'none' }, color: textSecondary, mr: 1 }} onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '0.85rem', color: '#1C1208', letterSpacing: '0.1em' }}>
              {NAV_TABS.find(t => t.key === activeTab)?.label}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
          {/* Products Tab */}
          {activeTab === 'products' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', ...goldGradientText }}>
                  Products ({products.length})
                </Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: alpha(gold, 0.06), fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.1em', color: goldDark } }}>
                      <TableCell>Product</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Stock</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map(p => (
                      <TableRow key={p._id} sx={{ '&:hover': { backgroundColor: alpha(gold, 0.03) } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {p.images?.[0] && <Box component="img" src={p.images[0]} alt={p.name} sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '6px', border: `1px solid ${alpha(gold, 0.15)}` }} />}
                            <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: '#1C1208' }}>{p.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.82rem', color: goldDark }}>${p.price}</TableCell>
                        <TableCell>
                          <Chip label={p.stock} size="small" sx={{ backgroundColor: p.stock > 0 ? alpha('#4CAF50', 0.1) : alpha(crimson, 0.1), color: p.stock > 0 ? '#4CAF50' : crimson, fontFamily: '"Cinzel", serif', fontSize: '0.6rem' }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => setDeleteDialog({ open: true, id: p._id, type: 'product' })} sx={{ color: alpha(crimson, 0.6), '&:hover': { color: crimson } }}>
                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Candles Tab */}
          {activeTab === 'candles' && (
            <Box>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', ...goldGradientText, mb: 3 }}>
                Candle Orders ({candles.length})
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: alpha(gold, 0.06), fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.1em', color: goldDark } }}>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Prayer</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candles.map(c => (
                      <TableRow key={c._id}>
                        <TableCell sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem' }}>{c.firstname} {c.lastname}</TableCell>
                        <TableCell sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.78rem', color: textSecondary }}>{c.email}</TableCell>
                        <TableCell sx={{ fontFamily: '"Playfair Display", serif', fontSize: '0.78rem', color: textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.pray}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => setDeleteDialog({ open: true, id: c._id, type: 'candle' })} sx={{ color: alpha(crimson, 0.6), '&:hover': { color: crimson } }}>
                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Prayers Tab */}
          {activeTab === 'prayers' && (
            <Box>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', ...goldGradientText, mb: 3 }}>
                Prayer Wall ({prayers.length})
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(gold, 0.15)}`, borderRadius: '12px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { backgroundColor: alpha(gold, 0.06), fontFamily: '"Cinzel", serif', fontSize: '0.68rem', letterSpacing: '0.1em', color: goldDark } }}>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Prayer</TableCell>
                      <TableCell>Likes</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prayers.map(p => (
                      <TableRow key={p._id}>
                        <TableCell sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem' }}>{p.fullName}</TableCell>
                        <TableCell><Chip label={p.category || 'Personal'} size="small" sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem' }} /></TableCell>
                        <TableCell sx={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '0.78rem', color: textSecondary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.prayer || p.msg}</TableCell>
                        <TableCell sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.82rem', color: crimson }}>{p.likes || 0}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => setDeleteDialog({ open: true, id: p._id, type: 'prayer' })} sx={{ color: alpha(crimson, 0.6), '&:hover': { color: crimson } }}>
                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Live Tab */}
          {activeTab === 'live' && (
            <Box>
              <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', ...goldGradientText, mb: 3 }}>
                Live Stream Control
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: `1px solid ${alpha(gold, 0.18)}` }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.8rem', color: goldDark, mb: 2, letterSpacing: '0.1em' }}>
                      CURRENT ROOM
                    </Typography>
                    {currentRoom ? (
                      <Box>
                        <Chip label={`LIVE: ${currentRoom}`} sx={{ backgroundColor: alpha(crimson, 0.1), color: crimson, fontFamily: '"Cinzel", serif', fontSize: '0.7rem', mb: 2 }} />
                        <Button
                          fullWidth variant="outlined" color="error"
                          onClick={handleClearRoom}
                          sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', letterSpacing: '0.1em' }}
                        >
                          End Live Stream
                        </Button>
                      </Box>
                    ) : (
                      <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.82rem', color: textSecondary }}>
                        No active live stream.
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: `1px solid ${alpha(gold, 0.18)}` }}>
                    <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.8rem', color: goldDark, mb: 2, letterSpacing: '0.1em' }}>
                      START NEW LIVE
                    </Typography>
                    <TextField
                      fullWidth
                      label="Room ID (e.g. NazarethHolyCross2026)"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                    <Button
                      fullWidth variant="contained"
                      disabled={!roomId}
                      onClick={handleSetRoom}
                      startIcon={<LiveTvIcon />}
                      sx={{ background: `linear-gradient(135deg, ${crimson} 0%, #C02020 100%)`, color: '#FFFFFF', '&:hover': { boxShadow: `0 6px 20px ${alpha(crimson, 0.45)}` } }}
                    >
                      Go Live
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, type: '' })} PaperProps={{ sx: { borderRadius: '12px', border: `1px solid ${alpha(gold, 0.2)}` } }}>
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.9rem' }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: '"Lato", sans-serif', fontSize: '0.88rem' }}>
            Are you sure you want to delete this {deleteDialog.type}? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null, type: '' })} sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem', color: textSecondary }}>Cancel</Button>
          <Button onClick={confirmDelete} variant="contained" color="error" sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.65rem' }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

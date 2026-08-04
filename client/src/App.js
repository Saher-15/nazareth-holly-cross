import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ShopContextProvider from './context/shop-context';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReactGA from 'react-ga4';
import theme, { gold } from './theme';

// Pages
const Home             = lazy(() => import('./pages/Home'));
const About            = lazy(() => import('./pages/About'));
const Contact          = lazy(() => import('./pages/Contact'));
const Reviews          = lazy(() => import('./pages/Reviews'));
const Live             = lazy(() => import('./pages/Live'));
const Candle           = lazy(() => import('./pages/Candle'));
const PrayerWall       = lazy(() => import('./pages/PrayerWall'));
const NazarethTour     = lazy(() => import('./pages/NazarethTour'));

// Gallery pages
const LatinChurch      = lazy(() => import('./pages/LatinChurch'));
const GreekChurch      = lazy(() => import('./pages/GreekChurch'));
const MarysWell        = lazy(() => import('./pages/MarysWell'));
const OldNazareth      = lazy(() => import('./pages/OldNazareth'));
const Nazareth         = lazy(() => import('./pages/Nazareth'));

// Shop
const Shop             = lazy(() => import('./pages/shop/shop'));
const ProductPage      = lazy(() => import('./pages/shop/ProductPage'));

// Cart & checkout
const Cart             = lazy(() => import('./pages/cart/cart'));
const CheckOut         = lazy(() => import('./pages/CheckOut'));
const CheckOutCandle   = lazy(() => import('./pages/CheckOutCandle'));
const CheckOutDonation = lazy(() => import('./pages/CheckOutDonation'));

// Admin
const AdminLogin     = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const PageLoader = () => (
  <Box
    sx={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    }}
  >
    <CircularProgress size={48} thickness={2} sx={{ color: gold }} />
  </Box>
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function GATracker() {
  const location = useLocation();
  useEffect(() => {
    ReactGA.initialize('G-VE42K6WP4H');
  }, []);
  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: location.pathname });
  }, [location]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ShopContextProvider>
        <ErrorBoundary>
          <ScrollToTop />
          <GATracker />
          <ToastContainer position="bottom-right" theme="light" />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Main layout routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="live" element={<Live />} />
                <Route path="candle" element={<Candle />} />
                <Route path="prayer-wall" element={<PrayerWall />} />
                <Route path="tour" element={<NazarethTour />} />
                {/* Gallery */}
                <Route path="gallery/latin" element={<LatinChurch />} />
                <Route path="gallery/greek" element={<GreekChurch />} />
                <Route path="gallery/maryswell" element={<MarysWell />} />
                <Route path="gallery/old-city" element={<OldNazareth />} />
                <Route path="gallery/nazareth" element={<Nazareth />} />
                {/* Legacy gallery routes (backward compat) */}
                <Route path="latin" element={<LatinChurch />} />
                <Route path="greek" element={<GreekChurch />} />
                <Route path="maryswell" element={<MarysWell />} />
                <Route path="oldcity" element={<OldNazareth />} />
                <Route path="city" element={<Nazareth />} />
                {/* Shop */}
                <Route path="shop" element={<Shop />} />
                <Route path="shop/:id" element={<ProductPage />} />
                <Route path="product/:id" element={<ProductPage />} />
                {/* Cart & Checkout */}
                <Route path="cart" element={<Cart />} />
                <Route path="checkout" element={<CheckOut />} />
                <Route path="checkout/candle" element={<CheckOutCandle />} />
                <Route path="checkout/donation" element={<CheckOutDonation />} />
                {/* Legacy checkout routes */}
                <Route path="checkoutcandle" element={<CheckOutCandle />} />
                <Route path="checkoutdonation" element={<CheckOutDonation />} />
              </Route>
              {/* Admin (no layout) */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </ShopContextProvider>
    </ThemeProvider>
  );
}

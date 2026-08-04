import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ShopContextProvider from './context/shop-context';
import ReactGA from 'react-ga4';
import { gold } from './theme';

// Pages
const Home             = lazy(() => import('./pages/Home'));
const About            = lazy(() => import('./pages/About'));
const Contact          = lazy(() => import('./pages/Contact'));
const Reviews          = lazy(() => import('./pages/Reviews'));
const Live             = lazy(() => import('./pages/Live'));
const Candle           = lazy(() => import('./pages/Candle'));
const NazarethTour     = lazy(() => import('./pages/NazarethTour'));

// Place / gallery pages
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
const AdminLogin     = lazy(() => import('./pages/AdminLogin.js'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.js'));

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
    <Typography
      variant="overline"
      sx={{
        color: gold,
        letterSpacing: '0.3em',
        fontSize: '0.7rem',
        animation: 'pulse 2s ease-in-out infinite',
        '@keyframes pulse': {
          '0%, 100%': { opacity: 0.5 },
          '50%': { opacity: 1 },
        },
      }}
    >
      Loading
    </Typography>
  </Box>
);

const routes = [
  { path: '/',                 element: <Home /> },
  { path: '/about',            element: <About /> },
  { path: '/contact',          element: <Contact /> },
  { path: '/live',             element: <Live /> },
  { path: '/candle',           element: <Candle /> },
  { path: '/reviews',          element: <Reviews /> },
  { path: '/tour',             element: <NazarethTour /> },
  { path: '/latin',            element: <LatinChurch /> },
  { path: '/greek',            element: <GreekChurch /> },
  { path: '/maryswell',        element: <MarysWell /> },
  { path: '/oldcity',          element: <OldNazareth /> },
  { path: '/city',             element: <Nazareth /> },
  { path: '/shop',             element: <Shop /> },
  { path: '/product/:id',      element: <ProductPage /> },
  { path: '/cart',             element: <Cart /> },
  { path: '/checkout',         element: <CheckOut /> },
  { path: '/checkoutcandle',   element: <CheckOutCandle /> },
  { path: '/checkoutdonation', element: <CheckOutDonation /> },
];

const adminRoutes = [
  { path: '/admin/login', element: <AdminLogin />,     withLayout: false },
  { path: '/admin',       element: <AdminDashboard />, withLayout: false },
];

function App() {
  useEffect(() => {
    ReactGA.initialize('G-VE42K6WP4H');
  }, []);

  const location = useLocation();

  useEffect(() => {
    ReactGA.send({ hitType: 'pageview', page: location.pathname });
  }, [location]);

  return (
    <ShopContextProvider>
      <ErrorBoundary>
        <Routes>
          {routes.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<PageLoader />}>
                  <Layout>{element}</Layout>
                </Suspense>
              }
            />
          ))}
          {adminRoutes.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<PageLoader />}>
                  {element}
                </Suspense>
              }
            />
          ))}
        </Routes>
      </ErrorBoundary>
    </ShopContextProvider>
  );
}

export default App;

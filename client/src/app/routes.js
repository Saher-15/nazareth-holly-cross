import { lazy } from 'react';

const Home = lazy(() => import('../pages/Home'));
const Candle = lazy(() => import('../components/Candle'));
const OldCity = lazy(() => import('../components/OldNazareth'));
const City = lazy(() => import('../components/Nazareth'));
const MarysWell = lazy(() => import('../components/Marys'));
const Latin = lazy(() => import('../components/LatinChurch'));
const Greek = lazy(() => import('../components/GreekChurch'));
const Cart = lazy(() => import('../pages/cart/cart'));
const About = lazy(() => import('../pages/About'));
const Checkout = lazy(() => import('../pages/Checkout'));
const Prayer = lazy(() => import('../components/Prayer'));
const Live = lazy(() => import('../pages/Live'));
const Tour = lazy(() => import('../components/NazarethTour'));
const Shop = lazy(() => import('../pages/shop/shop'));
const ProductPage = lazy(() => import('../pages/shop/ProductPage'));

// Every page of the site: path -> component (+ props). Rendered inside <Layout/>.
const routes = [
  { path: '/', Component: Home },
  { path: '/candle', Component: Candle },
  { path: '/tour', Component: Tour },
  { path: '/shop', Component: Shop },
  { path: '/product/:id', Component: ProductPage },
  { path: '/oldcity', Component: OldCity },
  { path: '/city', Component: City },
  { path: '/maryswell', Component: MarysWell },
  { path: '/latin', Component: Latin },
  { path: '/greek', Component: Greek },
  { path: '/cart', Component: Cart },
  { path: '/reviews', Component: Prayer },
  { path: '/about', Component: About },
  { path: '/checkout', Component: Checkout, props: { flow: 'order' } },
  { path: '/checkoutcandle', Component: Checkout, props: { flow: 'candle' } },
  { path: '/checkoutdonation', Component: Checkout, props: { flow: 'donation' } },
  { path: '/live', Component: Live },
];

export default routes;

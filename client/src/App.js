import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Layout from "./components/Layout";
import ShopContextProvider from "./context/shop-context";
import ReactGA from "react-ga4";

// Lazy load all pages
const Home = lazy(() => import("./pages/Home"));
const Candle = lazy(() => import("./components/Candle"));
const OldCity = lazy(() => import("./components/OldNazareth"));
const City = lazy(() => import("./components/Nazareth"));
const MarysWell = lazy(() => import("./components/Marys"));
const Latin = lazy(() => import("./components/LatinChurch"));
const Greek = lazy(() => import("./components/GreekChurch"));
const Cart = lazy(() => import("./pages/cart/cart"));
const About = lazy(() => import("./pages/About"));
const CheckOut = lazy(() => import("./pages/CheckOut"));
const Prayer = lazy(() => import("./components/Prayer"));
const CheckOutCandle = lazy(() => import("./pages/CheckOutCandle"));
const CheckOutDonation = lazy(() => import("./pages/CheckOutDonation"));
const Live = lazy(() => import("./pages/Live"));
const Tour = lazy(() => import("./components/NazarethTour"));
const Shop = lazy(() => import("./pages/shop/shop"));
const ProductPage = lazy(() => import("./pages/shop/ProductPage"));

// A reusable loading component
const Loading = ({ message }) => <div>{message || "Loading..."}</div>;

function App() {
  // Initialize Google Analytics
  useEffect(() => {
    ReactGA.initialize("G-VE42K6WP4H");  // Replace with your Google Analytics tracking ID
  }, []);

  const location = useLocation();

  // Track page views on route changes
  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);

  return (
    <ShopContextProvider>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<Loading message="Loading Home..." />}>
              <Layout>
                <Home />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/candle"
          element={
            <Suspense fallback={<Loading message="Loading Services..." />}>
              <Layout>
                <Candle />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/tour"
          element={
            <Suspense fallback={<Loading message="Loading Tour..." />}>
              <Layout>
                <Tour />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/shop"
          element={
            <Suspense fallback={<Loading message="Loading Shop..." />}>
              <Layout>
                <Shop />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/product/:id"
          element={
            <Suspense fallback={<Loading message="Loading Product..." />}>
              <Layout>
                <ProductPage />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/oldcity"
          element={
            <Suspense fallback={<Loading message="Loading Old City..." />}>
              <Layout>
                <OldCity />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/city"
          element={
            <Suspense fallback={<Loading message="Loading City..." />}>
              <Layout>
                <City />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/maryswell"
          element={
            <Suspense fallback={<Loading message="Loading Mary's Well..." />}>
              <Layout>
                <MarysWell />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/latin"
          element={
            <Suspense fallback={<Loading message="Loading Latin Church..." />}>
              <Layout>
                <Latin />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/greek"
          element={
            <Suspense fallback={<Loading message="Loading Greek Church..." />}>
              <Layout>
                <Greek />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/cart"
          element={
            <Suspense fallback={<Loading message="Loading Cart..." />}>
              <Layout>
                <Cart />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/reviews"
          element={
            <Suspense fallback={<Loading message="Loading Prayer..." />}>
              <Layout>
                <Prayer />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/about"
          element={
            <Suspense fallback={<Loading message="Loading About..." />}>
              <Layout>
                <About />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/checkout"
          element={
            <Suspense fallback={<Loading message="Loading CheckOut..." />}>
              <Layout>
                <CheckOut />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/checkoutcandle"
          element={
            <Suspense fallback={<Loading message="Loading CheckOut Candle..." />}>
              <Layout>
                <CheckOutCandle />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/checkoutdonation"
          element={
            <Suspense fallback={<Loading message="Loading CheckOut Donation..." />}>
              <Layout>
                <CheckOutDonation />
              </Layout>
            </Suspense>
          }
        />
        <Route
          path="/live"
          element={
            <Suspense fallback={<Loading message="Loading Live..." />}>
              <Layout>
                <Live />
              </Layout>
            </Suspense>
          }
        />
      </Routes>
    </ShopContextProvider>
  );
}

export default App;

import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Layout from "./components/Layout";
import ShopContextProvider from "./context/shop-context";
import ReactGA from "react-ga4";
import { GA_MEASUREMENT_ID } from "./config/env";
import routes from "./app/routes";

function App() {
  // Initialize Google Analytics
  useEffect(() => {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }, []);

  const location = useLocation();

  // Track page views on route changes
  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname });
  }, [location]);

  return (
    <ShopContextProvider>
      <Routes>
        <Route element={<Layout />}>
          {routes.map(({ path, Component, props }) => (
            <Route key={path} path={path} element={<Component {...props} />} />
          ))}
        </Route>
      </Routes>
    </ShopContextProvider>
  );
}

export default App;

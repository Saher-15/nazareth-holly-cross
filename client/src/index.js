import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
// Icons are bundled with the site (no third-party CDN, no CORS issues).
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/theme.css';
import { BrowserRouter } from "react-router-dom";

// An earlier version of the site registered a service worker (/sw.js) that is now retired.
// Remove any registration and its caches left in this browser (public/sw.js does the same).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((r) => r.unregister()))
    .catch(() => {});
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
}

// Create a root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component inside BrowserRouter
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* This ensures App is inside a Router */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

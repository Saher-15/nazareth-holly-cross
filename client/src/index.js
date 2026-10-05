import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import { BrowserRouter } from "react-router-dom";

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

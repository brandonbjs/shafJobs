/**
 * client/src/main.jsx — React Application Entry Point
 *
 * This is the first JavaScript file that runs in the browser.
 * It mounts the React app into the <div id="root"> in index.html.
 *
 * We wrap the entire app in React.StrictMode which:
 *  - Detects potential problems in development
 *  - Double-invokes certain lifecycle methods to catch side effects
 *  - Has no effect in production builds
 *
 * Brandon: ReactDOM.createRoot() is the React 18 way to mount the app.
 * The older ReactDOM.render() is deprecated as of React 18.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

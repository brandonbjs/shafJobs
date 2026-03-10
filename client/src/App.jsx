/**
 * client/src/App.jsx — Root Application Component
 *
 * Sets up React Router with two routes:
 *  /           → Dashboard (main listings page)
 *  /saved      → SavedJobs (bookmarked listings)
 *
 * The top navigation bar is rendered here so it persists across both pages.
 * Brandon: React Router intercepts link clicks and renders the correct page
 * component without doing a full browser page reload.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SavedJobs from './pages/SavedJobs';

/**
 * Navigation bar shown on all pages.
 * NavLink automatically adds an "active" state when the current route matches.
 */
function NavBar() {
  const navLinkClass = ({ isActive }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / App name */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <span className="text-white font-bold text-lg tracking-tight">ShafJobs</span>
          <span className="text-gray-500 text-xs ml-1 hidden sm:inline">
            by Brandon Shaffer
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/saved" className={navLinkClass}>
            Saved Jobs
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/saved" element={<SavedJobs />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

/**
 * client/src/hooks/useJobs.js — Job Listings State & Filter Logic
 *
 * A custom React hook that manages:
 *  - All filter state (location, industry, salary, date, etc.)
 *  - Fetching jobs from the backend with active filters as query params
 *  - Pagination state
 *  - Refresh trigger
 *  - Stats fetching (total counts, source statuses)
 *
 * Brandon: custom hooks (functions starting with "use") let you extract
 * stateful logic out of components so the Dashboard component stays clean.
 * Think of this as the "model" in an MVC pattern.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ── Default Filter State ──────────────────────────────────────────────────────
// These are the values the dashboard starts with on first load.
// Both remote AND hybrid are checked by default; on-site is hidden by default
// since Brandon only targets remote/hybrid roles.

export const DEFAULT_FILTERS = {
  location_type: ['remote', 'hybrid'],  // checked location types
  industry: [],                          // empty = show all industries
  salary_min: 60000,                     // default $60K floor
  show_unlisted_salary: true,            // show listings with no salary
  confidence: ['confirmed', 'likely', 'unconfirmed'], // show all confidence levels
  source: [],                            // empty = show all sources
  date_range: 'any',                     // no date restriction
  min_match: 0,                          // show all match scores
  search: '',                            // no keyword filter
  sort: 'match',                         // sort by match score
};

const PAGE_SIZE = 50;

/**
 * Custom hook for the Dashboard page.
 *
 * @returns {Object} — jobs, filters, pagination controls, stats, loading states
 */
export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // ── Build query params from filter state ───────────────────────────────────

  function buildQueryParams(currentFilters, currentPage) {
    const params = new URLSearchParams();

    if (currentFilters.location_type.length > 0) {
      params.set('location_type', currentFilters.location_type.join(','));
    }

    if (currentFilters.industry.length > 0) {
      params.set('industry', currentFilters.industry.join(','));
    }

    params.set('salary_min', currentFilters.salary_min.toString());
    params.set('show_unlisted_salary', currentFilters.show_unlisted_salary.toString());

    if (currentFilters.confidence.length < 3) {
      params.set('confidence', currentFilters.confidence.join(','));
    }

    if (currentFilters.source.length > 0) {
      params.set('source', currentFilters.source.join(','));
    }

    if (currentFilters.date_range !== 'any') {
      params.set('date_range', currentFilters.date_range);
    }

    if (currentFilters.min_match > 0) {
      params.set('min_match', currentFilters.min_match.toString());
    }

    if (currentFilters.search.trim()) {
      params.set('search', currentFilters.search.trim());
    }

    params.set('sort', currentFilters.sort);
    params.set('page', currentPage.toString());
    params.set('limit', PAGE_SIZE.toString());

    return params.toString();
  }

  // ── Fetch jobs from the API ────────────────────────────────────────────────

  const fetchJobs = useCallback(async (currentFilters, currentPage) => {
    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryParams(currentFilters, currentPage);
      const response = await axios.get(`/api/jobs?${queryString}`);

      setJobs(response.data.jobs);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load jobs. Is the server running?');
      console.error('[useJobs] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch dashboard stats ──────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/jobs/stats');
      setStats(response.data);
    } catch (err) {
      console.error('[useJobs] Stats fetch error:', err.message);
    }
  }, []);

  // ── Trigger a full source refresh ─────────────────────────────────────────

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await axios.post('/api/jobs/refresh');
      // Wait a few seconds then re-fetch — the refresh runs in the background
      setTimeout(async () => {
        await fetchJobs(filters, page);
        await fetchStats();
        setRefreshing(false);
      }, 5000);
    } catch (err) {
      console.error('[useJobs] Refresh error:', err.message);
      setRefreshing(false);
    }
  }, [filters, page, fetchJobs, fetchStats]);

  // ── Filter update helpers ──────────────────────────────────────────────────

  /**
   * Updates a single filter key. Resets to page 1.
   * @param {string} key — filter key (e.g., 'salary_min')
   * @param {*} value — new value
   */
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  /**
   * Toggles a value in an array filter (location_type, industry, etc.).
   * @param {string} key — filter key
   * @param {string} value — value to toggle
   */
  const toggleArrayFilter = useCallback((key, value) => {
    setFilters(prev => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
    setPage(1);
  }, []);

  /**
   * Resets all filters back to defaults.
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Re-fetch whenever filters or page changes
  useEffect(() => {
    fetchJobs(filters, page);
  }, [filters, page, fetchJobs]);

  // Fetch stats on mount and after refresh
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    // Data
    jobs,
    stats,
    pagination,
    // State
    filters,
    page,
    loading,
    refreshing,
    error,
    // Actions
    updateFilter,
    toggleArrayFilter,
    resetFilters,
    setPage,
    triggerRefresh,
    fetchStats,
  };
}

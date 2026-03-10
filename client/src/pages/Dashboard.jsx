/**
 * client/src/pages/Dashboard.jsx — Main Job Listings Page
 *
 * The primary view of ShafJobs. Contains:
 *  - Stats bar at top: total listings | active sources | last refreshed | new today
 *  - Source status indicators (✅ or ❌ per source)
 *  - Fallback links panel (shown when scraping sources are blocked)
 *  - Filter sidebar (left)
 *  - Job card grid (center/right)
 *  - Skeleton loading state
 *  - Pagination controls
 *
 * This component delegates all data fetching and filter logic to useJobs().
 * It delegates all bookmark logic to useSavedJobs().
 * Rendering logic is the only thing that lives here.
 */

import React from 'react';
import { useJobs } from '../hooks/useJobs';
import { useSavedJobs } from '../hooks/useSavedJobs';
import FilterSidebar from '../components/FilterSidebar';
import JobCard from '../components/JobCard';
import SkeletonCard from '../components/SkeletonCard';

// Source status icons shown in the stats bar
const SOURCE_STATUS_CONFIG = {
  ok: { icon: '✅', label: 'OK' },
  blocked: { icon: '🚫', label: 'Blocked' },
  error: { icon: '❌', label: 'Error' },
  pending: { icon: '⏳', label: 'Pending' },
};

/**
 * Stats bar at the top of the dashboard.
 */
function StatsBar({ stats, onRefresh, refreshing }) {
  const lastRefreshed = stats?.lastRefreshed
    ? new Date(stats.lastRefreshed).toLocaleTimeString()
    : 'Never';

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
      <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: aggregate stats */}
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <span className="text-gray-400">
            <span className="text-white font-bold">{stats?.total?.toLocaleString() ?? '—'}</span> total listings
          </span>
          <span className="text-gray-400">
            <span className="text-green-400 font-bold">{stats?.newSince24h?.toLocaleString() ?? '—'}</span> new today
          </span>
          <span className="text-gray-400">
            Last refreshed: <span className="text-gray-300">{lastRefreshed}</span>
          </span>
        </div>

        {/* Right: Refresh button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500
                     disabled:bg-gray-700 disabled:text-gray-500
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          {refreshing ? (
            <>
              <span className="animate-spin">⟳</span> Refreshing…
            </>
          ) : (
            <> ⟳ Refresh Jobs</>
          )}
        </button>
      </div>

      {/* Source status indicators */}
      {stats?.sourceStatus && (
        <div className="max-w-screen-2xl mx-auto mt-2 flex flex-wrap gap-3">
          {Object.entries(stats.sourceStatus).map(([source, status]) => {
            const cfg = SOURCE_STATUS_CONFIG[status] || SOURCE_STATUS_CONFIG.pending;
            return (
              <span key={source} className="text-xs text-gray-500 flex items-center gap-1">
                {cfg.icon}
                <span className="capitalize">{source}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Panel shown when scraping sources (LinkedIn, Glassdoor, Indeed) are blocked.
 * Shows deep-link buttons that open the sites in the browser with Brandon's filters.
 */
function FallbackLinksPanel() {
  const fallbackLinks = [
    { label: 'LinkedIn — Entry Level SWE (Remote)', url: 'https://www.linkedin.com/jobs/search/?keywords=entry+level+software+engineer&location=United+States&f_WT=2&f_E=2' },
    { label: 'LinkedIn — Junior Developer (Phoenix)', url: 'https://www.linkedin.com/jobs/search/?keywords=junior+developer&location=Phoenix%2C+AZ&f_E=2' },
    { label: 'Indeed — Entry Level SWE', url: 'https://www.indeed.com/jobs?q=software+engineer&explvl=entry_level' },
    { label: 'Indeed — Junior Developer (Remote)', url: 'https://www.indeed.com/jobs?q=junior+developer&l=remote&explvl=entry_level' },
    { label: 'Glassdoor — Entry Level SWE (Phoenix)', url: 'https://www.glassdoor.com/Job/phoenix-entry-level-software-engineer-jobs-SRCH_IL.0,7_IC1147401_KO8,37.htm' },
  ];

  return (
    <div className="bg-gray-900 border border-yellow-800 rounded-xl p-5 mb-4">
      <h3 className="text-yellow-400 font-semibold text-sm mb-3">
        🚫 Some sources are blocked — open manually:
      </h3>
      <div className="flex flex-wrap gap-2">
        {fallbackLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-xs text-gray-300 rounded-lg transition-colors"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Pagination controls shown below the job grid.
 */
function Pagination({ pagination, page, onPageChange }) {
  if (pagination.pages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm
                   text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        ← Prev
      </button>

      <span className="text-sm text-gray-400 px-3">
        Page {page} of {pagination.pages}
        <span className="text-gray-600 ml-2">({pagination.total.toLocaleString()} results)</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pagination.pages}
        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm
                   text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        Next →
      </button>
    </div>
  );
}

export default function Dashboard() {
  const {
    jobs, stats, pagination,
    filters, page, loading, refreshing, error,
    updateFilter, toggleArrayFilter, resetFilters,
    setPage, triggerRefresh,
  } = useJobs();

  const {
    savedJobIds, savedJobs,
    saveJob, unsaveJob,
  } = useSavedJobs();

  // Check if any scraping sources are blocked
  const hasBlockedSources = stats?.sourceStatus &&
    Object.values(stats.sourceStatus).some(s => s === 'blocked');

  return (
    <div className="flex">
      {/* Filter Sidebar */}
      <FilterSidebar
        filters={filters}
        updateFilter={updateFilter}
        toggleArrayFilter={toggleArrayFilter}
        resetFilters={resetFilters}
        resultCount={pagination.total}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stats bar */}
        <StatsBar stats={stats} onRefresh={triggerRefresh} refreshing={refreshing} />

        {/* Job grid area */}
        <main className="flex-1 p-6">
          {/* Fallback links panel */}
          {hasBlockedSources && <FallbackLinksPanel />}

          {/* Error state */}
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-5 mb-4 text-red-300 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-gray-400 text-lg font-medium">No listings found</p>
              <p className="text-gray-600 text-sm mt-2 max-w-md">
                Try adjusting your filters or click "Refresh Jobs" to fetch fresh listings.
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                           text-gray-300 text-sm rounded-lg transition-colors"
              >
                Reset all filters
              </button>
            </div>
          )}

          {/* Job grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
              : jobs.map(job => {
                  // Find the SavedJob document (needed for unsave)
                  const savedEntry = savedJobs.find(s => s.jobId?._id === job._id);

                  return (
                    <JobCard
                      key={job._id}
                      job={job}
                      isSaved={savedJobIds.has(job._id)}
                      savedId={savedEntry?._id ?? null}
                      onSave={saveJob}
                      onUnsave={unsaveJob}
                    />
                  );
                })
            }
          </div>

          {/* Pagination */}
          {!loading && (
            <Pagination pagination={pagination} page={page} onPageChange={setPage} />
          )}
        </main>
      </div>
    </div>
  );
}

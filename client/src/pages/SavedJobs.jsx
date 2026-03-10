/**
 * client/src/pages/SavedJobs.jsx — Bookmarked Job Listings Page
 *
 * Shows all of Brandon's saved/bookmarked job listings.
 * Features:
 *  - Same JobCard layout as the Dashboard
 *  - Inline editable notes field per listing
 *  - [Export CSV] button at the top — exports all saved jobs with notes
 *  - [Remove] button per card
 *  - Empty state with a link back to Dashboard
 *
 * Brandon: notes are saved to MongoDB on every keystroke via a debounced
 * auto-save — no need to click a "Save Notes" button.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSavedJobs } from '../hooks/useSavedJobs';
import IndustryBadge from '../components/IndustryBadge';
import LocationBadge from '../components/LocationBadge';
import SourceBadge from '../components/SourceBadge';
import MatchBadge from '../components/MatchBadge';
import { formatSalary, formatPostedDate } from '../utils/matchScore';

/**
 * A single saved job card with notes editing and remove button.
 */
function SavedJobCard({ savedJob, onUnsave, onUpdateNotes }) {
  const job = savedJob.jobId;
  const [notes, setNotes] = useState(savedJob.notes || '');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

  if (!job) {
    // The referenced job was deleted from the cache — show a tombstone card
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 opacity-60">
        <p className="text-sm text-gray-500">This listing is no longer available.</p>
        <button
          onClick={() => onUnsave(savedJob._id)}
          className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Remove
        </button>
      </div>
    );
  }

  // Debounced auto-save for notes
  function handleNotesChange(e) {
    const value = e.target.value;
    setNotes(value);
    setSaveStatus('saving');

    // Clear any pending save timer and set a new one
    clearTimeout(window._notesSaveTimer);
    window._notesSaveTimer = setTimeout(async () => {
      try {
        await onUpdateNotes(savedJob._id, value);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch {
        setSaveStatus('idle');
      }
    }, 600);
  }

  const excerpt = job.description && job.description.length > 120
    ? job.description.slice(0, 120).trim() + '…'
    : job.description || 'No description available.';

  return (
    <article className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white leading-snug truncate">
            {job.title}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{job.company}</p>
        </div>
        <button
          onClick={() => onUnsave(savedJob._id)}
          className="flex-shrink-0 text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1
                     border border-gray-800 hover:border-red-800 rounded-lg"
          title="Remove bookmark"
        >
          Remove
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <LocationBadge locationType={job.locationType} location={job.location} />
        <IndustryBadge industry={job.industry} />
        <SourceBadge source={job.source} />
        <MatchBadge score={job.matchScore} />
      </div>

      {/* Salary + Date */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-300 font-medium">{formatSalary(job.salaryMin, job.salaryMax)}</span>
        <span className="text-gray-600">{formatPostedDate(job.postedDate)}</span>
      </div>

      {/* Description excerpt */}
      <p className="text-xs text-gray-500 leading-relaxed">{excerpt}</p>

      {/* Notes field */}
      <div className="relative">
        <textarea
          value={notes}
          onChange={handleNotesChange}
          rows={2}
          placeholder="Add your notes here (status, contacts, application date…)"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs
                     text-gray-200 placeholder-gray-600 resize-none
                     focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                     transition-colors"
        />
        {saveStatus !== 'idle' && (
          <span className="absolute bottom-2 right-2 text-xs text-gray-500">
            {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          Saved {savedJob.savedAt ? new Date(savedJob.savedAt).toLocaleDateString() : ''}
        </span>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
        >
          🔗 View Original
        </a>
      </div>
    </article>
  );
}

export default function SavedJobs() {
  const {
    savedJobs,
    loading,
    error,
    unsaveJob,
    updateNotes,
    exportCsv,
  } = useSavedJobs();

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Saved Jobs</h1>
          <p className="text-sm text-gray-400 mt-1">
            {savedJobs.length} bookmarked listing{savedJobs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {savedJobs.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700
                       border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            📥 Export CSV
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16 text-gray-400">Loading saved jobs…</div>
      )}

      {/* Empty state */}
      {!loading && savedJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-4">📌</p>
          <p className="text-gray-400 text-lg font-medium">No saved jobs yet</p>
          <p className="text-gray-600 text-sm mt-2 max-w-md">
            Click the "Save" button on any job card in the Dashboard to bookmark it here.
          </p>
          <Link
            to="/"
            className="mt-5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm
                       rounded-lg transition-colors"
          >
            Browse Jobs
          </Link>
        </div>
      )}

      {/* Saved jobs grid */}
      {!loading && savedJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {savedJobs.map(savedJob => (
            <SavedJobCard
              key={savedJob._id}
              savedJob={savedJob}
              onUnsave={unsaveJob}
              onUpdateNotes={updateNotes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * client/src/components/JobCard.jsx — Individual Job Listing Card
 *
 * Displays all visible information for a single job listing:
 *  - Title + company name
 *  - Location, Industry, Source, Match Score badges
 *  - Entry-level confidence indicator
 *  - Salary range (or "Not listed")
 *  - Posted date
 *  - Description excerpt (max 150 chars)
 *  - [View Original] button → opens URL in new tab
 *  - [Save / Saved] bookmark button
 *
 * Props:
 *  - job: Object — the full job document from MongoDB
 *  - isSaved: boolean — whether this job is in Brandon's saved list
 *  - onSave: function(jobId) — called when Save is clicked
 *  - onUnsave: function(savedId) — called when Saved (remove) is clicked
 *  - savedId: string|null — the SavedJob _id (needed for unsave)
 */

import React, { useState } from 'react';
import MatchBadge from './MatchBadge';
import IndustryBadge from './IndustryBadge';
import LocationBadge from './LocationBadge';
import SourceBadge from './SourceBadge';
import { formatSalary, formatPostedDate, getConfidenceDisplay } from '../utils/matchScore';

export default function JobCard({ job, isSaved, onSave, onUnsave, savedId }) {
  const [saving, setSaving] = useState(false);

  // Truncate description to 150 characters
  const excerpt = job.description && job.description.length > 150
    ? job.description.slice(0, 150).trim() + '…'
    : job.description || 'No description available.';

  const confidenceDisplay = getConfidenceDisplay(job.entryLevelConfidence);

  async function handleSaveClick() {
    if (saving) return;
    setSaving(true);
    try {
      if (isSaved && savedId) {
        await onUnsave(savedId);
      } else {
        await onSave(job._id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3
                        hover:border-gray-600 transition-colors group">

      {/* ── Header: Title + Company ─────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-white leading-snug group-hover:text-blue-400 transition-colors">
          {job.title}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">{job.company}</p>
        {job.location && (
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span>📍</span> {job.location}
          </p>
        )}
      </div>

      {/* ── Badge Row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <LocationBadge locationType={job.locationType} location={job.location} />
        <IndustryBadge industry={job.industry} />
        <SourceBadge source={job.source} />
      </div>

      {/* ── Match Score + Confidence ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge score={job.matchScore} />
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${confidenceDisplay.badgeClass} ${confidenceDisplay.textClass}`}
        >
          {confidenceDisplay.label}
        </span>
      </div>

      {/* ── Salary ──────────────────────────────────────────────────────── */}
      <p className="text-sm font-medium text-gray-300">
        {formatSalary(job.salaryMin, job.salaryMax)}
      </p>

      {/* ── Description Excerpt ─────────────────────────────────────────── */}
      <p className="text-xs text-gray-500 leading-relaxed flex-1">
        {excerpt}
      </p>

      {/* ── Footer: Date + Action Buttons ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-gray-800">
        <span className="text-xs text-gray-600">
          {formatPostedDate(job.postedDate)}
        </span>

        <div className="flex items-center gap-2">
          {/* Save / Unsave button */}
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                        transition-colors disabled:opacity-50
                        ${isSaved
                          ? 'bg-blue-600 text-white hover:bg-red-600'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        }`}
            title={isSaved ? 'Click to remove bookmark' : 'Save this listing'}
          >
            <span>{isSaved ? '🔖' : '📌'}</span>
            <span>{saving ? '…' : isSaved ? 'Saved' : 'Save'}</span>
          </button>

          {/* View Original button */}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-blue-700 text-white hover:bg-blue-600 transition-colors"
          >
            <span>🔗</span> View
          </a>
        </div>
      </div>
    </article>
  );
}

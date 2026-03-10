/**
 * client/src/components/SourceBadge.jsx — Data Source Badge
 *
 * Shows which job board a listing came from.
 * Each source gets its own color so Brandon can see at a glance
 * which sources are producing the most listings.
 *
 * Props:
 *  - source: string — e.g. 'adzuna', 'linkedin', 'remotive'
 */

import React from 'react';

const SOURCE_CONFIG = {
  adzuna:   { label: 'Adzuna',    badgeClass: 'bg-orange-900 border border-orange-700 text-orange-300' },
  muse:     { label: 'The Muse',  badgeClass: 'bg-pink-900 border border-pink-700 text-pink-300' },
  usajobs:  { label: 'USAJobs',   badgeClass: 'bg-blue-900 border border-blue-700 text-blue-300' },
  remotive: { label: 'Remotive',  badgeClass: 'bg-teal-900 border border-teal-700 text-teal-300' },
  jobicy:   { label: 'Jobicy',    badgeClass: 'bg-cyan-900 border border-cyan-700 text-cyan-300' },
  linkedin: { label: 'LinkedIn',  badgeClass: 'bg-sky-900 border border-sky-700 text-sky-300' },
  glassdoor:{ label: 'Glassdoor', badgeClass: 'bg-green-900 border border-green-700 text-green-300' },
  indeed:   { label: 'Indeed',    badgeClass: 'bg-indigo-900 border border-indigo-700 text-indigo-300' },
};

export default function SourceBadge({ source }) {
  const config = SOURCE_CONFIG[source] || {
    label: source || 'Unknown',
    badgeClass: 'bg-gray-800 border border-gray-600 text-gray-400',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${config.badgeClass}`}>
      {config.label}
    </span>
  );
}

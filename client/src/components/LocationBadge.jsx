/**
 * client/src/components/LocationBadge.jsx — Location Type Badge
 *
 * Shows whether a listing is Remote, Hybrid, or On-Site.
 *  Remote  → Emerald (green)
 *  Hybrid  → Amber (orange)
 *  On-Site → Sky (blue)
 *
 * Props:
 *  - locationType: string — 'remote' | 'hybrid' | 'onsite'
 *  - location: string — the full location string (shown in tooltip)
 */

import React from 'react';

const LOCATION_CONFIG = {
  remote: {
    label: 'Remote',
    badgeClass: 'bg-emerald-900 border border-emerald-700 text-emerald-300',
    icon: '🌐',
  },
  hybrid: {
    label: 'Hybrid',
    badgeClass: 'bg-amber-900 border border-amber-700 text-amber-300',
    icon: '🏢',
  },
  onsite: {
    label: 'On-Site',
    badgeClass: 'bg-sky-900 border border-sky-700 text-sky-300',
    icon: '📍',
  },
};

export default function LocationBadge({ locationType, location }) {
  const config = LOCATION_CONFIG[locationType] || LOCATION_CONFIG.onsite;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}
      title={location || config.label}
    >
      {config.icon} {config.label}
    </span>
  );
}

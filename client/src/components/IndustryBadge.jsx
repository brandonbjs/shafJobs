/**
 * client/src/components/IndustryBadge.jsx — Color-Coded Industry Tag
 *
 * Displays a colored pill badge showing which industry a listing belongs to.
 * Colors match the spec:
 *  tech (General Tech)       → Blue
 *  healthcare (Healthcare IT) → Green
 *  finance (Financial)        → Gold/Amber
 *  gov-defense (Gov/Defense)  → Gray
 *  saas (SaaS Startups)       → Purple
 *
 * Props:
 *  - industry: string — one of the 5 industry slugs
 */

import React from 'react';

const INDUSTRY_CONFIG = {
  tech: {
    label: 'General Tech',
    badgeClass: 'bg-blue-900 border border-blue-700 text-blue-300',
    icon: '💻',
  },
  healthcare: {
    label: 'Healthcare IT',
    badgeClass: 'bg-emerald-900 border border-emerald-700 text-emerald-300',
    icon: '🏥',
  },
  finance: {
    label: 'Financial',
    badgeClass: 'bg-amber-900 border border-amber-700 text-amber-300',
    icon: '💰',
  },
  'gov-defense': {
    label: 'Gov / Defense',
    badgeClass: 'bg-gray-700 border border-gray-500 text-gray-300',
    icon: '🏛️',
  },
  saas: {
    label: 'SaaS',
    badgeClass: 'bg-purple-900 border border-purple-700 text-purple-300',
    icon: '☁️',
  },
};

export default function IndustryBadge({ industry }) {
  const config = INDUSTRY_CONFIG[industry] || INDUSTRY_CONFIG.tech;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeClass}`}
      title={`Industry: ${config.label}`}
    >
      {config.icon} {config.label}
    </span>
  );
}

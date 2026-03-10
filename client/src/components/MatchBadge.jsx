/**
 * client/src/components/MatchBadge.jsx — Match Score Badge
 *
 * Displays the match score as a color-coded badge:
 *  🟢 80–100% (emerald)
 *  🟡 50–79%  (yellow)
 *  🔴 0–49%   (red)
 *
 * Props:
 *  - score: number (0–100)
 */

import React from 'react';
import { getMatchScoreDisplay } from '../utils/matchScore';

export default function MatchBadge({ score }) {
  const { emoji, label, badgeClass, textClass } = getMatchScoreDisplay(score ?? 0);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass} ${textClass}`}
      title={`Match score: ${score}%`}
    >
      {emoji} {label}
    </span>
  );
}

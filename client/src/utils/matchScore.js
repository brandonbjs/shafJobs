/**
 * client/src/utils/matchScore.js — Client-Side Match Score Display Helpers
 *
 * The actual score is computed on the server (server/utils/matchScorer.js).
 * This file provides helpers for DISPLAYING the score in the UI:
 *  - Which color/emoji to show for a given score
 *  - Human-readable label
 *  - Tailwind CSS classes for the badge
 *
 * Brandon: keeping display logic in a utility file means we can update
 * the badge styling in one place and it affects every JobCard automatically.
 */

/**
 * Returns display properties for a match score.
 *
 * @param {number} score — 0 to 100
 * @returns {{ emoji: string, label: string, badgeClass: string, textClass: string }}
 */
export function getMatchScoreDisplay(score) {
  if (score >= 80) {
    return {
      emoji: '🟢',
      label: `${score}% match`,
      badgeClass: 'bg-emerald-900 border border-emerald-700',
      textClass: 'text-emerald-400',
      tier: 'high',
    };
  }

  if (score >= 50) {
    return {
      emoji: '🟡',
      label: `${score}% match`,
      badgeClass: 'bg-yellow-900 border border-yellow-700',
      textClass: 'text-yellow-400',
      tier: 'medium',
    };
  }

  return {
    emoji: '🔴',
    label: `${score}% match`,
    badgeClass: 'bg-red-900 border border-red-800',
    textClass: 'text-red-400',
    tier: 'low',
  };
}

/**
 * Returns display properties for an entry-level confidence level.
 *
 * @param {string} confidence — 'confirmed' | 'likely' | 'unconfirmed'
 * @returns {{ label: string, badgeClass: string, textClass: string }}
 */
export function getConfidenceDisplay(confidence) {
  switch (confidence) {
    case 'confirmed':
      return {
        label: 'Entry Level',
        badgeClass: 'bg-emerald-900 border border-emerald-700',
        textClass: 'text-emerald-400',
      };
    case 'likely':
      return {
        label: 'Likely Entry',
        badgeClass: 'bg-blue-900 border border-blue-700',
        textClass: 'text-blue-400',
      };
    case 'unconfirmed':
    default:
      return {
        label: 'Unconfirmed',
        badgeClass: 'bg-yellow-900 border border-yellow-700',
        textClass: 'text-yellow-500',
      };
  }
}

/**
 * Formats a salary range for display.
 *
 * @param {number|null} min
 * @param {number|null} max
 * @returns {string}
 */
export function formatSalary(min, max) {
  if (!min && !max) return 'Salary not listed';

  const fmt = (n) => `$${Math.round(n / 1000)}K`;

  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return 'Salary not listed';
}

/**
 * Formats a posted date as a human-readable relative string.
 *
 * @param {string|Date|null} date
 * @returns {string}
 */
export function formatPostedDate(date) {
  if (!date) return 'Date unknown';

  const posted = new Date(date);
  const now = new Date();
  const diffMs = now - posted;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return posted.toLocaleDateString();
}

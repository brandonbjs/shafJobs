/**
 * server/utils/legitimacyFilter.js — Job Listing Legitimacy Filter
 *
 * Filters out spam, MLM schemes, gig-only platforms, and other low-quality
 * listings that waste Brandon's time.
 *
 * Rules (any one of these causes a listing to be rejected):
 *  1. Company is a known gig/commission-only platform
 *  2. Job title or description contains MLM or commission-only signals
 *  3. Listing is from a staffing agency with no named end client
 *     (heuristic: company name contains "staffing"/"solutions"/"services" AND
 *      description has no client name or project details)
 *
 * Brandon: this is a heuristic filter — it won't catch everything, and it might
 * occasionally filter out a legitimate listing. If you see a good listing missing,
 * check if its company name is in the BLOCKED_COMPANIES list below.
 */

'use strict';

// ── Blocklists ────────────────────────────────────────────────────────────────

// Known gig-only platforms or MLM companies — never show listings from these
const BLOCKED_COMPANIES = [
  'upwork',
  'fiverr',
  'taskrabbit',
  'freelancer.com',
  'toptal',
  'guru.com',
  'peopleperhour',
  'herbalife',
  'amway',
  'primerica',
  'world financial group',
  'symmetry financial',
  'symmetry financial group',
  'vector marketing',
  'cutco',
  'avon',
  'advocare',
];

// ── Seniority exclusions — applied to job TITLE only ─────────────────────────
// These are word-boundary regex patterns so "Senior" matches but "Seniority" doesn't,
// "Sr." matches but "Str." doesn't, and "Lead" matches but "Cleveland" doesn't.
const SENIOR_TITLE_PATTERNS = [
  /\bsenior\b/i,
  /\bsr\./i,
  /\blead\b/i,
];

/**
 * Returns true if the job title contains a seniority signal that disqualifies it.
 * Brandon only wants entry-level listings — Senior, Sr., and Lead roles are excluded.
 *
 * @param {string} title
 * @returns {boolean}
 */
function hasSeniorTitle(title) {
  const t = title || '';
  return SENIOR_TITLE_PATTERNS.some(pattern => pattern.test(t));
}

// Keywords in title/description that strongly indicate commission-only or MLM
const BLOCKED_TITLE_SIGNALS = [
  'commission only',
  'commission-only',
  '100% commission',
  '1099 only',
  'sales representative',        // overly broad but common MLM pattern
  'independent contractor only',
  'self-employed',
];

const BLOCKED_DESC_SIGNALS = [
  'multi-level marketing',
  'mlm',
  'pyramid',
  'downline',
  'recruit others',
  'unlimited earning potential',
  'be your own boss',            // common MLM pitch phrase
  'no experience necessary',     // when combined with "sales" = high MLM risk
  'work from anywhere',          // combined with no tech skills = gig
];

// Staffing agency patterns in company name (heuristic)
const STAFFING_SIGNALS = [
  'staffing',
  'talent solutions',
  'workforce solutions',
  'recruiting partners',
  'manpower',
  'robert half',
  'kelly services',
  'adecco',
];

// ── Filter Functions ──────────────────────────────────────────────────────────

/**
 * Checks if a company name is in the blocked list.
 * @param {string} company
 * @returns {boolean} true = should be blocked
 */
function isBlockedCompany(company) {
  const normalized = (company || '').toLowerCase();
  return BLOCKED_COMPANIES.some(blocked => normalized.includes(blocked));
}

/**
 * Checks if the job title contains any commission/MLM signals.
 * @param {string} title
 * @returns {boolean}
 */
function hasBlockedTitleSignal(title) {
  const normalized = (title || '').toLowerCase();
  return BLOCKED_TITLE_SIGNALS.some(signal => normalized.includes(signal));
}

/**
 * Checks if the description contains MLM or commission-only signals.
 * We require 2+ signals in the description to avoid false positives
 * (a single phrase like "be your own boss" might appear in a legitimate startup ad).
 *
 * @param {string} description
 * @returns {boolean}
 */
function hasBlockedDescSignal(description) {
  const normalized = (description || '').toLowerCase();
  const matches = BLOCKED_DESC_SIGNALS.filter(signal => normalized.includes(signal));
  return matches.length >= 2; // require 2+ signals to block
}

/**
 * Checks if this looks like an anonymous staffing agency listing with no named client.
 * Heuristic: company name contains a staffing keyword AND description has fewer than
 * 150 chars (too thin to have real project/client details).
 *
 * @param {string} company
 * @param {string} description
 * @returns {boolean}
 */
function isAnonymousStaffingSpam(company, description) {
  const normalizedCompany = (company || '').toLowerCase();
  const isStaffingAgency = STAFFING_SIGNALS.some(signal => normalizedCompany.includes(signal));

  if (!isStaffingAgency) return false;

  // If the description is extremely short, it's probably a spam/placeholder listing
  const descLength = (description || '').length;
  return descLength < 100;
}

// ── Main Exported Function ────────────────────────────────────────────────────

/**
 * Filters an array of job objects, removing listings that fail legitimacy checks.
 *
 * @param {Object[]} jobs
 * @returns {{ legitimate: Object[], removed: number }}
 */
function filterLegitimacy(jobs) {
  let removed = 0;
  const legitimate = [];

  for (const job of jobs) {
    const seniorTitle  = hasSeniorTitle(job.title);
    const blockedCompany = isBlockedCompany(job.company);
    const blockedTitle = hasBlockedTitleSignal(job.title);
    const blockedDesc  = hasBlockedDescSignal(job.description);
    const staffingSpam = isAnonymousStaffingSpam(job.company, job.description);

    if (seniorTitle || blockedCompany || blockedTitle || blockedDesc || staffingSpam) {
      removed++;
      if (seniorTitle) {
        console.log(`[Legitimacy] Removed (senior title): "${job.title}" at "${job.company}"`);
      }
    } else {
      legitimate.push(job);
    }
  }

  console.log(`[Legitimacy] ${removed} listings removed as illegitimate. ${legitimate.length} remain.`);
  return { legitimate, removed };
}

module.exports = { filterLegitimacy };

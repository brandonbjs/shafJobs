/**
 * server/utils/industryTagger.js — Industry & Location Type Classifier
 *
 * Two classification utilities used during job ingestion:
 *
 * 1. detectIndustry(job) — classifies a listing into one of 5 industry buckets:
 *    tech | healthcare | finance | gov-defense | saas
 *
 * 2. detectLocationType(job) — classifies a listing into:
 *    remote | hybrid | onsite
 *
 * 3. detectEntryLevelConfidence(job) — classifies seniority signals:
 *    confirmed | likely | unconfirmed
 *
 * These functions look at the company name, job title, and description text
 * for keyword signals. The first match wins; 'tech' is the fallback for industry.
 *
 * Brandon: keyword matching is simple but surprisingly effective for job listings.
 * A future enhancement could use a pre-trained text classifier.
 */

'use strict';

const {
  INDUSTRY_KEYWORDS,
  ENTRY_LEVEL_TITLE_SIGNALS,
  ENTRY_LEVEL_DESC_SIGNALS,
  SENIOR_SIGNALS,
} = require('../config/sources');

// ── Industry Detection ────────────────────────────────────────────────────────

/**
 * Detects which industry a job belongs to.
 *
 * Checks (in priority order): gov-defense > healthcare > finance > saas > tech (fallback)
 * We check gov-defense first because a company like "Honeywell Aerospace Defense"
 * would also trigger the 'tech' category but we want the more specific tag.
 *
 * @param {Object} job - { title, company, description }
 * @returns {string} 'tech' | 'healthcare' | 'finance' | 'gov-defense' | 'saas'
 */
function detectIndustry(job) {
  // Combine all text fields into one searchable string
  const text = [
    job.title || '',
    job.company || '',
    job.description || '',
  ].join(' ').toLowerCase();

  // Priority order for classification
  const checkOrder = ['gov-defense', 'healthcare', 'finance', 'saas'];

  for (const industry of checkOrder) {
    const keywords = INDUSTRY_KEYWORDS[industry] || [];
    if (keywords.some(kw => text.includes(kw))) {
      return industry;
    }
  }

  // Default: general tech
  return 'tech';
}

// ── Location Type Detection ───────────────────────────────────────────────────

// Keywords in the title/description that indicate each location type
const REMOTE_SIGNALS = [
  'remote', 'work from home', 'wfh', 'fully remote', 'distributed',
  'telecommute', 'work remotely', 'remote-first', 'remote only',
];

const HYBRID_SIGNALS = [
  'hybrid', 'hybrid remote', 'hybrid schedule', 'hybrid model',
  '2-3 days', '2 days in office', '3 days in office', 'partially remote',
  'part-time remote',
];

/**
 * Detects whether a job is remote, hybrid, or onsite.
 *
 * Checks the combination of the `location` field (often just a city)
 * and the `description` text for qualifying signals.
 *
 * Logic:
 *  1. If description has remote signals → remote
 *  2. If description has hybrid signals → hybrid
 *  3. If location string itself says "Remote" → remote
 *  4. Otherwise → onsite
 *
 * @param {Object} job - { title, location, description }
 * @returns {string} 'remote' | 'hybrid' | 'onsite'
 */
function detectLocationType(job) {
  const locationText = (job.location || '').toLowerCase();
  const descText = (job.description || '').toLowerCase();
  const titleText = (job.title || '').toLowerCase();

  const allText = `${locationText} ${descText} ${titleText}`;

  // Check hybrid first because a hybrid listing often also mentions "remote days"
  if (HYBRID_SIGNALS.some(signal => allText.includes(signal))) {
    return 'hybrid';
  }

  if (REMOTE_SIGNALS.some(signal => allText.includes(signal))) {
    return 'remote';
  }

  // If the location field literally says "Remote"
  if (locationText.includes('remote') || locationText.includes('anywhere')) {
    return 'remote';
  }

  return 'onsite';
}

// ── Entry-Level Confidence ────────────────────────────────────────────────────

/**
 * Determines how confident we are that a listing is actually entry-level.
 *
 * 'confirmed'   — title explicitly contains junior/associate/entry/etc.
 * 'likely'      — description mentions 0-2 years or recent grad signals
 * 'unconfirmed' — no clear entry-level signal; might be any seniority
 *
 * We flag (but do NOT exclude) listings with senior signals as 'unconfirmed'
 * so Brandon can decide whether to apply.
 *
 * @param {Object} job - { title, description }
 * @returns {string} 'confirmed' | 'likely' | 'unconfirmed'
 */
function detectEntryLevelConfidence(job) {
  const titleText = (job.title || '').toLowerCase();
  const descText = (job.description || '').toLowerCase();

  // Confirmed: title has explicit entry-level keyword
  if (ENTRY_LEVEL_TITLE_SIGNALS.some(signal => titleText.includes(signal))) {
    return 'confirmed';
  }

  // Likely: description has entry-level signals even if title doesn't
  if (ENTRY_LEVEL_DESC_SIGNALS.some(signal => descText.includes(signal))) {
    return 'likely';
  }

  // If there are senior signals, still return 'unconfirmed' (not a separate value)
  // The filter sidebar lets Brandon hide unconfirmed listings if he wants
  return 'unconfirmed';
}

// ── Cache Duration ────────────────────────────────────────────────────────────

/**
 * Returns how many milliseconds to cache a listing based on its source.
 * API sources: 4 hours | Scraping sources: 6 hours
 *
 * @param {string} source
 * @returns {number} milliseconds
 */
function getCacheDurationMs(source) {
  const SCRAPING_SOURCES = ['linkedin', 'glassdoor', 'indeed'];
  const hours = SCRAPING_SOURCES.includes(source) ? 6 : 4;
  return hours * 60 * 60 * 1000;
}

module.exports = {
  detectIndustry,
  detectLocationType,
  detectEntryLevelConfidence,
  getCacheDurationMs,
};

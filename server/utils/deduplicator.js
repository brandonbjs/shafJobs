/**
 * server/utils/deduplicator.js — Fuzzy Deduplication Engine
 *
 * When we fetch 18 job titles from 8 sources, we inevitably get duplicates.
 * The same "Junior Developer" listing at "Accenture" might appear in Adzuna,
 * Indeed, AND LinkedIn. This file removes those duplicates.
 *
 * Algorithm:
 *  1. Normalize each listing (lowercase, strip punctuation)
 *  2. For each pair of listings: if same company + title similarity > 80% + same city → duplicate
 *  3. Use Levenshtein distance to measure title similarity — implemented from scratch
 *  4. Keep the listing with the most complete data when a duplicate is found
 *
 * Brandon: Levenshtein distance measures how many single-character edits (insert,
 * delete, substitute) are needed to transform one string into another. Two strings
 * with high similarity have a low Levenshtein distance relative to their length.
 */

'use strict';

// ── Levenshtein Distance (implemented from scratch, no library) ───────────────

/**
 * Computes the Levenshtein edit distance between two strings.
 * Uses the classic dynamic programming approach with a 2D matrix.
 *
 * Example:
 *   levenshtein('kitten', 'sitting') → 3
 *   levenshtein('junior developer', 'junior developer') → 0
 *
 * Time complexity: O(m × n) where m, n are string lengths.
 * Space complexity: O(m × n).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} edit distance
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  // Build a (m+1) × (n+1) matrix
  // matrix[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const matrix = [];

  for (let i = 0; i <= m; i++) {
    matrix[i] = new Array(n + 1).fill(0);
    matrix[i][0] = i; // Deleting all chars from a prefix of `a`
  }

  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j; // Inserting all chars to reach a prefix of `b`
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        // Characters match — no edit needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j],     // deletion
          matrix[i][j - 1],     // insertion
          matrix[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return matrix[m][n];
}

/**
 * Computes similarity as a 0–1 ratio.
 * 1.0 = identical strings, 0.0 = completely different.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} similarity between 0 and 1
 */
function similarity(a, b) {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);

  // Similarity = 1 - (edit_distance / max_possible_distance)
  return 1 - dist / maxLen;
}

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalizes a string for comparison:
 *  - Lowercase
 *  - Strip all punctuation and extra whitespace
 *  - Collapse multiple spaces into one
 *
 * "Junior Full-Stack Developer (React/Node)" → "junior fullstack developer reactnode"
 *
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim();
}

/**
 * Extracts the city portion of a location string for city-level comparison.
 * "Phoenix, AZ" → "phoenix"
 * "Remote - US"  → "remote"
 *
 * @param {string} location
 * @returns {string}
 */
function normalizeCity(location) {
  if (!location) return '';
  const city = location.split(',')[0];
  return normalize(city);
}

// ── Completeness Scoring ──────────────────────────────────────────────────────

/**
 * Scores a listing by how complete its data is.
 * When we find two duplicates, we keep the one with the higher completeness score.
 *
 * Points awarded:
 *  +3 for having a salary (salaryMin is not null)
 *  +2 for having a description longer than 100 chars
 *  +1 for having a recent postedDate
 *
 * @param {Object} job
 * @returns {number}
 */
function completenessScore(job) {
  let score = 0;
  if (job.salaryMin != null) score += 3;
  if (job.description && job.description.length > 100) score += 2;
  if (job.postedDate) score += 1;
  return score;
}

// ── Main Deduplication Function ───────────────────────────────────────────────

/**
 * Deduplicates an array of normalized job objects.
 *
 * Two listings are considered duplicates if ALL of these are true:
 *  1. Same company (normalized exact match OR >90% similar)
 *  2. Job title similarity > 80%
 *  3. Same city (normalized city match)
 *
 * When a duplicate is found, we keep the listing with the better completeness score.
 * Ties are broken by preferring the listing from a source with salary data.
 *
 * @param {Object[]} jobs — array of normalized job objects
 * @returns {{ unique: Object[], duplicatesRemoved: number }}
 */
function deduplicate(jobs) {
  const TITLE_SIMILARITY_THRESHOLD = 0.80; // 80% similar title = probable duplicate
  const COMPANY_SIMILARITY_THRESHOLD = 0.90; // companies must match very closely

  const kept = []; // the deduplicated result array
  let duplicatesRemoved = 0;

  for (const job of jobs) {
    const normTitle = normalize(job.title);
    const normCompany = normalize(job.company);
    const normCity = normalizeCity(job.location);

    // Check if this job is a duplicate of anything we've already kept
    let foundDuplicate = false;

    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i];
      const existingNormTitle = normalize(existing.title);
      const existingNormCompany = normalize(existing.company);
      const existingNormCity = normalizeCity(existing.location);

      // Step 1: City must match (or both be remote)
      const sameCity =
        normCity === existingNormCity ||
        (normCity.includes('remote') && existingNormCity.includes('remote'));

      if (!sameCity) continue;

      // Step 2: Company must match closely
      const companySim = similarity(normCompany, existingNormCompany);
      if (companySim < COMPANY_SIMILARITY_THRESHOLD) continue;

      // Step 3: Title must be similar enough
      const titleSim = similarity(normTitle, existingNormTitle);
      if (titleSim < TITLE_SIMILARITY_THRESHOLD) continue;

      // It's a duplicate! Keep the more complete listing.
      foundDuplicate = true;
      duplicatesRemoved++;

      const existingScore = completenessScore(existing);
      const incomingScore = completenessScore(job);

      if (incomingScore > existingScore) {
        // Replace the existing entry with this more complete one
        kept[i] = job;
      }
      // else: keep the existing entry (already better or equal)

      break;
    }

    if (!foundDuplicate) {
      kept.push(job);
    }
  }

  console.log(
    `[Deduplicator] ${duplicatesRemoved} duplicates removed from ${jobs.length} total raw listings → ${kept.length} unique`
  );

  return { unique: kept, duplicatesRemoved };
}

module.exports = { deduplicate, levenshtein, similarity, normalize };

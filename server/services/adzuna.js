/**
 * server/services/adzuna.js — Adzuna Job Board API Integration
 *
 * Adzuna is a job aggregator with a free API tier (250 calls/month).
 * Docs: https://developer.adzuna.com
 *
 * Strategy:
 *  - We make 2 calls per job title: one for "Phoenix, AZ" and one for "Remote"
 *  - All 18 titles × 2 locations = 36 calls per refresh
 *  - Calls run in BATCHES of 5 with a 300ms pause between batches to avoid
 *    the free-tier burst rate limit (429 Too Many Requests)
 *  - Each call is wrapped in try/catch so one failed call doesn't kill the rest
 *
 * Brandon: the "what=" parameter is the job search query, "where=" is the location.
 * We request 50 results per query (the Adzuna maximum per page).
 * The free tier allows 250 calls/month — 36 calls per refresh = ~6 full refreshes/month.
 */

'use strict';

const axios = require('axios');
const { JOB_TITLES, ADZUNA } = require('../config/sources');

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

/**
 * Fetches jobs for a single (title, location) pair from the Adzuna API.
 *
 * @param {string} title — job title to search for
 * @param {string} location — "Phoenix, AZ" or "Remote"
 * @returns {Promise<Object[]>} array of raw Adzuna result objects
 */
async function fetchAdzunaPage(title, location) {
  try {
    const response = await axios.get(ADZUNA.baseUrl, {
      params: {
        app_id: APP_ID,
        app_key: APP_KEY,
        what: title,
        where: location,
        results_per_page: ADZUNA.resultsPerPage,
        max_days_old: 30,          // only return listings posted in the last 30 days
        'content-type': 'application/json',
      },
      timeout: 10000, // 10 second timeout per call
    });

    // Adzuna wraps results in response.data.results
    return response.data?.results || [];
  } catch (err) {
    // Log the error but return an empty array so the aggregator continues
    console.error(`[Adzuna] Failed: title="${title}" location="${location}" — ${err.message}`);
    return [];
  }
}

/**
 * Normalizes a single raw Adzuna result into our standard job schema shape.
 *
 * Raw Adzuna fields:
 *  - title, company.display_name, location.display_name
 *  - salary_min, salary_max, description, redirect_url, created
 *
 * @param {Object} raw — raw Adzuna result object
 * @returns {Object} normalized job object
 */
function normalizeAdzunaJob(raw) {
  return {
    title: raw.title || 'Unknown Title',
    company: raw.company?.display_name || 'Unknown Company',
    location: raw.location?.display_name || 'Unknown Location',
    salaryMin: raw.salary_min ? Math.round(raw.salary_min) : null,
    salaryMax: raw.salary_max ? Math.round(raw.salary_max) : null,
    description: raw.description || '',
    url: raw.redirect_url || '',
    source: 'adzuna',
    postedDate: raw.created ? new Date(raw.created) : null,
  };
}

/**
 * Runs an array of async task functions in batches to avoid burst rate limits.
 * After each batch completes, waits `delayMs` before starting the next one.
 *
 * Example: 36 tasks in batches of 5 = 8 batches with a 300ms gap each ≈ ~2.4s overhead
 *
 * @param {Function[]} tasks — array of zero-argument async functions
 * @param {number} batchSize — how many to run concurrently per batch
 * @param {number} delayMs — milliseconds to wait between batches
 * @returns {Promise<any[]>} flattened results from all tasks
 */
async function runInBatches(tasks, batchSize, delayMs) {
  const results = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);

    // Pause between batches (skip the delay after the very last batch)
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Main export: fetches all Adzuna jobs across all titles and both locations.
 * Uses batched requests (5 at a time, 300ms between batches) to stay within
 * Adzuna's free-tier burst rate limit and avoid 429 errors.
 *
 * @returns {Promise<Object[]>} array of normalized job objects (may include duplicates)
 */
async function fetchAdzuna() {
  if (!APP_ID || !APP_KEY) {
    console.warn('[Adzuna] Skipping — ADZUNA_APP_ID or ADZUNA_APP_KEY not set in .env');
    return [];
  }

  console.log(`[Adzuna] Starting fetch: ${JOB_TITLES.length} titles × 2 locations (batches of 2)`);

  // Build all (title, location) combinations as lazy task functions
  const tasks = [];
  for (const title of JOB_TITLES) {
    tasks.push(() => fetchAdzunaPage(title, 'Phoenix, AZ'));
    tasks.push(() => fetchAdzunaPage(title, 'Remote'));
  }

  // Run in batches of 2 with 600ms between each batch.
  // 36 queries / 2 per batch = 18 batches × 600ms = ~10s overhead.
  // Small batch size is necessary because Adzuna's free tier has a tight burst limit.
  const rawResultArrays = await runInBatches(tasks, 2, 600);

  // Flatten, filter, normalize
  const allRaw = rawResultArrays.flat();
  const withUrls = allRaw.filter(r => r.redirect_url);
  const normalized = withUrls.map(normalizeAdzunaJob);

  console.log(`[Adzuna] Fetched ${normalized.length} raw listings`);
  return normalized;
}

module.exports = { fetchAdzuna };

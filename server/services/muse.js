/**
 * server/services/muse.js — The Muse API Integration
 *
 * The Muse focuses on company culture and tends to list jobs at progressive,
 * tech-forward companies.
 * Docs: https://www.themuse.com/developers/api/v2
 *
 * NOTE: The Muse API now requires an API key for all requests (previously optional).
 * Get a free key at https://www.themuse.com/developers/api/v2
 * Set it as MUSE_API_KEY in your .env — this source will be skipped without one.
 *
 * Strategy:
 *  - Query 6 categories × 2 locations in parallel
 *  - Pass the key as both the `api_key` query param AND the `x-api-key` header
 *  - The Muse doesn't support keyword search, only categories and locations
 *
 * Brandon: The Muse returns pages of 20 results. We fetch just the first page
 * per (category, location) pair to stay within rate limits.
 */

'use strict';

const axios = require('axios');
const { MUSE } = require('../config/sources');

const API_KEY = process.env.MUSE_API_KEY;
const BASE_URL = MUSE.baseUrl;

/**
 * Fetches one page of Muse results for a single (category, location) pair.
 *
 * @param {string} category — e.g. "Software Engineering"
 * @param {string} location — e.g. "Phoenix, AZ"
 * @returns {Promise<Object[]>}
 */
async function fetchMusePage(category, location) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        category,
        location,
        page: 1,
        api_key: API_KEY,  // required as of 2024 — 403 without this
      },
      headers: {
        'x-api-key': API_KEY,  // some Muse endpoints also check the header
      },
      timeout: 10000,
    });

    return response.data?.results || [];
  } catch (err) {
    console.error(`[Muse] Failed: category="${category}" location="${location}" — ${err.message}`);
    return [];
  }
}

/**
 * Normalizes a raw Muse job result into our standard schema shape.
 *
 * Raw Muse fields:
 *  - name (title), company.name, locations[].name, categories[].name
 *  - refs.landing_page (URL), publication_date
 *  - Note: Muse does NOT provide salary data
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeMuseJob(raw) {
  // Muse can have multiple locations — take the first
  const location = raw.locations?.[0]?.name || 'Unknown';

  return {
    title: raw.name || 'Unknown Title',
    company: raw.company?.name || 'Unknown Company',
    location,
    salaryMin: null,   // The Muse doesn't provide salary
    salaryMax: null,
    description: raw.contents || '',
    url: raw.refs?.landing_page || '',
    source: 'muse',
    postedDate: raw.publication_date ? new Date(raw.publication_date) : null,
  };
}

/**
 * Main export: fetches Muse jobs across all configured categories and locations.
 *
 * @returns {Promise<Object[]>}
 */
async function fetchMuse() {
  // Skip if key is missing or still contains the placeholder from .env.example
  if (!API_KEY || API_KEY.startsWith('your_')) {
    console.warn('[Muse] Skipping — MUSE_API_KEY not set. Get a free key at https://www.themuse.com/developers/api/v2');
    return [];
  }

  console.log(`[Muse] Starting fetch: ${MUSE.categories.length} categories × ${MUSE.locations.length} locations`);

  // Build all (category, location) queries
  const queries = [];
  for (const category of MUSE.categories) {
    for (const location of MUSE.locations) {
      queries.push({ category, location });
    }
  }

  // Parallel fetch
  const rawResultArrays = await Promise.all(
    queries.map(({ category, location }) => fetchMusePage(category, location))
  );

  const allRaw = rawResultArrays.flat();
  const withUrls = allRaw.filter(r => r.refs?.landing_page);
  const normalized = withUrls.map(normalizeMuseJob);

  console.log(`[Muse] Fetched ${normalized.length} raw listings`);
  return normalized;
}

module.exports = { fetchMuse };

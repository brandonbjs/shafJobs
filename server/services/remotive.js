/**
 * server/services/remotive.js — Remotive.io API Integration
 *
 * Remotive is a curated remote job board with a free, no-auth JSON API.
 * All listings are remote-only, so we tag them all as locationType: 'remote'.
 * Docs: https://remotive.io/api/remote-jobs
 *
 * Strategy:
 *  - Query 4 categories in parallel: software-dev, devops-sysadmin, qa, frontend
 *  - Filter results to keep only entry-level or ambiguous listings
 *  - No API key required
 *
 * Brandon: Remotive is one of the cleanest APIs in this project — no auth,
 * no pagination headaches, just a simple GET with a ?category= param.
 */

'use strict';

const axios = require('axios');
const { REMOTIVE } = require('../config/sources');

const BASE_URL = process.env.REMOTIVE_API_URL || REMOTIVE.baseUrl;

/**
 * Fetches jobs from Remotive for a single category.
 *
 * @param {string} category — e.g. "software-dev"
 * @returns {Promise<Object[]>}
 */
async function fetchRemotivePage(category) {
  try {
    const response = await axios.get(BASE_URL, {
      params: { category },
      timeout: 10000,
    });

    return response.data?.jobs || [];
  } catch (err) {
    console.error(`[Remotive] Failed: category="${category}" — ${err.message}`);
    return [];
  }
}

/**
 * Normalizes a raw Remotive job object into our standard schema.
 *
 * Raw Remotive fields:
 *  - title, company_name, category, salary, url, published_date
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeRemotiveJob(raw) {
  // Remotive salary is a freeform string like "$80K - $120K" — we skip parsing it
  // and leave salaryMin/salaryMax null rather than guessing
  return {
    title: raw.title || 'Unknown Title',
    company: raw.company_name || 'Unknown Company',
    location: 'Remote',  // All Remotive listings are remote
    salaryMin: null,
    salaryMax: null,
    description: raw.description || '',
    url: raw.url || '',
    source: 'remotive',
    postedDate: raw.published_date ? new Date(raw.published_date) : null,
  };
}

/**
 * Main export: fetches all Remotive jobs across all configured categories.
 *
 * @returns {Promise<Object[]>}
 */
async function fetchRemotive() {
  console.log(`[Remotive] Starting fetch: ${REMOTIVE.categories.length} categories`);

  // All category fetches run simultaneously
  const rawResultArrays = await Promise.all(
    REMOTIVE.categories.map(category => fetchRemotivePage(category))
  );

  const allRaw = rawResultArrays.flat();
  const withUrls = allRaw.filter(r => r.url);
  const normalized = withUrls.map(normalizeRemotiveJob);

  console.log(`[Remotive] Fetched ${normalized.length} raw listings`);
  return normalized;
}

module.exports = { fetchRemotive };

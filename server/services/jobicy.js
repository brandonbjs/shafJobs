/**
 * server/services/jobicy.js — Jobicy Remote Jobs API Integration
 *
 * Jobicy is a remote-only job board with a free JSON API.
 * No auth required.
 * Endpoint: https://jobicy.com/api/v2/remote-jobs
 * Docs: https://jobicy.com/jobs-rss-feed
 *
 * Strategy:
 *  - Query 6 tech tags in parallel: javascript, react, node, devops, qa, cloud
 *  - All results are remote — tag accordingly
 *  - API returns up to 50 results per tag
 *
 * Brandon: Jobicy uses a "tag=" query param to filter by tech stack.
 * Great for finding React, Node, and DevOps remote listings specifically.
 */

'use strict';

const axios = require('axios');
const { JOBICY } = require('../config/sources');

const BASE_URL = process.env.JOBICY_API_URL || JOBICY.baseUrl;

/**
 * Fetches jobs from Jobicy filtered by a single tech tag.
 *
 * @param {string} tag — e.g. "javascript", "react", "devops"
 * @returns {Promise<Object[]>}
 */
async function fetchJobicyByTag(tag) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        tag,
        count: JOBICY.resultsPerPage,
        geo: 'usa', // US listings only
      },
      timeout: 10000,
    });

    return response.data?.jobs || [];
  } catch (err) {
    console.error(`[Jobicy] Failed: tag="${tag}" — ${err.message}`);
    return [];
  }
}

/**
 * Normalizes a raw Jobicy job object into our standard schema.
 *
 * Raw Jobicy fields:
 *  - jobTitle, companyName, jobIndustry, annualSalaryMin, annualSalaryMax
 *  - url, pubDate, jobDescription
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeJobicyJob(raw) {
  return {
    title: raw.jobTitle || 'Unknown Title',
    company: raw.companyName || 'Unknown Company',
    location: 'Remote',  // All Jobicy listings are remote
    salaryMin: raw.annualSalaryMin ? Number(raw.annualSalaryMin) : null,
    salaryMax: raw.annualSalaryMax ? Number(raw.annualSalaryMax) : null,
    description: raw.jobDescription || raw.jobExcerpt || '',
    url: raw.url || '',
    source: 'jobicy',
    postedDate: raw.pubDate ? new Date(raw.pubDate) : null,
  };
}

/**
 * Main export: fetches Jobicy jobs for all tech tags in parallel.
 *
 * @returns {Promise<Object[]>}
 */
async function fetchJobicy() {
  console.log(`[Jobicy] Starting fetch: ${JOBICY.tags.length} tags`);

  const rawResultArrays = await Promise.all(
    JOBICY.tags.map(tag => fetchJobicyByTag(tag))
  );

  const allRaw = rawResultArrays.flat();
  const withUrls = allRaw.filter(r => r.url);
  const normalized = withUrls.map(normalizeJobicyJob);

  console.log(`[Jobicy] Fetched ${normalized.length} raw listings`);
  return normalized;
}

module.exports = { fetchJobicy };

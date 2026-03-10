/**
 * server/services/usajobs.js — USAJobs (Federal Government) API Integration
 *
 * USAJobs is the official job board for US federal government positions.
 * Great source for IT Specialist and Computer Engineer roles at agencies
 * like DHS, DOD, NASA, and the VA — many of which are remote-friendly.
 * Docs: https://developer.usajobs.gov
 *
 * Auth: Requires a free API key plus your email as the User-Agent header.
 *
 * Strategy:
 *  - Query by occupational series codes (2210, 0854, 1550) AND by keyword
 *  - Location: Phoenix, AZ + Remote
 *  - Run all queries in parallel
 *
 * Brandon: USAJobs returns XML or JSON. We use the JSON API.
 * Results are nested under SearchResult.SearchResultItems.
 */

'use strict';

const axios = require('axios');
const { USAJOBS } = require('../config/sources');

const API_KEY = process.env.USAJOBS_API_KEY;
const USER_AGENT = process.env.USAJOBS_USER_AGENT;
const BASE_URL = USAJOBS.baseUrl;

/**
 * Fetches jobs from USAJobs for a single search query.
 *
 * @param {Object} params — query parameters (Keyword, JobCategoryCode, LocationName, etc.)
 * @returns {Promise<Object[]>} array of raw USAJobs result items
 */
async function fetchUSAJobsPage(params) {
  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        'Authorization-Key': API_KEY,
        'User-Agent': USER_AGENT,
        'Host': 'data.usajobs.gov',
      },
      params: {
        ResultsPerPage: 25,
        WhoMayApply: 'public', // show all public listings
        ...params,
      },
      timeout: 10000,
    });

    return response.data?.SearchResult?.SearchResultItems || [];
  } catch (err) {
    console.error(`[USAJobs] Failed: params=${JSON.stringify(params)} — ${err.message}`);
    return [];
  }
}

/**
 * Normalizes a raw USAJobs result item into our standard schema.
 *
 * Raw USAJobs structure:
 *  item.MatchedObjectDescriptor.{
 *    PositionTitle, OrganizationName, PositionLocation[],
 *    PositionRemuneration[], PositionURI, PublicationStartDate
 *  }
 *
 * @param {Object} item
 * @returns {Object}
 */
function normalizeUSAJob(item) {
  const d = item.MatchedObjectDescriptor || {};
  const locations = d.PositionLocation || [];
  const location = locations[0]?.LocationName || 'Unknown';
  const remuneration = d.PositionRemuneration?.[0] || {};

  // USAJobs salary is listed as strings — parse them to numbers
  const salaryMin = remuneration.MinimumRange
    ? Math.round(parseFloat(remuneration.MinimumRange))
    : null;
  const salaryMax = remuneration.MaximumRange
    ? Math.round(parseFloat(remuneration.MaximumRange))
    : null;

  // QualificationSummary is the closest we get to a description
  const description = d.QualificationSummary || d.UserArea?.Details?.MajorDuties?.join(' ') || '';

  return {
    title: d.PositionTitle || 'Unknown Title',
    company: d.OrganizationName || 'US Federal Government',
    location,
    salaryMin,
    salaryMax,
    description,
    url: d.PositionURI || '',
    source: 'usajobs',
    postedDate: d.PublicationStartDate ? new Date(d.PublicationStartDate) : null,
  };
}

/**
 * Main export: fetches all USAJobs listings across all configured queries.
 *
 * @returns {Promise<Object[]>}
 */
async function fetchUSAJobs() {
  if (!API_KEY || !USER_AGENT) {
    console.warn('[USAJobs] Skipping — USAJOBS_API_KEY or USAJOBS_USER_AGENT not set');
    return [];
  }

  console.log('[USAJobs] Starting fetch');

  // Build queries: occupational series × locations + keyword queries
  const queries = [];

  // Series-based queries (most precise for IT/CS roles)
  for (const series of USAJOBS.jobSeries) {
    queries.push({ JobCategoryCode: series, LocationName: 'Phoenix, AZ', DatePosted: 30 });
    queries.push({ JobCategoryCode: series, LocationName: 'Remote',      DatePosted: 30 });
  }

  // Keyword-based queries
  for (const keyword of USAJOBS.keywords) {
    queries.push({ Keyword: keyword, LocationName: 'Phoenix, AZ', DatePosted: 30 });
    queries.push({ Keyword: keyword, RemoteIndicator: true,        DatePosted: 30 });
  }

  // Run all in parallel
  const rawResultArrays = await Promise.all(
    queries.map(params => fetchUSAJobsPage(params))
  );

  const allRaw = rawResultArrays.flat();
  const withUrls = allRaw.filter(item => item.MatchedObjectDescriptor?.PositionURI);
  const normalized = withUrls.map(normalizeUSAJob);

  console.log(`[USAJobs] Fetched ${normalized.length} raw listings`);
  return normalized;
}

module.exports = { fetchUSAJobs };

/**
 * server/controllers/jobsController.js — Main Job Aggregation Orchestrator
 *
 * This is the brain of the backend. It coordinates:
 *  1. Fetching from all 8 sources (API sources in parallel, scrapers sequentially)
 *  2. Running results through legitimacy filtering
 *  3. Deduplicating across all sources
 *  4. Tagging each listing (industry, locationType, entryLevelConfidence)
 *  5. Computing match scores
 *  6. Upserting to MongoDB (update if exists, insert if new)
 *  7. Serving cached listings to GET /api/jobs with filter/sort support
 *
 * Brandon: this file is worth reading carefully — it shows how all the
 * separate pieces (services, utils) plug together into one pipeline.
 */

'use strict';

const Job = require('../models/Job');
const { fetchAdzuna }     = require('../services/adzuna');
const { fetchMuse }       = require('../services/muse');
const { fetchUSAJobs }    = require('../services/usajobs');
const { fetchRemotive }   = require('../services/remotive');
const { fetchJobicy }     = require('../services/jobicy');
const { fetchLinkedIn }   = require('../services/linkedin');
const { fetchGlassdoor }  = require('../services/glassdoor');
const { fetchIndeed }     = require('../services/indeed');

const { deduplicate }            = require('../utils/deduplicator');
const { filterLegitimacy }       = require('../utils/legitimacyFilter');
const { computeMatchScore }      = require('../utils/matchScorer');
const {
  detectIndustry,
  detectLocationType,
  detectEntryLevelConfidence,
  getCacheDurationMs,
} = require('../utils/industryTagger');

// Track which sources were blocked (for the dashboard stats bar)
let lastSourceStatus = {};
let lastRefreshTime = null;

// ── Helper: Enrich a job object with all computed fields ──────────────────────

/**
 * Takes a raw normalized job (title, company, url, etc.) and adds:
 *  - industry (auto-detected)
 *  - locationType (auto-detected)
 *  - entryLevelConfidence (auto-detected)
 *  - matchScore (computed)
 *  - cachedAt + expiresAt (for cache invalidation)
 *
 * @param {Object} job
 * @returns {Object} enriched job
 */
function enrichJob(job) {
  const locationType = detectLocationType(job);
  const industry = detectIndustry(job);
  const entryLevelConfidence = detectEntryLevelConfidence(job);
  const matchScore = computeMatchScore({ ...job, locationType, industry });

  const cachedAt = new Date();
  const expiresAt = new Date(cachedAt.getTime() + getCacheDurationMs(job.source));

  return {
    ...job,
    locationType,
    industry,
    entryLevelConfidence,
    matchScore,
    cachedAt,
    expiresAt,
  };
}

// ── Main Aggregation Pipeline ─────────────────────────────────────────────────

/**
 * Fetches jobs from all 8 sources, processes them, and upserts to MongoDB.
 *
 * This function is called by:
 *  - POST /api/jobs/refresh (manual refresh)
 *  - autoFetchIfStale() on server startup
 *
 * @returns {Promise<{ total: number, inserted: number, updated: number }>}
 */
async function fetchAllSources() {
  console.log('\n[Aggregator] === Starting full job refresh ===');
  const startTime = Date.now();

  // ── Step 1: Fetch from all sources ─────────────────────────────────────────
  // API sources run in parallel; scrapers run sequentially to respect rate limits

  const sourceStatus = {
    adzuna: 'pending',
    muse: 'pending',
    usajobs: 'pending',
    remotive: 'pending',
    jobicy: 'pending',
    linkedin: 'pending',
    glassdoor: 'pending',
    indeed: 'pending',
  };

  // Wrap each fetch in a try/catch so one failure doesn't kill everything
  async function safeFetch(name, fetchFn) {
    try {
      const result = await fetchFn();
      sourceStatus[name] = 'ok';
      return result;
    } catch (err) {
      console.error(`[Aggregator] Source "${name}" failed: ${err.message}`);
      sourceStatus[name] = 'error';
      return [];
    }
  }

  // Parallel: API sources (no scraping rate limits to worry about)
  const [adzunaJobs, museJobs, usajobsJobs, remotiveJobs, jobicyJobs] = await Promise.all([
    safeFetch('adzuna',  fetchAdzuna),
    safeFetch('muse',    fetchMuse),
    safeFetch('usajobs', fetchUSAJobs),
    safeFetch('remotive',fetchRemotive),
    safeFetch('jobicy',  fetchJobicy),
  ]);

  // Sequential: scraping sources (respect per-site rate limits)
  const linkedInResult   = await safeFetch('linkedin',  fetchLinkedIn).then(r => {
    if (r && r.blocked) sourceStatus.linkedin = 'blocked';
    return r?.jobs || (Array.isArray(r) ? r : []);
  });

  const glassdoorResult = await safeFetch('glassdoor', fetchGlassdoor).then(r => {
    if (r && r.blocked) sourceStatus.glassdoor = 'blocked';
    return r?.jobs || (Array.isArray(r) ? r : []);
  });

  const indeedResult = await safeFetch('indeed', fetchIndeed).then(r => {
    if (r && r.blocked) sourceStatus.indeed = 'blocked';
    return r?.jobs || (Array.isArray(r) ? r : []);
  });

  lastSourceStatus = sourceStatus;

  // ── Step 2: Combine all raw results ────────────────────────────────────────
  const allRaw = [
    ...adzunaJobs,
    ...museJobs,
    ...usajobsJobs,
    ...remotiveJobs,
    ...jobicyJobs,
    ...linkedInResult,
    ...glassdoorResult,
    ...indeedResult,
  ];

  console.log(`\n[Aggregator] Total raw listings fetched: ${allRaw.length}`);

  // Remove listings with no URL (can't store or link to them)
  const withUrls = allRaw.filter(j => j.url && j.url.trim() !== '');
  console.log(`[Aggregator] After URL filter: ${withUrls.length}`);

  // ── Step 2.5: Date filter — drop listings older than 30 days ───────────────
  // Listings with no postedDate are kept (we don't know their age, better to include).
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = withUrls.filter(j => !j.postedDate || new Date(j.postedDate) >= thirtyDaysAgo);
  const droppedOld = withUrls.length - recent.length;
  if (droppedOld > 0) {
    console.log(`[Aggregator] Dropped ${droppedOld} listings older than 30 days → ${recent.length} remain`);
  }

  // Also purge any stale listings already in the DB that are older than 30 days.
  // We only delete listings that have a known postedDate — never delete ones without a date.
  const purgeResult = await Job.deleteMany({ postedDate: { $lt: thirtyDaysAgo } });
  if (purgeResult.deletedCount > 0) {
    console.log(`[Aggregator] Purged ${purgeResult.deletedCount} listings older than 30 days from DB`);
  }

  // Purge any senior/lead listings already in the DB — these should have been caught
  // by legitimacyFilter but may have been inserted before that rule was added.
  const seniorPurge = await Job.deleteMany({ title: { $regex: /\b(senior|sr\.|lead)\b/i } });
  if (seniorPurge.deletedCount > 0) {
    console.log(`[Aggregator] Purged ${seniorPurge.deletedCount} senior/lead title listings from DB`);
  }

  // ── Step 3: Legitimacy filtering ───────────────────────────────────────────
  const { legitimate } = filterLegitimacy(recent);

  // ── Step 4: Deduplication ──────────────────────────────────────────────────
  const { unique } = deduplicate(legitimate);

  // ── Step 5: Enrich each listing (tag + score) ──────────────────────────────
  const enriched = unique.map(enrichJob);

  // ── Step 6: Upsert to MongoDB ──────────────────────────────────────────────
  // We use url as the unique identifier (already a unique index in the schema).
  // updateOne with upsert=true will insert if not found, update if found.
  let inserted = 0;
  let updated = 0;

  for (const job of enriched) {
    try {
      const result = await Job.updateOne(
        { url: job.url },   // match by URL
        { $set: job },       // update all fields
        { upsert: true }     // insert if doesn't exist
      );

      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;
    } catch (err) {
      // A duplicate key error means the job already exists and wasn't modified
      // This shouldn't happen often since we use updateOne with upsert
      if (err.code !== 11000) {
        console.error(`[Aggregator] Failed to upsert job "${job.title}": ${err.message}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  lastRefreshTime = new Date();

  console.log(`\n[Aggregator] === Refresh complete in ${elapsed}s ===`);
  console.log(`[Aggregator] Inserted: ${inserted} | Updated: ${updated} | Total processed: ${enriched.length}`);
  console.log('[Aggregator] Source status:', sourceStatus);

  return { total: enriched.length, inserted, updated };
}

// ── GET /api/jobs Handler ─────────────────────────────────────────────────────

/**
 * Returns cached job listings with optional filtering and sorting.
 *
 * Supported query parameters:
 *  - location_type: comma-separated ('remote,hybrid,onsite')
 *  - industry: comma-separated ('tech,healthcare,finance,gov-defense,saas')
 *  - salary_min: number (show jobs where salaryMin >= this OR salaryMin is null)
 *  - show_unlisted_salary: 'false' to hide jobs with no salary
 *  - confidence: comma-separated ('confirmed,likely,unconfirmed')
 *  - source: comma-separated source names
 *  - date_range: 'day' | 'week' | 'month' | 'any'
 *  - min_match: number 0–100 (minimum match score)
 *  - search: keyword search (title, company, description)
 *  - sort: 'match' | 'date' | 'salary'
 *  - page: page number (default 1)
 *  - limit: items per page (default 50)
 *
 * @param {Object} req — Express request
 * @param {Object} res — Express response
 */
async function getJobs(req, res) {
  try {
    const {
      location_type,
      industry,
      salary_min,
      show_unlisted_salary = 'true',
      confidence,
      source,
      date_range = 'any',
      min_match = 0,
      search,
      sort = 'match',
      page = 1,
      limit = 50,
    } = req.query;

    // Build MongoDB filter object
    const filter = {};

    // Location type filter
    if (location_type) {
      const types = location_type.split(',').map(t => t.trim());
      filter.locationType = { $in: types };
    }

    // Industry filter
    if (industry) {
      const industries = industry.split(',').map(i => i.trim());
      filter.industry = { $in: industries };
    }

    // Salary filter
    if (salary_min && Number(salary_min) > 0) {
      const minSalary = Number(salary_min);
      if (show_unlisted_salary === 'false') {
        // Only show jobs that have salary AND meet the minimum
        filter.salaryMin = { $gte: minSalary };
      } else {
        // Show jobs where salary meets minimum OR salary is not listed
        filter.$or = [
          { salaryMin: { $gte: minSalary } },
          { salaryMin: null },
        ];
      }
    } else if (show_unlisted_salary === 'false') {
      // No salary minimum but hide unlisted
      filter.salaryMin = { $ne: null };
    }

    // Entry-level confidence filter
    if (confidence) {
      const levels = confidence.split(',').map(c => c.trim());
      filter.entryLevelConfidence = { $in: levels };
    }

    // Source filter
    if (source) {
      const sources = source.split(',').map(s => s.trim());
      filter.source = { $in: sources };
    }

    // Date range filter
    if (date_range && date_range !== 'any') {
      const now = new Date();
      const ranges = { day: 1, week: 7, month: 30 };
      const daysBack = ranges[date_range];
      if (daysBack) {
        const cutoff = new Date(now.getTime() - daysBack * 86400000);
        filter.postedDate = { $gte: cutoff };
      }
    }

    // Minimum match score filter
    if (Number(min_match) > 0) {
      filter.matchScore = { $gte: Number(min_match) };
    }

    // Keyword search (case-insensitive regex on title, company, description)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        ...(filter.$or || []),  // preserve existing $or conditions
        { title: searchRegex },
        { company: searchRegex },
        { description: searchRegex },
      ];
    }

    // Build sort object
    const sortMap = {
      match: { matchScore: -1, postedDate: -1 },
      date: { postedDate: -1, matchScore: -1 },
      salary: { salaryMin: -1, matchScore: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.match;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [jobs, total] = await Promise.all([
      Job.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Job.countDocuments(filter),
    ]);

    res.json({
      jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (err) {
    console.error('[jobsController.getJobs]', err.message);
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
}

// ── POST /api/jobs/refresh Handler ────────────────────────────────────────────

/**
 * Triggers a full re-fetch of all data sources.
 * Protected by the refresh rate limiter in routes/jobs.js.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function refreshJobs(req, res) {
  try {
    res.json({ message: 'Refresh started. This takes 20–60 seconds.' });

    // Run the fetch in the background — the response is already sent
    fetchAllSources().catch(err => {
      console.error('[refreshJobs] Background fetch failed:', err.message);
    });

  } catch (err) {
    console.error('[jobsController.refreshJobs]', err.message);
    res.status(500).json({ error: 'Failed to start refresh' });
  }
}

// ── GET /api/stats Handler ────────────────────────────────────────────────────

/**
 * Returns summary statistics for the dashboard header bar.
 *
 * @param {Object} req
 * @param {Object} res
 */
async function getStats(req, res) {
  try {
    // Count by source to show per-source stats
    const sourceCounts = await Job.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);

    const total = await Job.countDocuments();

    // Count new listings posted in the last 24 hours
    const yesterday = new Date(Date.now() - 86400000);
    const newSince = await Job.countDocuments({ cachedAt: { $gte: yesterday } });

    res.json({
      total,
      newSince24h: newSince,
      lastRefreshed: lastRefreshTime,
      sourceCounts: sourceCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      sourceStatus: lastSourceStatus,
    });

  } catch (err) {
    console.error('[jobsController.getStats]', err.message);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
}

// ── Auto-Fetch on Startup ─────────────────────────────────────────────────────

/**
 * Called 2 seconds after server start. Checks if the DB has any fresh listings.
 * If the cache is empty or all listings are expired, triggers a background fetch.
 *
 * Brandon: This is why the app "just works" on first run —
 * you don't need to manually hit Refresh after starting the server.
 */
async function autoFetchIfStale() {
  try {
    const freshCount = await Job.countDocuments({ expiresAt: { $gt: new Date() } });

    if (freshCount === 0) {
      console.log('[Aggregator] No fresh listings found — starting auto-fetch...');
      fetchAllSources().catch(err => {
        console.error('[autoFetchIfStale] Fetch failed:', err.message);
      });
    } else {
      console.log(`[Aggregator] Cache is fresh — ${freshCount} valid listings in DB`);
    }
  } catch (err) {
    console.error('[autoFetchIfStale]', err.message);
  }
}

module.exports = { getJobs, refreshJobs, getStats, autoFetchIfStale };

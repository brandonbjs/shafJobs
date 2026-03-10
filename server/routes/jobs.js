/**
 * server/routes/jobs.js — Job Listing Routes
 *
 * Mounts handlers for all job-related endpoints:
 *
 *  GET  /api/jobs          — fetch cached listings with filter/sort/pagination
 *  POST /api/jobs/refresh  — force re-fetch all sources (rate-limited: 3/hour)
 *  GET  /api/stats         — dashboard stats (total, sources, last refresh time)
 *
 * The refreshLimiter middleware prevents accidental API quota burn.
 * The apiLimiter is applied globally in index.js.
 */

'use strict';

const express = require('express');
const { getJobs, refreshJobs, getStats } = require('../controllers/jobsController');
const { refreshLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /api/jobs — returns cached listings
router.get('/', getJobs);

// POST /api/jobs/refresh — triggers a full re-fetch of all sources
// Protected by the strict refresh rate limiter (max 3 per hour)
router.post('/refresh', refreshLimiter, refreshJobs);

// GET /api/stats — dashboard header stats
router.get('/stats', getStats);

module.exports = router;

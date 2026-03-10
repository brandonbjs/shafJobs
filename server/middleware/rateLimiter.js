/**
 * server/middleware/rateLimiter.js — Express Rate Limiter Middleware
 *
 * Prevents the /api/jobs/refresh endpoint from being hammered, which would
 * burn through your Adzuna monthly quota or get your IP banned by scraped sites.
 *
 * We use express-rate-limit which stores request counts in memory.
 * Brandon: in production you'd use a Redis store, but in-memory is fine locally.
 *
 * Two limiters are exported:
 *  - apiLimiter: general limit for all /api/* routes (100 req/15min)
 *  - refreshLimiter: strict limit for POST /api/jobs/refresh (3 req/hour)
 */

'use strict';

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter — applied to all /api/* routes.
 * Prevents runaway clients from making thousands of requests.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requests per window per IP
  standardHeaders: true,     // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,      // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests. Please wait 15 minutes before trying again.',
  },
});

/**
 * Strict refresh limiter — applied ONLY to POST /api/jobs/refresh.
 * Each refresh burns Adzuna API quota and takes 10–30 seconds.
 * 3 refreshes per hour is plenty for normal use.
 */
const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many refresh requests. Please wait before refreshing again. (Limit: 3/hour)',
  },
});

module.exports = { apiLimiter, refreshLimiter };

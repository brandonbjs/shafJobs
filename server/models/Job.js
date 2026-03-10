/**
 * server/models/Job.js — Mongoose Schema for Cached Job Listings
 *
 * Every job from every source (Adzuna, LinkedIn, etc.) is normalized into
 * this single schema before being saved to MongoDB.
 *
 * Key design decisions:
 *  - `url` is unique — our main deduplication key in Mongo
 *  - `cachedAt` + `expiresAt` drive our cache invalidation logic
 *  - `matchScore` is pre-computed on upsert so the frontend just reads it
 *  - `entryLevelConfidence` is 'confirmed' | 'likely' | 'unconfirmed'
 *    so the user can see at a glance which listings are definitely entry-level
 *
 * Brandon: Mongoose schemas define the shape of documents in MongoDB.
 * When you call Job.create() or Job.findOneAndUpdate(), Mongoose validates
 * data against this schema before writing to the DB.
 */

'use strict';

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    // ── Core fields ────────────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    // Full location string, e.g. "Phoenix, AZ" or "Remote - US"
    location: {
      type: String,
      default: 'Unknown',
      trim: true,
    },

    // Classified by our detectLocationType() utility
    locationType: {
      type: String,
      enum: ['remote', 'hybrid', 'onsite'],
      default: 'onsite',
    },

    // Classified by our industryTagger utility
    industry: {
      type: String,
      enum: ['tech', 'healthcare', 'finance', 'gov-defense', 'saas'],
      default: 'tech',
    },

    // Salary range in USD (null if not provided)
    salaryMin: {
      type: Number,
      default: null,
    },
    salaryMax: {
      type: Number,
      default: null,
    },

    // Full job description text (may be truncated for scraped sources)
    description: {
      type: String,
      default: '',
    },

    // Original job listing URL — must be unique to prevent duplicate DB entries
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Which data source this listing came from
    source: {
      type: String,
      required: true,
      enum: ['adzuna', 'muse', 'usajobs', 'remotive', 'jobicy', 'linkedin', 'glassdoor', 'indeed'],
    },

    // When the original listing was posted on the source platform
    postedDate: {
      type: Date,
      default: null,
    },

    // ── Computed fields (set by our utils before upsert) ───────────────────

    // 0–100 integer. Computed by matchScorer.js against Brandon's profile.
    matchScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // How confident we are that this is actually an entry-level role:
    // 'confirmed' — title explicitly says junior/associate/entry/etc.
    // 'likely'    — description mentions 0-2 years or recent grad
    // 'unconfirmed' — no clear entry-level signal detected
    entryLevelConfidence: {
      type: String,
      enum: ['confirmed', 'likely', 'unconfirmed'],
      default: 'unconfirmed',
    },

    // ── Cache metadata ─────────────────────────────────────────────────────

    // When this record was written/updated in our DB
    cachedAt: {
      type: Date,
      default: Date.now,
    },

    // After this time, the cached record is considered stale
    // API sources: cachedAt + 4h | Scraped sources: cachedAt + 6h
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Speed up the most common query patterns

// The dashboard always filters by locationType and sortBy matchScore
jobSchema.index({ locationType: 1, matchScore: -1 });

// Cache expiry check on startup
jobSchema.index({ expiresAt: 1 });

// Source stats lookup
jobSchema.index({ source: 1 });

// Industry filter
jobSchema.index({ industry: 1 });

// The unique index on url is already defined above via `unique: true`

module.exports = mongoose.model('Job', jobSchema);

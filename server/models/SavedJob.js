/**
 * server/models/SavedJob.js — Mongoose Schema for Bookmarked Jobs
 *
 * When Brandon clicks "Save" on a job card, this document is created.
 * It stores a reference to the Job document plus optional personal notes.
 *
 * Using a ref (ObjectId) to the Job collection means:
 *  - We avoid duplicating the full job data
 *  - We can use Mongoose's .populate() to get the full job details
 *    when loading the Saved Jobs page
 *  - If a job is deleted from cache, we handle that gracefully (job returns null)
 */

'use strict';

const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema(
  {
    // Reference to the Job document in the jobs collection
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },

    // User's personal notes for this listing (e.g., "Applied 3/15, awaiting response")
    notes: {
      type: String,
      default: '',
      maxlength: 2000,
    },

    // When Brandon saved this listing
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent the same job from being saved twice
savedJobSchema.index({ jobId: 1 }, { unique: true });

module.exports = mongoose.model('SavedJob', savedJobSchema);

/**
 * server/controllers/savedController.js — Saved (Bookmarked) Jobs CRUD
 *
 * Handles all operations for Brandon's saved/bookmarked job listings:
 *  - GET    /api/saved        — list all saved jobs (with full job details populated)
 *  - POST   /api/saved        — save a job by jobId, with optional notes
 *  - PATCH  /api/saved/:id    — update notes on a saved job
 *  - DELETE /api/saved/:id    — remove a bookmark
 *
 * We use Mongoose's .populate() to join the Job document into each SavedJob
 * so the frontend gets the full listing data in one response.
 *
 * Brandon: .populate('jobId') is like a SQL JOIN — it replaces the jobId
 * ObjectId reference with the actual Job document from the jobs collection.
 */

'use strict';

const SavedJob = require('../models/SavedJob');

/**
 * GET /api/saved
 * Returns all saved jobs, each with the full Job document embedded.
 */
async function getSaved(req, res) {
  try {
    const saved = await SavedJob.find()
      .populate('jobId')        // Replace jobId with the full Job object
      .sort({ savedAt: -1 })   // Newest saved first
      .lean();

    // Filter out any SavedJobs where the referenced Job was deleted from cache
    const valid = saved.filter(s => s.jobId !== null);

    res.json(valid);
  } catch (err) {
    console.error('[savedController.getSaved]', err.message);
    res.status(500).json({ error: 'Failed to retrieve saved jobs' });
  }
}

/**
 * POST /api/saved
 * Saves a job. Body: { jobId: string, notes?: string }
 */
async function saveJob(req, res) {
  try {
    const { jobId, notes = '' } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // findOneAndUpdate with upsert handles the case where the job is already saved
    const saved = await SavedJob.findOneAndUpdate(
      { jobId },
      { jobId, notes },
      { upsert: true, new: true, runValidators: true }
    ).populate('jobId');

    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Job is already saved' });
    }
    console.error('[savedController.saveJob]', err.message);
    res.status(500).json({ error: 'Failed to save job' });
  }
}

/**
 * PATCH /api/saved/:id
 * Updates the notes on a saved job. Body: { notes: string }
 * :id is the SavedJob document _id (not the jobId)
 */
async function updateNotes(req, res) {
  try {
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({ error: 'notes field is required' });
    }

    const saved = await SavedJob.findByIdAndUpdate(
      req.params.id,
      { notes },
      { new: true, runValidators: true }
    ).populate('jobId');

    if (!saved) {
      return res.status(404).json({ error: 'Saved job not found' });
    }

    res.json(saved);
  } catch (err) {
    console.error('[savedController.updateNotes]', err.message);
    res.status(500).json({ error: 'Failed to update notes' });
  }
}

/**
 * DELETE /api/saved/:id
 * Removes a bookmark. :id is the SavedJob document _id.
 */
async function unsaveJob(req, res) {
  try {
    const saved = await SavedJob.findByIdAndDelete(req.params.id);

    if (!saved) {
      return res.status(404).json({ error: 'Saved job not found' });
    }

    res.json({ message: 'Job removed from saved list', id: req.params.id });
  } catch (err) {
    console.error('[savedController.unsaveJob]', err.message);
    res.status(500).json({ error: 'Failed to remove saved job' });
  }
}

module.exports = { getSaved, saveJob, updateNotes, unsaveJob };

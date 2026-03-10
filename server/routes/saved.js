/**
 * server/routes/saved.js — Saved Jobs Routes
 *
 *  GET    /api/saved        — list all bookmarked jobs
 *  POST   /api/saved        — bookmark a job
 *  PATCH  /api/saved/:id    — update notes on a saved job
 *  DELETE /api/saved/:id    — remove a bookmark
 */

'use strict';

const express = require('express');
const { getSaved, saveJob, updateNotes, unsaveJob } = require('../controllers/savedController');

const router = express.Router();

router.get('/', getSaved);
router.post('/', saveJob);
router.patch('/:id', updateNotes);
router.delete('/:id', unsaveJob);

module.exports = router;

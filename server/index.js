/**
 * server/index.js — ShafJobs Express Application Entry Point
 *
 * This file bootstraps the entire backend:
 *  1. Loads environment variables from .env
 *  2. Connects to the local MongoDB instance
 *  3. Creates and configures the Express app (CORS, logging, JSON parsing)
 *  4. Mounts all route handlers under /api/*
 *  5. Starts the HTTP server
 *  6. On startup, auto-fetches job listings if the cache is empty or expired
 *
 * Brandon — every time you restart the server you'll see it either say
 * "Cache is fresh" or kick off a background fetch of all 8 data sources.
 */

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from the project root (one level above server/)
// Without the explicit path, dotenv looks in the current working directory
// (server/) but the .env file lives at the project root.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jobsRouter = require('./routes/jobs');
const savedRouter = require('./routes/saved');
const { autoFetchIfStale } = require('./controllers/jobsController');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shafjobs';

// ── Middleware ────────────────────────────────────────────────────────────────

// helmet sets security-related HTTP headers (XSS protection, no-sniff, etc.)
app.use(helmet());

// CORS: allow the Vite dev server in development, or a configured production origin
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview
];
if (process.env.CLIENT_ORIGIN) {
  allowedOrigins.push(process.env.CLIENT_ORIGIN);
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// morgan logs every incoming HTTP request to the console in dev mode
// e.g.: GET /api/jobs 200 45ms
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Parse JSON request bodies (for POST /api/saved, etc.)
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// All job-related endpoints: GET /api/jobs, POST /api/jobs/refresh, GET /api/stats
app.use('/api/jobs', jobsRouter);

// Saved/bookmarked jobs: GET/POST /api/saved, DELETE /api/saved/:id
app.use('/api/saved', savedRouter);

// Health check — useful for checking if the server is up
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Static frontend (production) ──────────────────────────────────────────────
// In production, Express serves the React build from client/dist.
// Any non-API route returns index.html so React Router handles client-side navigation.
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── 404 handler (dev only) ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any error passed via next(err) in route handlers
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Database + Server Startup ─────────────────────────────────────────────────

async function startServer() {
  try {
    // Connect to local MongoDB. mongoose.connect() returns a promise.
    await mongoose.connect(MONGO_URI);
    console.log(`[MongoDB] Connected to ${MONGO_URI}`);

    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`[Server] ShafJobs API running on http://localhost:${PORT}`);
    });

    // After the server is up, check if we need to fetch fresh job listings.
    // This runs in the background — it won't block the server from accepting requests.
    // Brandon: this is what populates the DB on first run!
    setTimeout(() => autoFetchIfStale(), 2000);

  } catch (err) {
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();

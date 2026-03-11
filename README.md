# ShafJobs

A personalized, production-quality entry-level job aggregator built for Brandon Shaffer —
a CS graduate targeting junior SWE, DevOps, QA, and cloud roles in Phoenix, AZ (hybrid)
or fully remote (US-based).

Aggregates listings from 8 sources, scores every job against my skill profile,
deduplicates across all sources, and presents them in a clean filterable dashboard.

---

## Features

- **8 data sources**: Adzuna, The Muse, USAJobs, Remotive, Jobicy, LinkedIn*, Glassdoor*, Indeed*
- **18 job title queries** run in parallel per API source
- **Match score engine** (0–100%) based on Brandon's skills, weighted by category
- **Smart deduplication** using Levenshtein fuzzy matching across all sources
- **Industry tagging**: General Tech | Healthcare IT | Financial | Gov/Defense | SaaS
- **Location tagging**: Remote | Hybrid | On-Site (auto-detected from description)
- **Entry-level confidence**: Confirmed | Likely | Unconfirmed badges
- **Salary filter**: default $60K minimum, soft filter with "show unlisted" toggle
- **Saved Jobs**: bookmark listings with personal notes, export to CSV
- **Resilient**: one failing source never crashes the app; fallback deep-links for blocked scrapers

*Scrapers use Playwright. May be blocked by site anti-bot measures; fallback links always shown.

---

## Prerequisites

- **Node.js 18+** — https://nodejs.org
- **MongoDB** installed and running locally — https://www.mongodb.com/try/download/community
- **Git** — https://git-scm.com

---

## Setup & Run

```bash
# 1. Clone the repo
git clone <your-repo-url> ShafJobs
cd ShafJobs

# 2. Install all dependencies (root + server + client)
npm run install:all

# 3. Copy the env template and fill in your API keys
cp .env.example .env
# Then open .env in your editor and fill in each key (see API Keys section below)

# 4. Install Playwright browser for scraping (only Chromium needed)
npx playwright install chromium

# 5. Make sure MongoDB is running locally (default: mongodb://localhost:27017)
# On Windows: Start the MongoDB service, or run: mongod

# 6. Start the app (both servers at once)
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:3001

---

## API Keys

### Adzuna (required for Adzuna source)
- Sign up at https://developer.adzuna.com
- Free tier: 250 calls/month
- Set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in .env

### The Muse (optional)
- Docs: https://www.themuse.com/developers/api/v2
- Works without a key (rate-limited). Key gives higher limits.
- Set `MUSE_API_KEY` in .env, or leave blank

### USAJobs (required for government jobs)
- Register at https://developer.usajobs.gov/ApplyforKey
- Free, just needs your email
- Set `USAJOBS_API_KEY` and `USAJOBS_USER_AGENT` (use your email)

### Remotive & Jobicy
- No API key needed — endpoints work without authentication

### LinkedIn / Glassdoor / Indeed
- No official API — ShafJobs uses Playwright to scrape public search pages
- No keys needed; just run `npx playwright install chromium`
- If scraping is blocked, the dashboard shows fallback "Open in Browser" deep-links

---

## How Match Score Works

Each job is scored 0–100% against Brandon's profile using these weighted categories:

| Category | Weight | What's Checked |
|---|---|---|
| Title keyword match | 30% | Do job title words match Brandon's target roles/skills? |
| Description keyword match | 40% | Does the description mention Brandon's skills? |
| Industry preference | 15% | SaaS > General Tech > Healthcare > Finance > Gov/Defense |
| Location preference | 10% | Remote (preferred) > Hybrid Phoenix |
| Salary meets $60K threshold | 5% | Does salaryMin >= 60,000? |

Badges: 🟢 80–100% | 🟡 50–79% | 🔴 below 50%

---

## Project Structure

```
ShafJobs/
├── client/              # React + Vite + Tailwind frontend
│   └── src/
│       ├── components/  # JobCard, FilterSidebar, badges, etc.
│       ├── pages/       # Dashboard, SavedJobs
│       ├── hooks/       # useJobs, useSavedJobs
│       └── utils/       # Client-side match score display
├── server/              # Express + Mongoose backend
│   ├── config/          # sources.js — all 18 titles + API configs
│   ├── controllers/     # Request handlers
│   ├── middleware/       # Rate limiter
│   ├── models/          # Mongoose schemas (Job, SavedJob)
│   ├── routes/          # /api/jobs, /api/saved
│   ├── services/        # One file per data source (8 total)
│   └── utils/           # deduplicator, matchScorer, legitimacyFilter, industryTagger
├── .env.example         # Template for all secrets
└── package.json         # Root: scripts to run both servers
```

---

## How to Add a New Job Source

1. Create `server/services/myNewSource.js`
2. Export an async function `fetchMyNewSource()` that returns an array of normalized job objects
3. Each object must have these fields (others are optional):
   ```js
   {
     title, company, location, locationType,   // required
     description, url, source, postedDate,     // required
     salaryMin, salaryMax, industry            // optional — will be auto-tagged if missing
   }
   ```
4. Import and call it inside `server/controllers/jobsController.js` in the `fetchAllSources()` function
5. Add the source name to `server/config/sources.js` SOURCE_NAMES list
6. Restart the server — the new source will auto-appear in the dashboard stats bar

---

## Known Limitations

- **LinkedIn/Glassdoor/Indeed scraping** may be blocked by anti-bot measures.
  The dashboard always shows fallback deep-link buttons when scraping fails.
- **Adzuna free tier** limits to 250 API calls/month — with 18 titles × 2 locations = 36 calls
  per refresh. You get roughly 6 full refreshes per month on the free tier.
- **USAJobs** only returns federal government listings — great for defense/IT roles.
- **The Muse** focuses on culture-forward companies; fewer entry-level listings but high quality.
- All scraped data is cached 6 hours; API data is cached 4 hours. Refresh manually via the
  "Refresh Jobs" button on the dashboard.
- MongoDB must be running locally. The app will fail to start if Mongo is not running.

---

## Scripts Reference

```bash
npm run dev          # Start both frontend and backend in watch mode
npm run server       # Start only the Express backend (port 3001)
npm run client       # Start only the Vite frontend (port 5173)
npm run install:all  # Install all npm dependencies across root, server, and client
```

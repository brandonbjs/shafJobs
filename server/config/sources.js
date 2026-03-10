/**
 * server/config/sources.js — Central Configuration for All Job Sources
 *
 * This is the single source of truth for:
 *  - All 18 job titles to search across every API
 *  - API base URLs and endpoints
 *  - Location strings to pass to each API
 *  - Industry categories and their keywords (used by industryTagger)
 *  - Entry-level seniority signals
 *
 * Brandon: if you want to add a new search title or a new API source,
 * this is the first file to update.
 */

'use strict';

// ── Job Title Search Queries ──────────────────────────────────────────────────
// These 18 titles are queried against every API source.
// They're chosen to cover all the entry-level roles Brandon is targeting.
const JOB_TITLES = [
  'Junior Front-End Developer',
  'UI Developer',
  'Junior Full-Stack Developer',
  'QA Automation Engineer',
  'Associate Web Developer',
  'Software Developer I',
  'Software Engineer I',
  'Cloud Support Associate',
  'Cloud Associate',
  'Junior DevOps Engineer',
  'IT Systems Analyst',
  'Technical Analyst',
  'Solutions Engineer',
  'Entry Level Software Engineer',
  'Associate Engineer',
  'New Grad Engineer',
  'Early Career Engineer',
  'Junior Developer',
];

// ── Target Locations ──────────────────────────────────────────────────────────
// The two location contexts we query for most API sources.
const LOCATIONS = {
  phoenix: 'Phoenix, AZ',
  remote: 'Remote',
};

// ── Source Names (used in stats and badges) ───────────────────────────────────
const SOURCE_NAMES = [
  'adzuna',
  'muse',
  'usajobs',
  'remotive',
  'jobicy',
  'linkedin',
  'glassdoor',
  'indeed',
];

// ── API Endpoints ─────────────────────────────────────────────────────────────

const ADZUNA = {
  baseUrl: 'https://api.adzuna.com/v1/api/jobs/us/search/1',
  // Adzuna returns up to 50 results per page; we request the max each time
  resultsPerPage: 50,
};

const MUSE = {
  baseUrl: 'https://www.themuse.com/api/public/jobs',
  // Categories that map well to Brandon's background
  categories: [
    'Software Engineering',
    'QA',
    'DevOps',
    'IT',
    'Data & Analytics',
    'Cloud',
  ],
  locations: ['Phoenix, AZ', 'Flexible / Remote'],
  resultsPerPage: 20,
};

const USAJOBS = {
  baseUrl: 'https://data.usajobs.gov/api/search',
  // Occupational series codes for IT/Computer Engineering/CS roles
  // 2210 = IT Specialist, 0854 = Computer Engineer, 1550 = Computer Scientist, 0855 = Electronics Engineer
  jobSeries: ['2210', '0854', '1550'],
  keywords: ['software developer', 'software engineer', 'IT specialist', 'cloud', 'devops'],
};

const REMOTIVE = {
  baseUrl: 'https://remotive.io/api/remote-jobs',
  // Categories supported by Remotive's API
  categories: ['software-dev', 'devops-sysadmin', 'qa', 'frontend'],
};

const JOBICY = {
  baseUrl: 'https://jobicy.com/api/v2/remote-jobs',
  // Tag-based filters for Jobicy's feed
  tags: ['javascript', 'react', 'node', 'devops', 'qa', 'cloud'],
  resultsPerPage: 50,
};

// ── Entry-Level Seniority Signals ─────────────────────────────────────────────
// Words in a job TITLE that strongly indicate entry level → confidence: 'confirmed'
const ENTRY_LEVEL_TITLE_SIGNALS = [
  'junior',
  'associate',
  'entry',
  'entry-level',
  'entry level',
  'new grad',
  'new-grad',
  'early career',
  'software engineer i',
  'developer i',
  'engineer i',
];

// Words in a job DESCRIPTION that suggest entry level → used to boost confidence
const ENTRY_LEVEL_DESC_SIGNALS = [
  '0-2 years',
  '0 to 2 years',
  'no experience required',
  'recent graduate',
  'new graduate',
  'fresh graduate',
  'entry level',
  'entry-level',
  'early career',
  'bachelor',
  'bs in computer',
  'bs/ba',
];

// Words in a job DESCRIPTION that indicate senior/experienced — we flag these
// listings as 'unconfirmed' but DO NOT exclude them
const SENIOR_SIGNALS = [
  '5+ years',
  '5 or more years',
  '7+ years',
  '10+ years',
  'senior',
  'lead engineer',
  'principal',
  'staff engineer',
  'director',
  'manager',
  '3+ years of professional',
  '4+ years',
];

// ── Industry Keywords ─────────────────────────────────────────────────────────
// Used by industryTagger.js to classify each listing.
// Listed from most-specific to least-specific so we get the best match.
const INDUSTRY_KEYWORDS = {
  healthcare: [
    'health', 'medical', 'hospital', 'clinic', 'pharmacy', 'pharma',
    'patient', 'ehr', 'emr', 'hipaa', 'banner health', 'cvs', 'dignity',
    'humana', 'unitedhealth', 'change healthcare', 'caremore', 'cigna', 'aetna',
  ],
  finance: [
    'bank', 'finance', 'financial', 'investment', 'trading', 'insurance',
    'wealth', 'fintech', 'credit', 'loan', 'mortgage', 'jpmorgan', 'chase',
    'american express', 'amex', 'vanguard', 'schwab', 'usaa', 'fidelity',
    'blackrock', 'goldman', 'wells fargo',
  ],
  'gov-defense': [
    'government', 'federal', 'defense', 'military', 'intelligence', 'dod',
    'clearance', 'secret clearance', 'top secret', 'honeywell', 'raytheon',
    'northrop', 'leidos', 'general dynamics', 'booz allen', 'lockheed',
    'saic', 'mantech', 'caci',
  ],
  saas: [
    'saas', 'software as a service', 'b2b software', 'cloud platform',
    'subscription software', 'platform as a service', 'paas',
  ],
  // 'tech' is the fallback — anything that doesn't match the above
};

// ── Match Scoring Weights ─────────────────────────────────────────────────────
// These weights must sum to 100.
const MATCH_WEIGHTS = {
  titleKeyword: 30,
  descriptionKeyword: 40,
  industryPreference: 15,
  locationPreference: 10,
  salaryThreshold: 5,
};

// Industry preference order (higher index = less preferred, affects industry score)
const INDUSTRY_PREFERENCE = ['saas', 'tech', 'healthcare', 'finance', 'gov-defense'];

module.exports = {
  JOB_TITLES,
  LOCATIONS,
  SOURCE_NAMES,
  ADZUNA,
  MUSE,
  USAJOBS,
  REMOTIVE,
  JOBICY,
  ENTRY_LEVEL_TITLE_SIGNALS,
  ENTRY_LEVEL_DESC_SIGNALS,
  SENIOR_SIGNALS,
  INDUSTRY_KEYWORDS,
  MATCH_WEIGHTS,
  INDUSTRY_PREFERENCE,
};

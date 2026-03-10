/**
 * server/utils/matchScorer.js — Match Score Calculator
 *
 * Computes a 0–100 match score for each job listing against Brandon's profile.
 * This is the core "personalization" feature of ShafJobs.
 *
 * Scoring breakdown (weights defined in config/sources.js):
 *  30% — Title keyword match: does the job title contain Brandon's target skills/roles?
 *  40% — Description keyword match: does the description mention Brandon's skills?
 *  15% — Industry preference: SaaS > Tech > Healthcare > Finance > Gov/Defense
 *  10% — Location preference: Remote > Hybrid Phoenix
 *   5% — Salary meets $60K threshold
 *
 * Brandon: This is a simple keyword-matching approach (not ML). Each category
 * produces a sub-score from 0–100, then we apply the weights and sum them up.
 */

'use strict';

const { MATCH_WEIGHTS, INDUSTRY_PREFERENCE } = require('../config/sources');

// ── Brandon's Skill Profile ───────────────────────────────────────────────────
// These are the skills extracted from the prompt. We score descriptions against these.

const BRANDON_SKILLS = [
  // Languages
  'javascript', 'java', 'python', 'c#', 'c', 'r',
  // Databases
  'sql', 'mongodb', 'dynamodb', 'nosql', 'mysql', 'postgresql',
  // Web
  'html', 'css', 'node', 'node.js', 'express', 'express.js',
  'react', 'react.js', 'next.js', 'nextjs', 'mongoose', 'tailwind', 'tailwindcss',
  'rest api', 'restful', 'api',
  // Cloud & DevOps
  'aws', 'ec2', 'cloud', 'linux', 'nginx', 'pm2',
  // Tools
  'git', 'github', 'postman', 'docker', 'selenium', 'junit', 'nunit',
  // General
  'web development', 'full stack', 'fullstack', 'frontend', 'front end',
  'backend', 'back end', 'software development', 'agile', 'scrum',
];

// Job roles/keywords that match Brandon's target titles (for TITLE scoring)
const BRANDON_TARGET_ROLES = [
  'junior', 'associate', 'entry', 'entry-level', 'new grad',
  'frontend', 'front-end', 'front end', 'full-stack', 'full stack', 'fullstack',
  'web developer', 'software developer', 'software engineer',
  'qa', 'quality assurance', 'automation',
  'devops', 'cloud', 'it analyst', 'systems analyst',
  'react', 'node', 'javascript',
];

// ── Sub-Scorers ───────────────────────────────────────────────────────────────

/**
 * Scores a job title against Brandon's target roles and skills.
 * Returns a number 0–100.
 *
 * Logic:
 *  - Count how many target role keywords appear in the title
 *  - Normalize by the theoretical max (we cap at 100 so partial matches are fine)
 *
 * @param {string} title
 * @returns {number} 0–100
 */
function scoreTitleMatch(title) {
  if (!title) return 0;

  const normalizedTitle = title.toLowerCase();
  let matchCount = 0;

  for (const keyword of BRANDON_TARGET_ROLES) {
    if (normalizedTitle.includes(keyword)) {
      matchCount++;
    }
  }

  // Diminishing returns: first 3 matches get full points, extras matter less
  // We use a simple ratio capped at 1 (i.e., 100%)
  const maxExpected = 3;
  const ratio = Math.min(matchCount / maxExpected, 1);

  return Math.round(ratio * 100);
}

/**
 * Scores a job description against Brandon's full skill list.
 * Returns a number 0–100.
 *
 * Logic:
 *  - Count unique skill keywords found in the description
 *  - Score is (found / total_skills) × 100, capped at 100
 *
 * @param {string} description
 * @returns {number} 0–100
 */
function scoreDescriptionMatch(description) {
  if (!description) return 0;

  const normalizedDesc = description.toLowerCase();
  let matchCount = 0;

  for (const skill of BRANDON_SKILLS) {
    if (normalizedDesc.includes(skill)) {
      matchCount++;
    }
  }

  // Realistically, a job listing won't mention ALL of Brandon's skills.
  // We treat matching 10+ unique skills as a perfect description match.
  const perfectMatchThreshold = 10;
  const ratio = Math.min(matchCount / perfectMatchThreshold, 1);

  return Math.round(ratio * 100);
}

/**
 * Scores the industry based on Brandon's preferences.
 * SaaS startups are most preferred; Government/Defense is least preferred
 * (Brandon might prefer more modern tech stacks and flexible culture).
 *
 * @param {string} industry — one of 'saas', 'tech', 'healthcare', 'finance', 'gov-defense'
 * @returns {number} 0–100
 */
function scoreIndustry(industry) {
  const index = INDUSTRY_PREFERENCE.indexOf(industry);
  if (index === -1) return 50; // unknown industry → neutral score

  // INDUSTRY_PREFERENCE[0] = most preferred → score 100
  // INDUSTRY_PREFERENCE[last] = least preferred → score 0
  const totalOptions = INDUSTRY_PREFERENCE.length;
  return Math.round(((totalOptions - 1 - index) / (totalOptions - 1)) * 100);
}

/**
 * Scores location based on Brandon's preferences.
 * Remote = best, Hybrid Phoenix = good, On-Site = lower
 * (but we don't hard-exclude on-site — the filter sidebar handles that)
 *
 * @param {string} locationType — 'remote' | 'hybrid' | 'onsite'
 * @returns {number} 0–100
 */
function scoreLocation(locationType) {
  switch (locationType) {
    case 'remote': return 100;
    case 'hybrid': return 75;
    case 'onsite': return 25;
    default: return 50;
  }
}

/**
 * Scores salary: 100 if salaryMin >= 60K, 50 if salary unknown, 0 if below 60K.
 *
 * @param {number|null} salaryMin
 * @returns {number} 0 | 50 | 100
 */
function scoreSalary(salaryMin) {
  if (salaryMin == null) return 50; // unknown → neutral
  if (salaryMin >= 60000) return 100;
  if (salaryMin >= 50000) return 50; // close to threshold
  return 0;
}

// ── Main Exported Function ────────────────────────────────────────────────────

/**
 * Computes the overall match score for a job listing.
 *
 * @param {Object} job — normalized job object (before DB upsert)
 * @param {string} job.title
 * @param {string} job.description
 * @param {string} job.industry
 * @param {string} job.locationType
 * @param {number|null} job.salaryMin
 * @returns {number} integer 0–100
 */
function computeMatchScore(job) {
  const titleScore = scoreTitleMatch(job.title);
  const descScore = scoreDescriptionMatch(job.description);
  const industryScore = scoreIndustry(job.industry);
  const locationScore = scoreLocation(job.locationType);
  const salaryScore = scoreSalary(job.salaryMin);

  // Apply weights (weights sum to 100, so dividing by 100 gives the final 0–100 score)
  const weighted =
    (titleScore    * MATCH_WEIGHTS.titleKeyword      / 100) +
    (descScore     * MATCH_WEIGHTS.descriptionKeyword / 100) +
    (industryScore * MATCH_WEIGHTS.industryPreference / 100) +
    (locationScore * MATCH_WEIGHTS.locationPreference / 100) +
    (salaryScore   * MATCH_WEIGHTS.salaryThreshold    / 100);

  return Math.min(100, Math.max(0, Math.round(weighted)));
}

module.exports = { computeMatchScore, scoreTitleMatch, scoreDescriptionMatch };

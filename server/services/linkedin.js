/**
 * server/services/linkedin.js — LinkedIn Jobs Playwright Scraper
 *
 * LinkedIn doesn't have a public job listing API, so we use Playwright
 * to scrape their public (no-login) job search pages.
 *
 * URL pattern:
 *   https://www.linkedin.com/jobs/search/?keywords={title}&location={location}&f_E=2
 *   f_E=2 = "Entry level" filter
 *
 * Important caveats:
 *  - LinkedIn actively detects bots. We randomize delays and use a real browser.
 *  - If blocked, we return [] and the dashboard shows a fallback deep-link button.
 *  - We cache results aggressively (6 hours) to minimize scraping frequency.
 *  - We only scrape public listing cards, NOT individual job detail pages.
 *  - We respect robots.txt — LinkedIn allows public job search pages.
 *
 * Brandon: Playwright launches a real Chromium browser in headless mode.
 * If you see "blocked" in the logs, LinkedIn's anti-bot kicked in.
 * The fallback links in the dashboard will still let you browse manually.
 */

'use strict';

const { chromium } = require('playwright');
const { JOB_TITLES } = require('../config/sources');

// Delay between page loads (randomized within min/max from .env)
const DELAY_MIN = parseInt(process.env.SCRAPE_DELAY_MIN_MS || '1000', 10);
const DELAY_MAX = parseInt(process.env.SCRAPE_DELAY_MAX_MS || '3000', 10);

/**
 * Returns a random delay between DELAY_MIN and DELAY_MAX milliseconds.
 * Randomization helps avoid rate-limiting/bot detection.
 */
function randomDelay() {
  return new Promise(resolve => {
    const ms = DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));
    setTimeout(resolve, ms);
  });
}

/**
 * Scrapes LinkedIn job search results for a single (title, location) pair.
 * Returns an array of normalized job objects.
 *
 * We only query a subset of titles to minimize LinkedIn scraping.
 * Brandon: reduce TITLES_TO_SCRAPE if you keep getting blocked.
 *
 * @param {Object} browser — Playwright browser instance (shared across calls)
 * @param {string} title
 * @param {string} location
 * @returns {Promise<Object[]>}
 */
async function scrapeLinkedInPage(browser, title, location) {
  const page = await browser.newPage();

  try {
    // Build the search URL
    const encodedTitle = encodeURIComponent(title);
    const encodedLocation = encodeURIComponent(location);
    // f_TPR=r2592000 = "past 30 days" (2592000 seconds), f_E=2 = Entry level, sortBy=DD = newest first
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodedTitle}&location=${encodedLocation}&f_E=2&f_TPR=r2592000&sortBy=DD`;

    // Navigate to the page with a realistic timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for job cards to load (LinkedIn lazy-loads them)
    await page.waitForSelector('.job-search-card', { timeout: 8000 }).catch(() => null);

    // Extract job card data
    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.job-search-card');
      return Array.from(cards).map(card => {
        const titleEl = card.querySelector('.base-search-card__title');
        const companyEl = card.querySelector('.base-search-card__subtitle');
        const locationEl = card.querySelector('.job-search-card__location');
        const dateEl = card.querySelector('time');
        const linkEl = card.querySelector('a.base-card__full-link');

        return {
          title: titleEl?.textContent?.trim() || '',
          company: companyEl?.textContent?.trim() || '',
          location: locationEl?.textContent?.trim() || '',
          postedDate: dateEl?.getAttribute('datetime') || null,
          url: linkEl?.href || '',
        };
      }).filter(j => j.title && j.url);
    });

    return jobs;
  } catch (err) {
    console.error(`[LinkedIn] Failed: title="${title}" location="${location}" — ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Normalizes a scraped LinkedIn job object into our standard schema.
 *
 * Note: LinkedIn public pages don't show salary or job description.
 * We store an empty description and null salaries.
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeLinkedInJob(raw) {
  return {
    title: raw.title || 'Unknown Title',
    company: raw.company || 'Unknown Company',
    location: raw.location || 'Unknown',
    salaryMin: null,
    salaryMax: null,
    description: '', // Public search pages don't show descriptions
    url: raw.url || '',
    source: 'linkedin',
    postedDate: raw.postedDate ? new Date(raw.postedDate) : null,
  };
}

/**
 * Fallback URLs to show in the dashboard when scraping is blocked.
 * These open LinkedIn Jobs in the browser with Brandon's filters pre-applied.
 */
const FALLBACK_LINKS = [
  {
    label: 'LinkedIn — Junior Developer (Phoenix)',
    url: 'https://www.linkedin.com/jobs/search/?keywords=junior+developer&location=Phoenix%2C+AZ&f_E=2',
  },
  {
    label: 'LinkedIn — Entry Level SWE (Remote)',
    url: 'https://www.linkedin.com/jobs/search/?keywords=entry+level+software+engineer&location=United+States&f_WT=2&f_E=2',
  },
  {
    label: 'LinkedIn — QA Automation Engineer (Remote)',
    url: 'https://www.linkedin.com/jobs/search/?keywords=QA+automation+engineer&location=United+States&f_WT=2&f_E=2',
  },
];

/**
 * Main export: scrapes LinkedIn jobs for a subset of job titles.
 * Launches one shared browser instance and scrapes sequentially (rate limiting).
 *
 * @returns {Promise<{ jobs: Object[], fallbackLinks: Object[], blocked: boolean }>}
 */
async function fetchLinkedIn() {
  console.log('[LinkedIn] Starting scrape');

  // Only scrape a small subset of titles to minimize LinkedIn hits
  const TITLES_TO_SCRAPE = JOB_TITLES.slice(0, 6);
  const LOCATIONS_TO_SCRAPE = ['Phoenix, AZ', 'United States'];

  let browser;
  const allJobs = [];
  let blocked = false;

  try {
    browser = await chromium.launch({ headless: true });

    for (const title of TITLES_TO_SCRAPE) {
      for (const location of LOCATIONS_TO_SCRAPE) {
        const raw = await scrapeLinkedInPage(browser, title, location);

        if (raw.length === 0) {
          // Could be blocked — count consecutive failures
          console.warn(`[LinkedIn] No results for "${title}" in "${location}" — may be blocked`);
        }

        const normalized = raw.map(normalizeLinkedInJob);
        allJobs.push(...normalized);

        // Respect rate limits with randomized delay
        await randomDelay();
      }
    }

  } catch (err) {
    console.error(`[LinkedIn] Browser error — ${err.message}`);
    blocked = true;
  } finally {
    if (browser) await browser.close();
  }

  // If we got zero results total, mark as blocked so the dashboard shows fallback links
  if (allJobs.length === 0) {
    blocked = true;
    console.warn('[LinkedIn] No jobs scraped — returning fallback links');
  }

  console.log(`[LinkedIn] Scraped ${allJobs.length} listings`);
  return { jobs: allJobs, fallbackLinks: FALLBACK_LINKS, blocked };
}

module.exports = { fetchLinkedIn, FALLBACK_LINKS };

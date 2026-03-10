/**
 * server/services/glassdoor.js — Glassdoor Jobs Playwright Scraper
 *
 * Glassdoor doesn't offer a public job listing API, so we scrape their
 * public job search pages using Playwright.
 *
 * URL pattern:
 *   https://www.glassdoor.com/Job/jobs.htm?sc.keyword={title}&locT=C&locId=1147401
 *   locId=1147401 = Phoenix, AZ (Glassdoor's internal city ID)
 *
 * Glassdoor shows company ratings and sometimes salary estimates on card-level —
 * we capture those when visible without login.
 *
 * Same anti-bot considerations as LinkedIn apply here:
 *  - Randomized delays between requests
 *  - If blocked, return [] and show fallback deep-links in the dashboard
 *  - Cache for 6 hours minimum
 *
 * Rate limit: max 1 request per 2 seconds (DELAY_MIN = 2000ms for Glassdoor).
 *
 * Brandon: Glassdoor is often the most aggressively anti-bot of the three
 * scraped sources. Don't be surprised if this one returns 0 results.
 */

'use strict';

const { chromium } = require('playwright');
const { JOB_TITLES } = require('../config/sources');

// Glassdoor-specific: minimum 2 seconds between requests
const DELAY_MIN = Math.max(parseInt(process.env.SCRAPE_DELAY_MIN_MS || '1000', 10), 2000);
const DELAY_MAX = Math.max(parseInt(process.env.SCRAPE_DELAY_MAX_MS || '3000', 10), 4000);

function randomDelay() {
  return new Promise(resolve => {
    const ms = DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));
    setTimeout(resolve, ms);
  });
}

// Phoenix, AZ internal Glassdoor location ID
const PHOENIX_LOC_ID = '1147401';

/**
 * Scrapes Glassdoor job search results for a single title.
 *
 * @param {Object} browser — shared Playwright browser instance
 * @param {string} title
 * @param {boolean} isRemote — true → search remote jobs instead of Phoenix
 * @returns {Promise<Object[]>}
 */
async function scrapeGlassdoorPage(browser, title, isRemote = false) {
  const page = await browser.newPage();

  try {
    const encodedTitle = encodeURIComponent(title);
    let url;

    if (isRemote) {
      url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodedTitle}&locT=N&remoteWorkType=1`;
    } else {
      url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodedTitle}&locT=C&locId=${PHOENIX_LOC_ID}`;
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Glassdoor sometimes shows a CAPTCHA/login wall — detect and bail
    const hasCaptcha = await page.$('[data-test="captcha"]').catch(() => null);
    const hasLoginWall = await page.$('[data-test="login-modal"]').catch(() => null);

    if (hasCaptcha || hasLoginWall) {
      console.warn(`[Glassdoor] Blocked by login wall for: "${title}"`);
      return [];
    }

    // Wait for job listing cards
    await page.waitForSelector('[data-test="jobListing"]', { timeout: 8000 }).catch(() => null);

    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-test="jobListing"]');
      return Array.from(cards).map(card => {
        const titleEl = card.querySelector('[data-test="job-title"]');
        const companyEl = card.querySelector('[data-test="employer-name"]');
        const locationEl = card.querySelector('[data-test="emp-location"]');
        const salaryEl = card.querySelector('[data-test="detailSalary"]');
        const ratingEl = card.querySelector('[data-test="rating"]');
        const linkEl = card.querySelector('a[data-test="job-title"]');

        return {
          title: titleEl?.textContent?.trim() || '',
          company: companyEl?.textContent?.trim() || '',
          location: locationEl?.textContent?.trim() || '',
          salaryText: salaryEl?.textContent?.trim() || '',
          companyRating: ratingEl?.textContent?.trim() || '',
          url: linkEl?.href || '',
        };
      }).filter(j => j.title && j.url);
    });

    return jobs;
  } catch (err) {
    console.error(`[Glassdoor] Failed: title="${title}" — ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Attempts to parse a Glassdoor salary text string like "$70K - $100K" into min/max.
 * Returns null for both if parsing fails.
 *
 * @param {string} salaryText
 * @returns {{ salaryMin: number|null, salaryMax: number|null }}
 */
function parseSalaryText(salaryText) {
  if (!salaryText) return { salaryMin: null, salaryMax: null };

  const matches = salaryText.match(/\$?([\d,.]+)K?\s*[-–]\s*\$?([\d,.]+)K?/i);
  if (!matches) return { salaryMin: null, salaryMax: null };

  const parseAmount = (str) => {
    const num = parseFloat(str.replace(/,/g, ''));
    // If the number looks like "70K" style (small number), multiply by 1000
    return num < 1000 ? num * 1000 : num;
  };

  return {
    salaryMin: parseAmount(matches[1]),
    salaryMax: parseAmount(matches[2]),
  };
}

/**
 * Normalizes a raw Glassdoor scrape result into our standard schema.
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeGlassdoorJob(raw) {
  const { salaryMin, salaryMax } = parseSalaryText(raw.salaryText);

  // Clean up Glassdoor URLs (they often contain redirect tokens)
  let cleanUrl = raw.url || '';
  if (cleanUrl.includes('glassdoor.com')) {
    // Strip tracking parameters
    cleanUrl = cleanUrl.split('?')[0] + (cleanUrl.includes('/job-listing/') ? '' : '');
  }

  return {
    title: raw.title || 'Unknown Title',
    company: raw.company || 'Unknown Company',
    location: raw.location || 'Unknown',
    salaryMin,
    salaryMax,
    description: '', // Glassdoor requires login for full descriptions
    url: cleanUrl,
    source: 'glassdoor',
    postedDate: null, // Not available on card-level scrape
  };
}

/**
 * Fallback links for when Glassdoor scraping is blocked.
 */
const FALLBACK_LINKS = [
  {
    label: 'Glassdoor — Junior Developer (Phoenix)',
    url: 'https://www.glassdoor.com/Job/phoenix-junior-developer-jobs-SRCH_IL.0,7_IC1147401_KO8,24.htm',
  },
  {
    label: 'Glassdoor — Entry Level SWE (Remote)',
    url: 'https://www.glassdoor.com/Job/remote-entry-level-software-engineer-jobs-SRCH_IL.0,6_IS11047_KO7,36.htm',
  },
];

/**
 * Main export: scrapes Glassdoor jobs for a small subset of titles.
 *
 * @returns {Promise<{ jobs: Object[], fallbackLinks: Object[], blocked: boolean }>}
 */
async function fetchGlassdoor() {
  console.log('[Glassdoor] Starting scrape');

  const TITLES_TO_SCRAPE = JOB_TITLES.slice(0, 5);

  let browser;
  const allJobs = [];
  let blocked = false;

  try {
    browser = await chromium.launch({ headless: true });

    for (const title of TITLES_TO_SCRAPE) {
      // Search Phoenix listings
      const phoenixRaw = await scrapeGlassdoorPage(browser, title, false);
      const phoenixNorm = phoenixRaw.map(normalizeGlassdoorJob);
      allJobs.push(...phoenixNorm);
      await randomDelay();

      // Search remote listings
      const remoteRaw = await scrapeGlassdoorPage(browser, title, true);
      const remoteNorm = remoteRaw.map(normalizeGlassdoorJob);
      allJobs.push(...remoteNorm);
      await randomDelay();
    }

  } catch (err) {
    console.error(`[Glassdoor] Browser error — ${err.message}`);
    blocked = true;
  } finally {
    if (browser) await browser.close();
  }

  if (allJobs.length === 0) {
    blocked = true;
    console.warn('[Glassdoor] No jobs scraped — returning fallback links');
  }

  console.log(`[Glassdoor] Scraped ${allJobs.length} listings`);
  return { jobs: allJobs, fallbackLinks: FALLBACK_LINKS, blocked };
}

module.exports = { fetchGlassdoor, FALLBACK_LINKS };

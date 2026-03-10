/**
 * server/services/indeed.js — Indeed Jobs Playwright Scraper
 *
 * Indeed is the largest general job board. They don't offer a public API,
 * so we scrape their public search pages (card-level only, not full descriptions).
 *
 * URL pattern:
 *   https://www.indeed.com/jobs?q={title}&l={location}&explvl=entry_level
 *   explvl=entry_level = Indeed's entry-level filter
 *
 * Important:
 *  - We do NOT scrape full job descriptions — only card-level data
 *  - Rate limit: max 1 request per 2 seconds
 *  - Cache: 6 hours minimum
 *  - If blocked, return [] and show fallback deep-links
 *
 * Brandon: Indeed is heavily bot-protected. CloudFlare challenges are common.
 * The fallback links below will always work in your browser though.
 */

'use strict';

const { chromium } = require('playwright');
const { JOB_TITLES } = require('../config/sources');

const DELAY_MIN = Math.max(parseInt(process.env.SCRAPE_DELAY_MIN_MS || '1000', 10), 2000);
const DELAY_MAX = Math.max(parseInt(process.env.SCRAPE_DELAY_MAX_MS || '3000', 10), 4000);

function randomDelay() {
  return new Promise(resolve => {
    const ms = DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));
    setTimeout(resolve, ms);
  });
}

/**
 * Scrapes Indeed for a single (title, location) pair.
 * Extracts only card-level data — no individual listing pages.
 *
 * @param {Object} browser
 * @param {string} title
 * @param {string} location — "Phoenix, AZ" or "remote"
 * @returns {Promise<Object[]>}
 */
async function scrapeIndeedPage(browser, title, location) {
  const page = await browser.newPage();

  try {
    const encodedTitle = encodeURIComponent(title);
    const encodedLocation = encodeURIComponent(location);
    // fromage=30 = "from age" in days (only listings posted in last 30 days)
    const url = `https://www.indeed.com/jobs?q=${encodedTitle}&l=${encodedLocation}&explvl=entry_level&sort=date&fromage=30`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Indeed may show a CAPTCHA or redirect — detect it
    const currentUrl = page.url();
    if (currentUrl.includes('challenge') || currentUrl.includes('captcha')) {
      console.warn(`[Indeed] CAPTCHA detected for: "${title}" in "${location}"`);
      return [];
    }

    // Wait for job cards
    await page.waitForSelector('[data-jk]', { timeout: 8000 }).catch(() => null);

    const jobs = await page.evaluate(() => {
      // Indeed uses data-jk attribute on job card containers
      const cards = document.querySelectorAll('.job_seen_beacon, [data-jk]');
      const results = [];

      cards.forEach(card => {
        const titleEl = card.querySelector('[data-testid="jobTitle"] span, .jobTitle span');
        const companyEl = card.querySelector('[data-testid="company-name"], .companyName');
        const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation');
        const salaryEl = card.querySelector('.salary-snippet-container, [data-testid="salary-snippet"]');
        const dateEl = card.querySelector('.date, [data-testid="myJobsStateDate"]');

        // Build the job URL from the data-jk attribute
        const jobKey = card.getAttribute('data-jk') || card.querySelector('[data-jk]')?.getAttribute('data-jk');
        const jobUrl = jobKey ? `https://www.indeed.com/viewjob?jk=${jobKey}` : '';

        if (titleEl && jobUrl) {
          results.push({
            title: titleEl.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            location: locationEl?.textContent?.trim() || '',
            salaryText: salaryEl?.textContent?.trim() || '',
            dateText: dateEl?.textContent?.trim() || '',
            url: jobUrl,
          });
        }
      });

      return results;
    });

    return jobs;
  } catch (err) {
    console.error(`[Indeed] Failed: title="${title}" location="${location}" — ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Attempts to parse an Indeed salary string like "$65,000 - $90,000 a year".
 *
 * @param {string} salaryText
 * @returns {{ salaryMin: number|null, salaryMax: number|null }}
 */
function parseSalaryText(salaryText) {
  if (!salaryText) return { salaryMin: null, salaryMax: null };

  // Match patterns like "$65,000 - $90,000" or "$25 - $35 an hour"
  const yearlyMatch = salaryText.match(/\$([\d,]+)\s*[-–]\s*\$([\d,]+)\s*a?\s*year/i);
  const hourlyMatch = salaryText.match(/\$([\d.]+)\s*[-–]\s*\$([\d.]+)\s*(?:an?\s*hour|\/hr)/i);
  const singleMatch = salaryText.match(/\$([\d,]+)/);

  if (yearlyMatch) {
    return {
      salaryMin: parseInt(yearlyMatch[1].replace(/,/g, ''), 10),
      salaryMax: parseInt(yearlyMatch[2].replace(/,/g, ''), 10),
    };
  }

  if (hourlyMatch) {
    // Convert hourly to annual (2080 work hours/year)
    const minHourly = parseFloat(hourlyMatch[1]);
    const maxHourly = parseFloat(hourlyMatch[2]);
    return {
      salaryMin: Math.round(minHourly * 2080),
      salaryMax: Math.round(maxHourly * 2080),
    };
  }

  if (singleMatch) {
    const amount = parseInt(singleMatch[1].replace(/,/g, ''), 10);
    return { salaryMin: amount, salaryMax: null };
  }

  return { salaryMin: null, salaryMax: null };
}

/**
 * Normalizes a raw Indeed scrape result into our standard schema.
 *
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeIndeedJob(raw) {
  const { salaryMin, salaryMax } = parseSalaryText(raw.salaryText);

  // Parse relative date strings like "3 days ago" → rough Date estimate
  let postedDate = null;
  if (raw.dateText) {
    const daysAgo = raw.dateText.match(/(\d+)\s*days?\s*ago/i);
    const hoursAgo = raw.dateText.match(/(\d+)\s*hours?\s*ago/i);
    if (daysAgo) {
      postedDate = new Date(Date.now() - parseInt(daysAgo[1], 10) * 86400000);
    } else if (hoursAgo) {
      postedDate = new Date(Date.now() - parseInt(hoursAgo[1], 10) * 3600000);
    } else if (raw.dateText.toLowerCase().includes('just posted') || raw.dateText.toLowerCase().includes('today')) {
      postedDate = new Date();
    }
  }

  return {
    title: raw.title || 'Unknown Title',
    company: raw.company || 'Unknown Company',
    location: raw.location || 'Unknown',
    salaryMin,
    salaryMax,
    description: '',  // We don't scrape full descriptions from Indeed
    url: raw.url || '',
    source: 'indeed',
    postedDate,
  };
}

/**
 * Fallback links for when Indeed scraping is blocked.
 */
const FALLBACK_LINKS = [
  {
    label: 'Indeed — Entry Level SWE (Phoenix)',
    url: 'https://www.indeed.com/jobs?q=software+engineer&l=Phoenix%2C+AZ&explvl=entry_level',
  },
  {
    label: 'Indeed — Junior Developer (Remote)',
    url: 'https://www.indeed.com/jobs?q=junior+developer&l=remote&explvl=entry_level',
  },
  {
    label: 'Indeed — QA Automation Engineer',
    url: 'https://www.indeed.com/jobs?q=qa+automation+engineer&explvl=entry_level',
  },
  {
    label: 'Indeed — Cloud Associate',
    url: 'https://www.indeed.com/jobs?q=cloud+associate&explvl=entry_level',
  },
];

/**
 * Main export: scrapes Indeed for a subset of job titles.
 *
 * @returns {Promise<{ jobs: Object[], fallbackLinks: Object[], blocked: boolean }>}
 */
async function fetchIndeed() {
  console.log('[Indeed] Starting scrape');

  const TITLES_TO_SCRAPE = JOB_TITLES.slice(0, 5);
  const LOCATIONS = ['Phoenix, AZ', 'remote'];

  let browser;
  const allJobs = [];
  let blocked = false;

  try {
    browser = await chromium.launch({ headless: true });

    for (const title of TITLES_TO_SCRAPE) {
      for (const location of LOCATIONS) {
        const raw = await scrapeIndeedPage(browser, title, location);
        const normalized = raw.map(normalizeIndeedJob);
        allJobs.push(...normalized);
        await randomDelay();
      }
    }

  } catch (err) {
    console.error(`[Indeed] Browser error — ${err.message}`);
    blocked = true;
  } finally {
    if (browser) await browser.close();
  }

  if (allJobs.length === 0) {
    blocked = true;
    console.warn('[Indeed] No jobs scraped — returning fallback links');
  }

  console.log(`[Indeed] Scraped ${allJobs.length} listings`);
  return { jobs: allJobs, fallbackLinks: FALLBACK_LINKS, blocked };
}

module.exports = { fetchIndeed, FALLBACK_LINKS };

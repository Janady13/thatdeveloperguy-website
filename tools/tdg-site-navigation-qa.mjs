import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = (process.env.TDG_QA_BASE ?? 'https://tdg.thatwebhostingguy.com').replace(/\/$/, '');
const evidenceDir = resolve('evidence/site-navigation');
mkdirSync(evidenceDir, { recursive: true });

const routes = [
  '/',
  '/capabilities/business-it',
  '/government',
  '/capabilities/cybersecurity',
  '/company',
  '/contact',
  '/capabilities',
  '/privacy',
  '/accessibility',
];
const headerDestinations = [
  '/capabilities/business-it',
  '/government',
  '/capabilities/cybersecurity',
  '/company',
  '/contact',
];
const lobbyDestinations = {
  'door-IT': '/capabilities/business-it',
  'door-Gov': '/government',
  'door-Cyber': '/capabilities/cybersecurity',
  reception: '/contact',
  lounge: '/company',
};
const roomAnchors = {
  '/capabilities/business-it': {
    status: '#overview',
    helpdesk: '#support',
    workstations: '#workstations',
    racks: '#infrastructure',
    deployment: '#deployment',
    toolcart: '#deployment',
  },
  '/capabilities/cybersecurity': {
    monitoring: '#monitoring',
    health: '#security-review',
    response: '#response',
    infrastructure: '#infrastructure',
    process: '#process',
  },
};

const browser = await chromium.launch({ headless: true });
const results = { routes: {}, header: {}, lobby: {}, roomAnchors: {}, exits: {}, errors: [], failedRequests: [] };

async function open(path, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') results.errors.push(`${path}: ${message.text()}`); });
  page.on('pageerror', error => results.errors.push(`${path}: ${error.message}`));
  page.on('requestfailed', request => results.failedRequests.push(`${path}: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  const separator = path.includes('?') ? '&' : '?';
  const response = await page.goto(`${base}${path}${separator}navigation-qa=${Date.now()}`, { waitUntil: 'networkidle' });
  return { context, page, response };
}

async function clickAndReadPath(page, locator, waitMs = 2200) {
  let href = null;
  let clickError = null;
  try {
    href = await locator.getAttribute('href', { timeout: 4000 });
    await locator.click({ timeout: 4000 });
    await page.waitForTimeout(waitMs);
  } catch (error) {
    clickError = error instanceof Error ? error.message : String(error);
  }
  const url = new URL(page.url());
  return { href, path: url.pathname, hash: url.hash, clickError };
}

for (const path of routes) {
  const { context, page, response } = await open(path);
  results.routes[path] = {
    status: response?.status() ?? null,
    finalPath: new URL(page.url()).pathname,
    title: await page.title(),
    mainCount: await page.locator('main#content').count(),
    headerHrefCount: await page.locator('.site-header a[href]').count(),
  };
  await context.close();
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  results.header[viewport.name] = {};
  for (const from of ['/', '/capabilities/business-it', '/capabilities/cybersecurity', '/government']) {
    results.header[viewport.name][from] = {};
    for (const expected of headerDestinations) {
      const { context, page } = await open(from, { width: viewport.width, height: viewport.height });
      const outcome = await clickAndReadPath(page, page.locator(`.site-header a[href="${expected}"]`), 900);
      results.header[viewport.name][from][expected] = { ...outcome, passed: outcome.path === expected && !outcome.clickError };
      await context.close();
    }
  }
}

for (const [hit, expected] of Object.entries(lobbyDestinations)) {
  const { context, page } = await open('/');
  const outcome = await clickAndReadPath(page, page.locator(`[data-hit="${hit}"]`), 2600);
  results.lobby[hit] = { ...outcome, expected, passed: outcome.path === expected && !outcome.clickError };
  await context.close();
}

for (const [route, anchors] of Object.entries(roomAnchors)) {
  results.roomAnchors[route] = {};
  for (const [hit, expected] of Object.entries(anchors)) {
    const { context, page } = await open(route);
    const outcome = await clickAndReadPath(page, page.locator(`[data-hit="${hit}"]`), 900);
    results.roomAnchors[route][hit] = { ...outcome, expected, passed: outcome.path === route && outcome.hash === expected && !outcome.clickError };
    await context.close();
  }
}

for (const [route, hit, expected] of [
  ['/capabilities/cybersecurity', 'return-lobby', '/'],
  ['/capabilities/cybersecurity', 'briefing', '/contact'],
]) {
  const { context, page } = await open(route);
  const outcome = await clickAndReadPath(page, page.locator(`[data-hit="${hit}"]`), 1800);
  results.exits[`${route}:${hit}`] = { ...outcome, expected, passed: outcome.path === expected && !outcome.clickError };
  await context.close();
}

await browser.close();

const flattenPassed = value => {
  if (!value || typeof value !== 'object') return [];
  if ('passed' in value) return [Boolean(value.passed)];
  return Object.values(value).flatMap(flattenPassed);
};
const assertions = {
  everyRouteLoads: Object.values(results.routes).every(result => result.status === 200 && result.finalPath && result.mainCount === 1 && result.headerHrefCount >= 6),
  everyHeaderLinkWorks: flattenPassed(results.header).every(Boolean),
  everyLobbyDestinationWorks: flattenPassed(results.lobby).every(Boolean),
  everyRoomAnchorWorks: flattenPassed(results.roomAnchors).every(Boolean),
  everyRoomExitWorks: flattenPassed(results.exits).every(Boolean),
  noConsoleErrors: results.errors.length === 0,
  noFailedRequests: results.failedRequests.length === 0,
};
const report = { base, results, assertions, passed: Object.values(assertions).every(Boolean) };
writeFileSync(resolve(evidenceDir, 'navigation-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

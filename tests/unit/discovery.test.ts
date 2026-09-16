import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { robotsFor, robotsHeaderFor } from '../../src/engines/seo/crawl/robots-policy.ts';
import { sitemapEntries, sitemapXml, sitemapIndexXml } from '../../src/engines/seo/sitemaps/build-sitemap.ts';
import { llmsText } from '../../src/engines/seo/discovery/build-llms.ts';
import type { CompiledPage } from '../../src/contracts/page.ts';

const routes: any[] = [
  { id: 'home', path: '/', template: 'home', publicationStatus: 'published', indexPolicy: 'index', publishedAt: '2026-09-16' },
  { id: 'contact.received', path: '/contact/received', template: 'contact-received', publicationStatus: 'published', indexPolicy: 'noindex' },
  { id: 'capability.cybersecurity', path: '/capabilities/cybersecurity', template: 'capability', publicationStatus: 'demo', indexPolicy: 'index' },
];

test('the demo host disallows everything and sends noindex; production follows the approved matrix and never sends noindex', () => {
  assert.equal(robotsFor('demo'), 'User-agent: *\nDisallow: /\n');
  assert.equal(robotsHeaderFor('demo'), 'noindex, nofollow');
  const production = robotsFor('production');
  assert.equal(robotsHeaderFor('production'), 'all');
  assert.doesNotMatch(production, /noindex/);
  for (const token of ['Googlebot', 'Bingbot', 'GPTBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'OAI-SearchBot']) assert.match(production, new RegExp(`User-agent: ${token}\\nAllow: /`), `${token} should be allowed per the approved matrix`);
  assert.match(production, /Disallow: \/api\//); assert.match(production, /Disallow: \/contact\/received/);
  assert.match(production, /Sitemap: https:\/\/thatdeveloperguy\.com\/sitemap\.xml/); assert.match(production, /sitemap-index\.xml/);
});

test('the sitemap holds only published, indexable, canonical pages', () => {
  assert.deepEqual(sitemapEntries(routes), ['https://thatdeveloperguy.com/']);
  assert.doesNotMatch(sitemapXml(routes), /contact\/received|cybersecurity/);
  assert.match(sitemapXml(routes), /<lastmod>2026-09-16<\/lastmod>/);
  assert.match(sitemapIndexXml(), /<loc>https:\/\/thatdeveloperguy\.com\/sitemap\.xml<\/loc>/);
});

test('llms.txt is derived from visible page records and excludes noindex pages', () => {
  const pages = [
    { id: 'home', path: '/', heading: 'Lobby', description: 'Choose a service room.', canonical: 'https://thatdeveloperguy.com/', indexPolicy: 'index' },
    { id: 'receipt', path: '/contact/received', heading: 'Receipt', description: 'Private receipt.', canonical: 'https://thatdeveloperguy.com/contact/received', indexPolicy: 'noindex' },
  ] as CompiledPage[];
  const output = llmsText(pages, 'demo');
  assert.match(output, /non-indexable demonstration release/);
  assert.match(output, /\[Lobby\]\(https:\/\/thatdeveloperguy\.com\/\)/);
  assert.doesNotMatch(output, /Private receipt|contact\/received/);
});

test('the crawler policy record mirrors the node exactly', () => {
  const record = JSON.parse(readFileSync(new URL('../../records/crawler-policy.json', import.meta.url), 'utf8'));
  const node = JSON.parse(readFileSync('/Users/josephanady/Code/thatdeveloperguy-truth/properties/engine-policy.json', 'utf8')).enginePolicy;
  assert.deepEqual(record.bots, node.bots);
  assert.equal(record.approval_status, 'approved');
});

test('staging directives cannot reach the production host config', async () => {
  const { renderHostConfig } = await import('../../src/engines/seo/crawl/host-config.ts');
  const demo = renderHostConfig('demo', 'tdg.thatwebhostingguy.com'), production = renderHostConfig('production', 'thatdeveloperguy.com');
  assert.doesNotMatch(demo, /auth_basic "/); // open demo by owner decision; TDG_STAGING_GATE=on re-enables the gate
  process.env.TDG_STAGING_GATE = 'on'; assert.match(renderHostConfig('demo', 'tdg.thatwebhostingguy.com'), /auth_basic "ThatDeveloperGuy staging"/); delete process.env.TDG_STAGING_GATE; assert.match(demo, /X-Robots-Tag "noindex, nofollow"/);
  assert.doesNotMatch(production, /auth_basic "|htpasswd/);
  assert.doesNotMatch(production.replace(/location = \/api\/inquiries \{[\s\S]*?\n    \}/, ''), /noindex/, 'production may carry noindex only on the API endpoint');
  assert.match(production, /live\/thatdeveloperguy\.com\/fullchain/); assert.match(demo, /live\/thatwebhostingguy\.com\/fullchain/);
  assert.match(production, /X-Robots-Tag "all"/); assert.match(production, /server_name thatdeveloperguy\.com;/); assert.match(production, /root \/var\/www\/sites\/thatdeveloperguy;/);
  assert.doesNotMatch(production, /__[A-Z]+__/, 'no unrendered placeholders');
});

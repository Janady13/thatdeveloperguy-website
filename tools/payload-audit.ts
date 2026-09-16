/** Per-route payload from the browser's own resource timing: what each route actually downloads on a cold load. node --import tsx tools/payload-audit.ts [--base URL] */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1]! : d; };
const BASE = arg('--base', 'http://127.0.0.1:4411');
const routes = ['/', '/capabilities/business-it', '/capabilities/cybersecurity', '/government', '/company'];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const report: Record<string, unknown> = {};
for (const route of routes) {
  const auth = process.env.TDG_STAGING_AUTH?.split(':');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(auth ? { httpCredentials: { username: auth[0]!, password: auth[1]! } } : {}) });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as any).__lcp = null; (window as any).__poster = null;
    new PerformanceObserver(list => { for (const e of list.getEntries() as any[]) (window as any).__lcp = { ms: Math.round(e.startTime), element: e.element?.tagName + (e.element?.className ? '.' + e.element.className : ''), url: (e.url || '').replace(location.origin, '') }; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries() as any[]) if (e.identifier === 'poster') (window as any).__poster = { loadMs: Math.round(e.loadTime), renderMs: Math.round(e.renderTime), decodeMs: Math.round(e.renderTime - e.loadTime) }; }).observe({ type: 'element', buffered: true });
  });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const res = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(r => ({ url: r.name.replace(location.origin, ''), type: r.initiatorType, transfer: r.transferSize, decoded: r.decodedBodySize, ms: Math.round(r.responseEnd - r.startTime) }));
    const lcp = (window as any).__lcp; const poster = (window as any).__poster;
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
    return { html: { transfer: nav.transferSize, decoded: nav.decodedBodySize }, domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), paints, lcp, poster, resources: res, posters: res.filter(r => r.url.includes('/images/posters/')).map(r => r.url), riv: res.filter(r => r.url.endsWith('.riv')).map(r => r.url), scripts: res.filter(r => r.type === 'script' || r.url.endsWith('.js')).reduce((n, r) => n + r.transfer, 0), totalTransfer: nav.transferSize + res.reduce((n, r) => n + r.transfer, 0) };
  });
  report[route] = data;
  console.log(`${route}: html ${data.html.transfer}B, total transfer ${(data.totalTransfer / 1024).toFixed(0)} KB, scripts ${(data.scripts / 1024).toFixed(0)} KB, posters ${JSON.stringify(data.posters)}, riv ${JSON.stringify(data.riv)}, FCP ${data.paints['first-contentful-paint']} ms, LCP ${data.lcp?.ms} ms (${data.lcp?.element}), poster decode ${data.poster?.decodeMs ?? '-'} ms (loaded ${data.poster?.loadMs ?? '-'} → rendered ${data.poster?.renderMs ?? '-'}), load ${data.load} ms`);
  await context.close();
}
mkdirSync('evidence/performance', { recursive: true });
writeFileSync('evidence/performance/payload-audit.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), routes: report }, null, 2) + '\n');
await browser.close();

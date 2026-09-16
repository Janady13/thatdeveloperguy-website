import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePages, CONTENT_DIR } from '../../src/publication/compile-pages.server.ts';

test('production level compiles only published pages; demo level adds demo pages; drafts never compile', () => {
  const production = compilePages(CONTENT_DIR, 'published');
  assert.equal(production.pages.length, 0, 'nothing is approved for production yet');
  const demo = compilePages(CONTENT_DIR, 'demo');
  const paths = demo.pages.map(p => p.path).sort();
  assert.deepEqual(paths, ['/', '/accessibility', '/capabilities', '/capabilities/business-it', '/capabilities/cybersecurity', '/company', '/contact', '/contact/received', '/government', '/privacy']);
  assert.deepEqual(demo.drafts.sort(), ['approach', 'audience.business', 'capability-statement']);
});

test('compiled pages carry canonical, breadcrumbs, related links and a resolved action', () => {
  const { pages } = compilePages(CONTENT_DIR, 'demo');
  const it = pages.find(p => p.id === 'capability.business-it')!;
  assert.equal(it.canonical, 'https://thatdeveloperguy.com/capabilities/business-it');
  assert.deepEqual(it.breadcrumbs.map(b => b.path), ['/', '/capabilities', '/capabilities/business-it']);
  assert.equal(it.action.href, '/contact?project=itsupport&from=capability.business-it');
  assert.ok(it.bodyHtml.includes('<p>'));
  assert.ok(it.related.every(r => r.path.startsWith('/')));
  const received = pages.find(p => p.id === 'contact.received')!;
  assert.equal(received.indexPolicy, 'noindex');
});

test('lobby door destinations resolve through the registry, never a second URL list', () => {
  const { pages } = compilePages(CONTENT_DIR, 'demo');
  const byId = Object.fromEntries(pages.map(p => [p.id, p.path]));
  assert.equal(byId['capability.business-it'], '/capabilities/business-it');
  assert.equal(byId['audience.government'], '/government');
  assert.equal(byId['capability.cybersecurity'], '/capabilities/cybersecurity');
});

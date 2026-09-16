import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('capability pages carry the eight buyer answers, and every claimReference resolves to a fact on the projection', async () => {
  const { pages } = compilePages(CONTENT_DIR, 'demo');
  const projection = JSON.parse(readFileSync(new URL('../../build-inputs/authority/public-projection.json', import.meta.url), 'utf8'));
  const known: Record<string, unknown> = { 'org.foundingDate': projection.org.foundingDate, 'org.siteCount': 218, 'person.publicRecord': projection.person.url };
  for (const page of pages.filter(p => p.template === 'capability')) {
    const d = page.serviceDetail!;
    assert.ok(d.problem.length > 40 && d.audience.length && d.included.length && d.deliverables.length && d.excluded.length && d.evidence.length && d.process.length, `${page.id}: incomplete serviceDetail`);
    for (const ref of page.claimReferences) assert.ok(ref in known, `${page.id}: claimReference ${ref} is not a known fact`);
    for (const e of d.evidence) if (e.status === 'supported') assert.doesNotMatch(e.claim, /certif|clearance|24\/7|guarantee/i, `${page.id}: an unsupported kind of claim is marked supported`);
  }
});

test('structured data carries exactly the visible questions, never a separate answer set', async () => {
  const { pages } = compilePages(CONTENT_DIR, 'demo');
  const { assemblePageGraph } = await import('../../src/engines/seo/structured-data/assemble-page-graph.ts');
  const cyber = pages.find(p => p.id === 'capability.cybersecurity')!;
  assert.equal(cyber.questions.length, 7);
  const graph = assemblePageGraph(cyber)['@graph'] as Array<Record<string, any>>;
  const faq = graph.find(g => g['@type'] === 'FAQPage')!;
  assert.deepEqual(faq.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text]), cyber.questions.map(q => [q.question, q.answer]));
  assert.equal(graph.find(g => g['@type'] === 'Service')!.provider['@id'], 'https://thatdeveloperguy.com/#organization');
});

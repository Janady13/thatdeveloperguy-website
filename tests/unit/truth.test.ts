import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../../tools/import-truth.ts';

test('project copies node wording verbatim and lists what only the owner can supply', () => {
  const node = { canonicalHost: 'https://thatdeveloperguy.com/', org: { '@id': 'https://thatdeveloperguy.com/#organization', name: 'ThatDeveloperGuy', legalName: 'THATDEVELOPERGUY LLC', telephone: '+14176712606', telephoneDisplay: '417 671 2606', email: 'admin@thatdeveloperguy.com', foundingDate: '2017', address: { addressLocality: 'Cassville', addressRegion: 'MO' }, sameAs: ['https://www.wikidata.org/wiki/Q139709771'] }, person: { '@id': 'https://thatdeveloperguy.com/#person', name: 'Joseph W. Anady', jobTitle: 'Founder and Principal Engineer', url: 'https://feedthejoe.com/joseph/' }, properties: { hosts: [{ host: 'thatdeveloperguy.com', role: 'the main face' }] } };
  const p = project(node as any, 'abc123');
  assert.equal(p.schema, 'tdg-site-truth/v1'); assert.equal(p.sourceCommit, 'abc123');
  assert.equal(p.org.legalName, 'THATDEVELOPERGUY LLC'); assert.equal(p.org.telephoneDisplay, '417 671 2606');
  assert.equal(p.person.jobTitle, 'Founder and Principal Engineer');
  assert.equal(p.host.role, 'the main face');
  assert.ok(p.ownerToSupply.includes('CAGE code'));
  assert.equal(JSON.stringify(p).includes('SDVOSB'), false);
});

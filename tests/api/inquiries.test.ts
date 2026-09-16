import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../server/app.ts';
import { loadConfig } from '../../server/config.ts';
import type { Provider, ProviderResult } from '../../server/email/provider.ts';

const ENV = { PUBLIC_ORIGIN: 'https://tdg.test', SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'u@tdg.test', SMTP_TO: 'inbox@tdg.test', DELIVERY_TIMEOUT_MS: '150', RATE_LIMIT_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000' };
const contact = { path: '/contact', receivedPath: '/contact/received', telephone: '+10000000000', email: 'inbox@tdg.test' };
const good = { name: 'Pat Example', email: 'pat@example.org', organization: 'Example County', service: 'security', message: 'We need a security review of two offices and a small data center.', from: 'capability.cybersecurity', website: '' };

function fakeProvider(behaviour: 'accept' | 'reject' | 'hang' | 'throw5xx' | 'throwNet'): Provider & { sent: number } {
  const provider = { sent: 0, close() {}, async send(): Promise<ProviderResult> {
    provider.sent++;
    if (behaviour === 'accept') return { accepted: ['inbox@tdg.test'], rejected: [] };
    if (behaviour === 'reject') return { accepted: [], rejected: ['inbox@tdg.test'] };
    if (behaviour === 'throw5xx') throw Object.assign(new Error('Message rejected'), { responseCode: 550 });
    if (behaviour === 'throwNet') throw Object.assign(new Error('socket closed'), { code: 'ECONNRESET' });
    return new Promise(() => {}); // hang
  } };
  return provider;
}
async function appWith(behaviour: Parameters<typeof fakeProvider>[0], env: Record<string, string> = {}) { const provider = fakeProvider(behaviour); const app = await buildApp({ config: loadConfig({ ...ENV, ...env }), provider, contact, logger: false }); return { app, provider }; }
const json = (app: any, body: unknown, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url: '/api/inquiries', headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://tdg.test', ...headers }, payload: body });
const form = (app: any, body: Record<string, string>, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url: '/api/inquiries', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://tdg.test', ...headers }, payload: new URLSearchParams(body).toString() });

describe('inquiry outcomes', () => {
  test('provider acceptance of the fixed recipient → provider_accepted (JSON) and 303 to the generic receipt (form)', async () => {
    const { app, provider } = await appWith('accept');
    const r = await json(app, good); assert.equal(r.statusCode, 200); assert.equal(r.json().outcome, 'provider_accepted'); assert.ok(r.headers['x-request-id']);
    const f = await form(app, { ...good, message: 'A different message so it is not a duplicate of the first.' }); assert.equal(f.statusCode, 303); assert.equal(f.headers.location, '/contact/received'); assert.equal(f.body, '');
    assert.equal(provider.sent, 2); await app.close();
  });
  test('provider rejection is never shown as success', async () => {
    const { app } = await appWith('reject');
    const r = await json(app, good); assert.equal(r.statusCode, 502); assert.equal(r.json().outcome, 'provider_rejected');
    const f = await form(app, { ...good, message: 'Second distinct message for the HTML path check here.' }); assert.equal(f.statusCode, 502); assert.match(f.body, /<h1>Message not sent<\/h1>/); assert.doesNotMatch(f.body, /Pat Example|pat@example/);
    await app.close();
  });
  test('a 5xx provider error is a rejection; a transport error is delivery_unknown', async () => {
    const a = await appWith('throw5xx'); assert.equal((await json(a.app, good)).json().outcome, 'provider_rejected'); await a.app.close();
    const b = await appWith('throwNet'); const r = await json(b.app, good); assert.equal(r.statusCode, 504); assert.equal(r.json().outcome, 'delivery_unknown'); await b.app.close();
  });
  test('a provider timeout is delivery_unknown and is not retried', async () => {
    const { app, provider } = await appWith('hang');
    const t = Date.now(); const r = await json(app, good);
    assert.equal(r.json().outcome, 'delivery_unknown'); assert.ok(Date.now() - t < 2000); assert.equal(provider.sent, 1);
    const again = await json(app, good); assert.equal(again.json().outcome, 'delivery_unknown'); assert.equal(again.json().duplicate, true); assert.equal(provider.sent, 1, 'identical resend is answered from the record, not sent again');
    await app.close();
  });
  test('duplicate submissions inside the window are not sent twice', async () => {
    const { app, provider } = await appWith('accept');
    await json(app, good); const r = await json(app, good);
    assert.equal(r.json().outcome, 'provider_accepted'); assert.equal(r.json().duplicate, true); assert.equal(provider.sent, 1); await app.close();
  });
});

describe('refusals', () => {
  test('validation failures name the fields and send nothing', async () => {
    const { app, provider } = await appWith('accept');
    const r = await json(app, { ...good, email: 'not-an-address', message: 'short' });
    assert.equal(r.statusCode, 422); assert.equal(r.json().outcome, 'validation_failed'); assert.deepEqual(Object.keys(r.json().fields).sort(), ['email', 'message']);
    const f = await form(app, { ...good, name: 'X' }); assert.equal(f.statusCode, 422); assert.match(f.body, /<strong>name<\/strong>/);
    assert.equal(provider.sent, 0); await app.close();
  });
  test('honeypot, unknown fields and header-injection attempts are refused before delivery', async () => {
    const { app, provider } = await appWith('accept', { RATE_LIMIT_MAX: '20' });
    assert.equal((await json(app, { ...good, website: 'http://spam' })).json().outcome, 'validation_failed');
    assert.equal((await json(app, { ...good, extra: 'x' })).json().outcome, 'validation_failed');
    assert.equal((await json(app, { ...good, name: 'Pat\r\nBcc: victim@example.org' })).json().outcome, 'validation_failed');
    assert.equal((await json(app, { ...good, email: 'a@b.co,victim@example.org' })).json().outcome, 'validation_failed');
    assert.equal(provider.sent, 0); await app.close();
  });
  test('link-stuffed messages are refused as abuse', async () => {
    const { app, provider } = await appWith('accept');
    const r = await json(app, { ...good, message: 'see http://a.x http://b.x http://c.x http://d.x http://e.x now' });
    assert.equal(r.json().outcome, 'abuse_refused'); assert.equal(provider.sent, 0); await app.close();
  });
  test('cross-origin submissions are refused', async () => {
    const { app, provider } = await appWith('accept');
    assert.equal((await json(app, good, { origin: 'https://evil.example' })).json().outcome, 'validation_failed');
    assert.equal((await json(app, good, { 'sec-fetch-site': 'cross-site' })).json().outcome, 'validation_failed');
    assert.equal(provider.sent, 0); await app.close();
  });
  test('rate limiting answers with rate_limited after the allowance', async () => {
    const { app } = await appWith('accept');
    const outcomes = []; for (let i = 0; i < 5; i++) outcomes.push((await json(app, { ...good, message: `Distinct message number ${i} to avoid the duplicate policy.` })).json().outcome);
    assert.deepEqual(outcomes, ['provider_accepted', 'provider_accepted', 'provider_accepted', 'rate_limited', 'rate_limited']); await app.close();
  });
  test('oversized bodies are refused', async () => {
    const { app } = await appWith('accept');
    const r = await json(app, { ...good, message: 'x'.repeat(20_000) }); assert.equal(r.statusCode, 422); await app.close();
  });
  test('visiting the receipt path is not an API success and health exposes nothing', async () => {
    const { app } = await appWith('accept');
    assert.equal((await app.inject({ method: 'GET', url: '/contact/received' })).statusCode, 404);
    const h = await app.inject({ method: 'GET', url: '/api/health' }); assert.deepEqual(h.json(), { ok: true }); await app.close();
  });
});

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.ts';
import type { Provider } from './email/provider.ts';
import { validateInquiry, looksAbusive } from './inquiries/validate.ts';
import { deliver } from './inquiries/deliver.ts';
import { DuplicatePolicy } from './inquiries/duplicate-request-policy.ts';
import { OUTCOME_STATUS, OUTCOME_TEXT, type Outcome } from './inquiries/delivery-outcome.ts';
import { outcomePage } from './inquiries/html-response.ts';
import { originAllowed } from './security/origin-policy.ts';
import { clientTag, redactingSerializers, type InquiryLogEvent } from './logging/logger.ts';

export interface AppOptions { config: Config; provider: Provider; contact: { path: string; receivedPath: string; telephone: string; email: string }; logger?: boolean }
export const BODY_LIMIT = 16 * 1024;

/** Same-origin inquiry endpoint: validates, refuses abuse, rate-limits, delivers once, and reports only what the provider said. */
export async function buildApp({ config, provider, contact, logger = true }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ? { level: 'info', serializers: redactingSerializers as never, redact: { paths: ['req.headers', 'req.body', 'res.headers'], remove: true } } : false, // serializers narrow pino's shapes on purpose: no raw IP, no body, no headers
    bodyLimit: BODY_LIMIT, requestTimeout: 30_000, connectionTimeout: 30_000, keepAliveTimeout: 5_000, trustProxy: config.trustProxy,
    genReqId: () => randomUUID(),
    disableRequestLogging: true,
  });
  const duplicates = new DuplicatePolicy(config.duplicateWindowMs);
  await app.register(formbody, { bodyLimit: BODY_LIMIT });
  await app.register(rateLimit, { global: false, max: config.rateLimit.max, timeWindow: config.rateLimit.windowMs, keyGenerator: request => request.ip, addHeadersOnExceeding: { 'x-ratelimit-limit': false, 'x-ratelimit-remaining': false, 'x-ratelimit-reset': false } });

  app.addHook('onSend', async (_request, reply) => { reply.header('cache-control', 'no-store'); reply.header('x-content-type-options', 'nosniff'); reply.header('referrer-policy', 'no-referrer'); });

  app.get('/api/health', async (_request, reply) => reply.send({ ok: true }));

  const wantsJson = (accept: string | undefined, contentType: string | undefined) => (accept ?? '').includes('application/json') || (contentType ?? '').includes('application/json');

  app.post('/api/inquiries', {
    config: { rateLimit: { max: config.rateLimit.max, timeWindow: config.rateLimit.windowMs } },
    errorHandler: (error, request, reply) => {
      const outcome: Outcome = error.statusCode === 429 ? 'rate_limited' : 'validation_failed';
      respond(request, reply, outcome, { detail: error.statusCode === 429 ? 'rate limit' : `request error ${error.statusCode ?? ''}`.trim(), mode: wantsJson(request.headers.accept, request.headers['content-type']) ? 'json' : 'form' });
    },
  }, async (request, reply) => {
    const mode: 'json' | 'form' = wantsJson(request.headers.accept, request.headers['content-type']) ? 'json' : 'form';
    if (!originAllowed(request, config.allowedOrigins)) return respond(request, reply, 'validation_failed', { detail: 'origin refused', mode, fields: { form: 'This form only accepts submissions from the website itself.' } });
    const validation = validateInquiry(request.body);
    if (!validation.ok) return respond(request, reply, 'validation_failed', { detail: 'fields', mode, fields: validation.fields });
    const inquiry = validation.value;
    const abuse = looksAbusive(inquiry);
    if (abuse) return respond(request, reply, 'abuse_refused', { detail: abuse, mode, service: inquiry.service, from: inquiry.from });
    const digest = duplicates.digest(inquiry);
    const earlier = duplicates.lookup(digest);
    if (earlier) return respond(request, reply, earlier.outcome, { detail: `duplicate of ${earlier.requestId}`, mode, duplicate: true, service: inquiry.service, from: inquiry.from });
    const result = await deliver(config, provider, inquiry, request.id);
    duplicates.remember(digest, { outcome: result.outcome, requestId: request.id, at: Date.now() });
    return respond(request, reply, result.outcome, { detail: result.detail, mode, service: inquiry.service, from: inquiry.from });
  });

  function respond(request: FastifyRequest, reply: FastifyReply, outcome: Outcome, extra: { detail: string; mode: 'json' | 'form'; fields?: Record<string, string>; duplicate?: boolean; service?: string; from?: string }) {
    const event: InquiryLogEvent = { event: 'inquiry', requestId: request.id, outcome, detail: extra.detail, service: extra.service, from: extra.from, elapsedMs: Math.round(reply.elapsedTime), client: clientTag(request.ip), duplicate: extra.duplicate, mode: extra.mode };
    request.log.info(event, 'inquiry handled');
    reply.header('x-request-id', request.id);
    if (extra.mode === 'json') return reply.code(OUTCOME_STATUS[outcome]).send({ outcome, requestId: request.id, title: OUTCOME_TEXT[outcome].title, message: OUTCOME_TEXT[outcome].body, fields: extra.fields ?? {}, duplicate: extra.duplicate ?? false });
    // Plain HTML form path: provider acceptance → generic receipt; anything else → an accessible page that says what happened.
    if (outcome === 'provider_accepted') return reply.code(303).header('location', contact.receivedPath).send();
    return reply.code(OUTCOME_STATUS[outcome]).type('text/html; charset=utf-8').send(outcomePage(outcome, { fields: extra.fields, contactPath: contact.path, telephone: contact.telephone, email: contact.email, requestId: request.id }));
  }

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not found' }));
  app.addHook('onClose', async () => provider.close());
  return app;
}

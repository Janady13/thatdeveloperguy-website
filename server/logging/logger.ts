import { createHash } from 'node:crypto';

/** Operational log fields. No names, addresses, message text or raw IPs ever enter the log. */
export interface InquiryLogEvent { event: 'inquiry'; requestId: string; outcome: string; detail?: string; service?: string; from?: string; elapsedMs: number; client: string; duplicate?: boolean; mode: 'json' | 'form' }

const salt = createHash('sha256').update(`${process.pid}:${Date.now()}`).digest('hex').slice(0, 16);
/** Per-process salted hash: enough to correlate abuse within a run, useless to identify a person afterwards. */
export function clientTag(ip: string | undefined): string {
  return createHash('sha256').update(`${salt}:${ip ?? ''}`).digest('hex').slice(0, 12);
}

/** Pino serializers that drop request bodies and headers from every log line. */
export const redactingSerializers = {
  req: (req: { id?: string; method?: string; url?: string }) => ({ id: req.id, method: req.method, url: typeof req.url === 'string' ? req.url.split('?')[0] : undefined }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  err: (err: { name?: string; code?: string; message?: string }) => ({ name: err.name, code: err.code, message: err.message?.slice(0, 200) }),
};

import { createHash } from 'node:crypto';
import type { Inquiry } from './validate.ts';
import type { Outcome } from './delivery-outcome.ts';

export interface DuplicateRecord { outcome: Outcome; requestId: string; at: number }

/**
 * A resend of the same message within the window (double-click, refresh of the POST, retry after an uncertain timeout)
 * gets the first attempt's outcome back and is not sent again. Ambiguous outcomes are not retried automatically either:
 * a second identical message could arrive twice, so the visitor is told to call if it matters.
 */
export class DuplicatePolicy {
  private readonly seen = new Map<string, DuplicateRecord>();
  constructor(private readonly windowMs: number, private readonly max = 2000) {}
  digest(inquiry: Inquiry): string {
    return createHash('sha256').update([inquiry.email.toLowerCase(), inquiry.name.toLowerCase(), inquiry.message.replace(/\s+/g, ' ').trim().toLowerCase()].join('\n')).digest('hex');
  }
  lookup(digest: string, now = Date.now()): DuplicateRecord | null {
    const record = this.seen.get(digest);
    if (!record) return null;
    if (now - record.at > this.windowMs) { this.seen.delete(digest); return null; }
    return record;
  }
  remember(digest: string, record: DuplicateRecord): void {
    if (this.seen.size >= this.max) { const oldest = this.seen.keys().next().value; if (oldest) this.seen.delete(oldest); }
    this.seen.set(digest, record);
  }
}

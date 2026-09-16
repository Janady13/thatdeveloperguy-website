import type { Config } from '../config.ts';
import type { Provider } from '../email/provider.ts';
import { soleRecipientAccepted } from '../email/provider.ts';
import { assertSingleAddress, safeDisplayName } from '../email/header-safety.ts';
import { bodyFor, subjectFor } from '../email/templates.ts';
import type { Inquiry } from './validate.ts';
import type { Outcome } from './delivery-outcome.ts';

export interface DeliveryResult { outcome: Extract<Outcome, 'provider_accepted' | 'provider_rejected' | 'delivery_unknown'>; detail: string }

/** One attempt, one fixed recipient, a hard timeout. A timeout is `delivery_unknown`, never a retry and never a success. */
export async function deliver(config: Config, provider: Provider, inquiry: Inquiry, requestId: string, now = new Date()): Promise<DeliveryResult> {
  const message = {
    from: config.smtp.from, to: assertSingleAddress(config.smtp.to), envelope: { from: config.smtp.from, to: [config.smtp.to] },
    replyTo: { name: safeDisplayName(inquiry.name), address: assertSingleAddress(inquiry.email) },
    subject: subjectFor(inquiry), text: bodyFor(inquiry, requestId, now), headers: { 'X-TDG-Request-ID': requestId },
  };
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), config.deliveryTimeoutMs); });
  try {
    const result = await Promise.race([provider.send(message), timeout]);
    if (result === 'timeout') return { outcome: 'delivery_unknown', detail: `no provider response within ${config.deliveryTimeoutMs} ms` };
    if (soleRecipientAccepted(result, config.smtp.to)) return { outcome: 'provider_accepted', detail: 'accepted for the fixed recipient' };
    return { outcome: 'provider_rejected', detail: `accepted=${result.accepted?.length ?? 0} rejected=${result.rejected?.length ?? 0} pending=${result.pending?.length ?? 0}` };
  } catch (error) {
    const code = (error as { code?: string; responseCode?: number }).code ?? (error as { responseCode?: number }).responseCode;
    // A definite refusal from the provider (5xx / auth) is a rejection; a transport failure after the message may have left is unknown.
    if (typeof code === 'number' && code >= 500) return { outcome: 'provider_rejected', detail: `provider responded ${code}` };
    if (code === 'EAUTH' || code === 'EENVELOPE' || code === 'EMESSAGE') return { outcome: 'provider_rejected', detail: String(code) };
    return { outcome: 'delivery_unknown', detail: String(code ?? (error as Error).name ?? 'transport error') };
  } finally { if (timer) clearTimeout(timer); }
}

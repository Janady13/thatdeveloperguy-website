/** The only outcomes the site may report. Success is provider acceptance — never mailbox delivery. */
export type Outcome = 'validation_failed' | 'rate_limited' | 'abuse_refused' | 'provider_accepted' | 'provider_rejected' | 'delivery_unknown';

export const OUTCOME_STATUS: Record<Outcome, number> = {
  validation_failed: 422, rate_limited: 429, abuse_refused: 422, provider_accepted: 200, provider_rejected: 502, delivery_unknown: 504,
};

export const OUTCOME_TEXT: Record<Outcome, { title: string; body: string }> = {
  validation_failed: { title: 'Check the form', body: 'Some fields need attention. Nothing was sent.' },
  rate_limited: { title: 'Too many messages', body: 'This connection has sent several messages recently. Wait a few minutes, or call.' },
  abuse_refused: { title: 'Message not accepted', body: 'The message looked like unsolicited bulk mail and was not sent. If that is wrong, call or write to the address in the footer.' },
  provider_accepted: { title: 'Message received', body: 'The email service accepted your message for delivery.' },
  provider_rejected: { title: 'Message not sent', body: 'The email service refused the message. Nothing was stored. Please call or write to the address in the footer.' },
  delivery_unknown: { title: 'Delivery uncertain', body: 'The email service did not confirm within the time allowed. The message may or may not arrive; if it matters, call.' },
};

import type { Outcome } from './delivery-outcome.ts';
import { OUTCOME_TEXT } from './delivery-outcome.ts';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Accessible HTML for the JavaScript-off path: a real page with a heading, the outcome, and a way back. No visitor data is echoed. */
export function outcomePage(outcome: Outcome, options: { fields?: Record<string, string>; contactPath: string; telephone: string; email: string; requestId: string }): string {
  const text = OUTCOME_TEXT[outcome];
  const fieldList = options.fields && Object.keys(options.fields).length
    ? `<ul>${Object.entries(options.fields).map(([field, message]) => `<li><strong>${escape(field)}</strong>: ${escape(message)}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escape(text.title)} — ThatDeveloperGuy</title><link rel="stylesheet" href="/fonts/fonts.css"><style>body{margin:0;font-family:'Public Sans',system-ui,sans-serif;background:#f4f1fa;color:#2a1f4a;line-height:1.55}main{max-width:640px;margin:0 auto;padding:48px 24px}h1{font-family:'Archivo Black','Public Sans',sans-serif;font-weight:400;color:#2f1f5e}a{color:#4a2f8a}.ref{color:#5c4d85;font-size:.9rem}</style></head><body><main id="content"><h1>${escape(text.title)}</h1><p>${escape(text.body)}</p>${fieldList}<p><a href="${escape(options.contactPath)}">Back to the form</a> · <a href="tel:${escape(options.telephone)}">Call</a> · <a href="mailto:${escape(options.email)}">Email</a></p><p class="ref">Reference ${escape(options.requestId)}</p></main></body></html>`;
}

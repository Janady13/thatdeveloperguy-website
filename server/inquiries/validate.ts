import { z } from 'zod';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const singleLine = (min: number, max: number) => z.string().trim().min(min).max(max).refine(v => !/[\r\n]/.test(v) && !CONTROL.test(v), 'no line breaks or control characters');
export const SERVICES = ['itsupport', 'govweb', 'security', 'general'] as const;
export type ServiceIntent = (typeof SERVICES)[number];

/** The public form's fields. `website` is the honeypot and must stay empty. Unknown fields are rejected. */
export const inquirySchema = z.object({
  name: singleLine(2, 120),
  email: z.string().trim().max(200).email().refine(v => !/[\r\n,;<>\s]/.test(v), 'one plain address'),
  organization: singleLine(0, 160).optional().default(''),
  service: z.enum(SERVICES).default('general'),
  message: z.string().trim().min(10).max(4000).refine(v => !CONTROL.test(v), 'no control characters'),
  from: z.string().trim().max(80).regex(/^[a-z0-9.-]*$/i).optional().default(''),
  website: z.literal(''),
}).strict();
export type Inquiry = z.infer<typeof inquirySchema>;

export const FIELD_MESSAGES: Record<string, string> = {
  name: 'Enter your name (2 to 120 characters, one line).',
  email: 'Enter one valid email address for the reply.',
  organization: 'Organization must be one line of up to 160 characters.',
  service: 'Choose what this is about.',
  message: 'Write a message of 10 to 4,000 characters.',
  from: 'The form could not be validated. Reload the page and try again.',
  website: 'The form could not be validated.',
};

export interface ValidationFailure { ok: false; fields: Record<string, string> }
export interface ValidationSuccess { ok: true; value: Inquiry }

export function validateInquiry(body: unknown): ValidationSuccess | ValidationFailure {
  const candidate = body && typeof body === 'object' && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : v == null ? '' : String(v)]))
    : {};
  const parsed = inquirySchema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? 'form'); fields[key] = FIELD_MESSAGES[key] ?? 'Check this field.'; }
  return { ok: false, fields };
}

/** More than a handful of links in a short message is the common spam shape; it is refused as abuse, not as validation. */
export function looksAbusive(inquiry: Inquiry): string | null {
  const links = (inquiry.message.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > 4) return 'too many links';
  if (/\b(viagra|casino|seo backlinks|crypto pump)\b/i.test(inquiry.message)) return 'known spam phrase';
  return null;
}

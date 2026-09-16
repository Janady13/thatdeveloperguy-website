import type { Inquiry } from '../inquiries/validate.ts';
import { safeDisplayName } from './header-safety.ts';

export const SERVICE_LABEL: Record<Inquiry['service'], string> = { itsupport: 'IT Services', govweb: 'Government Solutions', security: 'Cyber Security', general: 'General' };

export function subjectFor(inquiry: Inquiry): string {
  return `Website inquiry — ${SERVICE_LABEL[inquiry.service]} — ${safeDisplayName(inquiry.name)}`;
}

export function bodyFor(inquiry: Inquiry, requestId: string, receivedAt: Date): string {
  return [
    'New inquiry from thatdeveloperguy.com', `Reference: ${requestId}`, `Received: ${receivedAt.toISOString()}`, '',
    `Name: ${inquiry.name}`, `Email: ${inquiry.email}`, `Organization: ${inquiry.organization || 'Not provided'}`,
    `About: ${SERVICE_LABEL[inquiry.service]}`, `Came from page: ${inquiry.from || 'unknown'}`, '',
    'Message:', inquiry.message, '',
    'The website keeps no copy of this message.',
  ].join('\n');
}

import nodemailer from 'nodemailer';
import type { SmtpConfig } from '../config.ts';

export interface OutboundMessage { from: string; to: string; replyTo: { name: string; address: string }; envelope: { from: string; to: string[] }; subject: string; text: string; headers: Record<string, string> }
export interface ProviderResult { accepted?: Array<string | { address: string }>; rejected?: Array<string | { address: string }>; pending?: unknown[] }
export interface Provider { send(message: OutboundMessage): Promise<ProviderResult>; close(): void }

/** Direct SMTP with TLS required; message content can never reach files or URLs. */
export function createSmtpProvider(config: SmtpConfig): Provider {
  const transporter = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass },
    requireTLS: true, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: config.host },
    pool: false, connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000, dnsTimeout: 5_000, logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return { send: message => transporter.sendMail({ ...message, disableFileAccess: true, disableUrlAccess: true } as never) as Promise<ProviderResult>, close: () => transporter.close() };
}

/** Provider acceptance of exactly the fixed recipient, nothing rejected, nothing pending. Still not mailbox delivery. */
export function soleRecipientAccepted(result: ProviderResult, recipient: string): boolean {
  const accepted = result.accepted ?? [];
  const first = accepted[0];
  const address = typeof first === 'string' ? first : first?.address;
  return accepted.length === 1 && address?.toLowerCase() === recipient.toLowerCase() && (result.rejected?.length ?? 0) === 0 && (result.pending?.length ?? 0) === 0;
}

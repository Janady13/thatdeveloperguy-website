import { ONE_ADDRESS } from '../config.ts';

/** Nothing from the visitor reaches a header unfiltered: names lose line breaks and angle brackets; addresses were validated as one plain token. */
export function safeDisplayName(name: string): string {
  return name.replace(/[\r\n"<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}
export function assertSingleAddress(address: string): string {
  if (!ONE_ADDRESS.test(address)) throw new Error('address is not a single plain mailbox');
  return address;
}

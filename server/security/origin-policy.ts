import type { FastifyRequest } from 'fastify';

/** Same-origin submissions only. Browsers send Origin on form POSTs and fetches; a missing Origin with a foreign Referer is refused too. */
export function originAllowed(request: FastifyRequest, allowed: string[]): boolean {
  const fetchSite = request.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = request.headers.origin;
  if (typeof origin === 'string') return allowed.includes(origin);
  const referer = request.headers.referer;
  if (typeof referer === 'string') { try { return allowed.includes(new URL(referer).origin); } catch { return false; } }
  return false;
}

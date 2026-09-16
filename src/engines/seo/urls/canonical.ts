import { PRODUCTION_ORIGIN } from './production-origin.ts';
import { normalizePath } from './normalize-path.ts';
export function canonicalUrl(path: string): string {
  const normalized = normalizePath(path);
  return normalized === '/' ? `${PRODUCTION_ORIGIN}/` : `${PRODUCTION_ORIGIN}${normalized}`;
}

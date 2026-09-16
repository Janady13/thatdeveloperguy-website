import policy from '../../../../records/crawler-policy.json' with { type: 'json' };
import { PRODUCTION_ORIGIN } from '../urls/production-origin.ts';

export type ReleaseKind = 'demo' | 'production';

/** robots.txt has exactly one generated owner. Demo hosts disallow everything; production follows the owner's approved bot matrix. */
export function robotsFor(kind: ReleaseKind): string {
  if (kind === 'demo') return 'User-agent: *\nDisallow: /\n';
  const groups = policy.bots.map(bot => `User-agent: ${bot.token}\n${bot.decision === 'allow' ? 'Allow: /' : 'Disallow: /'}\n`).join('\n');
  const protectedPaths = policy.protected_paths.map(p => `Disallow: ${p}`).join('\n');
  return `# Approved by ${policy.approved_by}, ${policy.approved_at}\n${groups}\nUser-agent: *\nAllow: /\n${protectedPaths}\n\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\nSitemap: ${PRODUCTION_ORIGIN}/sitemap-index.xml\n`;
}

/** X-Robots-Tag for the host config: staging is noindex regardless of what robots.txt says. */
export function robotsHeaderFor(kind: ReleaseKind): string { return kind === 'demo' ? 'noindex, nofollow' : 'all'; }

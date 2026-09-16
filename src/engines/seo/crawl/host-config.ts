import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { robotsHeaderFor, type ReleaseKind } from './robots-policy.ts';

/** Render deploy/nginx/site.conf for a release kind. Staging-only directives (auth gate, noindex header) exist only in the demo render. */
export function renderHostConfig(kind: ReleaseKind, host: string, template = readFileSync(resolve(import.meta.dirname, '../../../../deploy/nginx/site.conf'), 'utf8')): string {
  return template
    .replaceAll('__HOST__', host)
    .replaceAll('__ROOT__', `/var/www/sites/${host.split('.')[0]}`)
    .replaceAll('__KIND__', kind)
    .replaceAll('__CERT__', kind === 'demo' ? 'thatwebhostingguy.com' : 'thatdeveloperguy.com')
    .replaceAll('__ROBOTS__', robotsHeaderFor(kind))
    .replaceAll('__AUTH__', kind === 'demo' && process.env.TDG_STAGING_GATE === 'on' ? 'auth_basic "ThatDeveloperGuy staging"; auth_basic_user_file /etc/nginx/tdg-demo.htpasswd;' : kind === 'demo' ? '# staging gate off (owner decision 2026-09-16: open demo for device testing; noindex + robots Disallow remain). Set TDG_STAGING_GATE=on to re-enable.' : '# production: no access gate');
}

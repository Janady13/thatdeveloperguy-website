import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './kits.ts';

export const NODE_ROOT = '/Users/josephanady/Code/thatdeveloperguy-truth';
export const OWNER_TO_SUPPLY = ['CAGE code', 'SAM.gov Active date', 'SBA VetCert status', 'NAICS approval', 'PSC codes', 'Named past-performance clients'] as const;

export interface Projection {
  schema: 'tdg-site-truth/v1'; sourceCommit: string; importedAt: string;
  org: { id: string; name: string; legalName: string; telephone: string; telephoneDisplay: string; email: string; foundingDate: string; address: Record<string, string>; sameAs: string[] };
  person: { id: string; name: string; jobTitle: string; url: string };
  host: { host: string; role: string };
  ownerToSupply: string[];
}

/** Copies fields verbatim; never derives, rewrites or "improves" wording. */
export function project(node: any, sourceCommit: string): Projection {
  const host = (node.properties?.hosts ?? []).find((h: any) => h.host === 'thatdeveloperguy.com') ?? { host: 'thatdeveloperguy.com', role: '' };
  return {
    schema: 'tdg-site-truth/v1', sourceCommit, importedAt: new Date().toISOString(),
    org: { id: node.org['@id'], name: node.org.name, legalName: node.org.legalName, telephone: node.org.telephone, telephoneDisplay: node.org.telephoneDisplay ?? '', email: node.org.email, foundingDate: String(node.org.foundingDate ?? ''), address: node.org.address ?? {}, sameAs: node.org.sameAs ?? [] },
    person: { id: node.person['@id'], name: node.person.name, jobTitle: node.person.jobTitle, url: node.person.url },
    host: { host: host.host, role: host.role },
    ownerToSupply: [...OWNER_TO_SUPPLY],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const node = JSON.parse(readFileSync(resolve(NODE_ROOT, 'organization.json'), 'utf8'));
  const commit = execFileSync('git', ['-C', NODE_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const out = resolve(repoRoot, 'apps/web/src/truth'); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'projection.json'), JSON.stringify(project(node, commit), null, 2) + '\n');
  console.log(`truth projected from ${NODE_ROOT}@${commit.slice(0, 8)}`);
}

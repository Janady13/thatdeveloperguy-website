import type { CompiledPage } from '../../../contracts/page.ts';
import { truth } from '../../../authority/select-public-facts.ts';

/**
 * A plain-text discovery aid generated only from the same visible page records.
 * It creates no crawler-only claims and is not treated as an indexing guarantee.
 */
export function llmsText(pages: CompiledPage[], release: 'demo' | 'production'): string {
  const visible = pages
    .filter(page => page.indexPolicy === 'index')
    .sort((a, b) => a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path));
  const lines = visible.map(page => `- [${page.heading}](${page.canonical}): ${page.description}`);
  return [
    `# ${truth.org.name}`,
    '',
    `> ${truth.org.legalName} provides IT, cybersecurity and software services. This file is generated from the same approved records as the visible website.`,
    '',
    ...(release === 'demo' ? ['This is a non-indexable demonstration release; canonical URLs identify the intended production locations.', ''] : []),
    '## Public pages',
    '',
    ...lines,
    '',
    '## Contact',
    '',
    `- Email: ${truth.org.email}`,
    `- Telephone: ${truth.org.telephone}`,
    '',
  ].join('\n');
}

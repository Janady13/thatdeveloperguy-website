import type { CompiledPage } from '../../../contracts/page.ts';
import { truth } from '../../../authority/select-public-facts.ts';
import { PRODUCTION_ORIGIN } from '../urls/production-origin.ts';

export interface LlmsDocument {
  path: string;
  title: string;
  description: string;
  sourcePageId: string | null;
  content: string;
}

const inline = (value: string) => value.replace(/\s+/g, ' ').trim();

/** The most specific discovery file for a public route. */
export function scopedLlmsPath(page: Pick<CompiledPage, 'path'>): string {
  return page.path === '/' ? '/llms.txt' : `${page.path.replace(/\/+$/, '')}/llms.txt`;
}

function scopedDocument(page: CompiledPage, release: 'demo' | 'production'): LlmsDocument {
  const sections = page.sections ?? [];
  const service = page.serviceDetail;
  const lines = [
    `# ${page.heading} | ${truth.org.name}`,
    '',
    `> ${inline(page.description)}`,
    '',
    ...(release === 'demo' ? ['This is part of a non-indexable demonstration release. The canonical URL below identifies the intended production page.', ''] : []),
    `- [Visible page](${page.canonical}): The human-readable and canonical version of this content.`,
    `- [Site-wide AI discovery index](${PRODUCTION_ORIGIN}/llms.txt): The root index that joins every scoped discovery file.`,
    '',
    '## Overview',
    '',
    inline(page.summary),
    '',
  ];

  if (sections.length) {
    lines.push('## Page sections', '');
    for (const section of sections) lines.push(`- [${inline(section.heading)}](${page.canonical}#${section.id}): ${inline(section.body)}`);
    lines.push('');
  }

  if (service) {
    lines.push('## Service scope', '', `- Problem addressed: ${inline(service.problem)}`);
    for (const item of service.included) lines.push(`- Included: ${inline(item)}`);
    for (const item of service.deliverables) lines.push(`- Deliverable: ${inline(item)}`);
    for (const item of service.excluded) lines.push(`- Not included: ${inline(item)}`);
    lines.push('');
  }

  if (page.questions.length) {
    lines.push('## Questions and answers', '');
    for (const item of page.questions) lines.push(`- **${inline(item.question)}** ${inline(item.answer)}`);
    lines.push('');
  }

  if (page.related.length) {
    lines.push('## Related pages', '');
    for (const related of page.related) lines.push(`- [${inline(related.title)}](${new URL(related.path, PRODUCTION_ORIGIN).href})`);
    lines.push('');
  }

  return {
    path: scopedLlmsPath(page),
    title: page.heading,
    description: inline(page.description),
    sourcePageId: page.id,
    content: lines.join('\n'),
  };
}

/**
 * Generate a hierarchical discovery tree from the same approved records as the
 * visible pages. The root document joins the scoped route documents; no
 * crawler-only claims or private corpus are introduced.
 */
export function llmsDocuments(pages: CompiledPage[], release: 'demo' | 'production'): LlmsDocument[] {
  const visible = pages
    .filter(page => page.indexPolicy === 'index')
    .sort((a, b) => a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path));
  const scoped = visible.filter(page => page.path !== '/').map(page => scopedDocument(page, release));
  const publicPages = visible.map(page => `- [${inline(page.heading)}](${page.canonical}): ${inline(page.description)}`);
  const scopedFiles = scoped.map(document => `- [${inline(document.title)}](${new URL(document.path, PRODUCTION_ORIGIN).href}): ${document.description}`);
  const root = [
    `# ${truth.org.name}`,
    '',
    `> ${truth.org.legalName} provides IT, cybersecurity and software services. This root index is generated from the same approved records as the visible website and joins the scoped discovery files below.`,
    '',
    ...(release === 'demo' ? ['This is a non-indexable demonstration release; canonical URLs identify the intended production locations.', ''] : []),
    '## Scoped discovery files',
    '',
    ...scopedFiles,
    '',
    '## Public pages',
    '',
    ...publicPages,
    '',
    '## Contact',
    '',
    `- Email: ${truth.org.email}`,
    `- Telephone: ${truth.org.telephone}`,
    '',
  ].join('\n');

  return [{ path: '/llms.txt', title: truth.org.name, description: truth.org.legalName, sourcePageId: null, content: root }, ...scoped];
}

/** Backwards-compatible root renderer for callers that need only the site index. */
export function llmsText(pages: CompiledPage[], release: 'demo' | 'production'): string {
  return llmsDocuments(pages, release)[0]!.content;
}

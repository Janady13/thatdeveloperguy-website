import type { CompiledPage } from '../../../src/contracts/page';
import { pagesByPath } from '../../../src/generated';
import { normalizePath } from '../../../src/engines/seo/urls/normalize-path';
import { truth } from '../../../src/authority/select-public-facts';

export function pageForPath(pathname: string): CompiledPage | undefined {
  return pagesByPath[normalizePath(pathname)];
}

/** One head pipeline for every route: title, description, canonical, robots, Open Graph. */
export function pageMeta(pathname: string) {
  const page = pageForPath(pathname);
  if (!page) return [{ title: `Page not found — ${truth.org.name}` }, { name: 'robots', content: 'noindex' }];
  const meta: Array<Record<string, string>> = [
    { title: page.title },
    { name: 'description', content: page.description },
    { tagName: 'link', rel: 'canonical', href: page.canonical },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: truth.org.name },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: page.canonical },
  ];
  if (page.indexPolicy === 'noindex') meta.push({ name: 'robots', content: 'noindex' });
  return meta;
}

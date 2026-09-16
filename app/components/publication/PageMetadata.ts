import type { CompiledPage } from '../../../src/contracts/page';
import { pagesByPath } from '../../../src/generated';
import { normalizePath } from '../../../src/engines/seo/urls/normalize-path';
import { truth } from '../../../src/authority/select-public-facts';
import { PRODUCTION_ORIGIN } from '../../../src/engines/seo/urls/production-origin';

const SOCIAL_IMAGE = `${PRODUCTION_ORIGIN}/images/posters/lobby.webp`;

export function pageForPath(pathname: string): CompiledPage | undefined {
  return pagesByPath[normalizePath(pathname)];
}

/** One head pipeline for every route: search, canonical and social metadata stay in lockstep. */
export function pageMeta(pathname: string) {
  const page = pageForPath(pathname);
  if (!page) return [{ title: `Page not found — ${truth.org.name}` }, { name: 'robots', content: 'noindex' }];
  const meta: Array<Record<string, string>> = [
    { title: page.title },
    { name: 'description', content: page.description },
    { tagName: 'link', rel: 'canonical', href: page.canonical },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:site_name', content: truth.org.name },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: page.canonical },
    { property: 'og:image', content: SOCIAL_IMAGE },
    { property: 'og:image:secure_url', content: SOCIAL_IMAGE },
    { property: 'og:image:type', content: 'image/webp' },
    { property: 'og:image:width', content: '1672' },
    { property: 'og:image:height', content: '941' },
    { property: 'og:image:alt', content: `${truth.org.name} illustrated technology lobby` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: page.title },
    { name: 'twitter:description', content: page.description },
    { name: 'twitter:image', content: SOCIAL_IMAGE },
    { name: 'twitter:image:alt', content: `${truth.org.name} illustrated technology lobby` },
  ];
  if (page.indexPolicy === 'noindex') meta.push({ name: 'robots', content: 'noindex' });
  return meta;
}

import { PRODUCTION_ORIGIN } from '../urls/production-origin.ts';
import type { RouteManifestEntry } from '../../../contracts/page.ts';

const url = (path: string) => path === '/' ? `${PRODUCTION_ORIGIN}/` : `${PRODUCTION_ORIGIN}${path}`;

/** Only approved, canonical, indexable pages: no drafts (they never reach the manifest), no noindex pages, no API or receipt paths. */
export function sitemapEntries(routes: RouteManifestEntry[]): string[] {
  return routes.filter(r => r.publicationStatus === 'published' && r.indexPolicy === 'index').map(r => url(r.path));
}
export function sitemapXml(routes: RouteManifestEntry[]): string {
  const entries = routes
    .filter(route => route.publicationStatus === 'published' && route.indexPolicy === 'index')
    .map(route => {
      const lastmod = route.materiallyUpdatedAt ?? route.publishedAt;
      return `  <url><loc>${url(route.path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}
/** The node records thatdeveloperguy.com's sitemap as sitemap-index.xml; keep that address valid by indexing the one sitemap. */
export function sitemapIndexXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${PRODUCTION_ORIGIN}/sitemap.xml</loc></sitemap>\n</sitemapindex>\n`;
}

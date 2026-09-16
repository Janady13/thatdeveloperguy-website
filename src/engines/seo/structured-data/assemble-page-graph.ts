import type { CompiledPage } from '../../../contracts/page.ts';
import { truth, ORGANIZATION_ID, PERSON_ID } from '../../../authority/select-public-facts.ts';
import { PRODUCTION_ORIGIN } from '../urls/production-origin.ts';

const WEBSITE_ID = `${PRODUCTION_ORIGIN}/#website`;

/** The canonical host declares Organization and Person once (home); every other page references them by @id. */
export function assemblePageGraph(page: CompiledPage): Record<string, unknown> {
  const graph: Array<Record<string, unknown>> = [];
  if (page.id === 'home') {
    graph.push({
      '@type': 'Organization', '@id': ORGANIZATION_ID, name: truth.org.name, legalName: truth.org.legalName, url: `${PRODUCTION_ORIGIN}/`,
      telephone: truth.org.telephone, email: truth.org.email, foundingDate: truth.org.foundingDate,
      address: { '@type': 'PostalAddress', ...truth.org.address }, sameAs: truth.org.sameAs, founder: { '@id': PERSON_ID },
    });
    graph.push({ '@type': 'Person', '@id': PERSON_ID, name: truth.person.name, jobTitle: truth.person.jobTitle, url: truth.person.url, worksFor: { '@id': ORGANIZATION_ID } });
    graph.push({ '@type': 'WebSite', '@id': WEBSITE_ID, url: `${PRODUCTION_ORIGIN}/`, name: truth.org.name, publisher: { '@id': ORGANIZATION_ID } });
  }
  const webpage: Record<string, unknown> = { '@type': 'WebPage', '@id': `${page.canonical}#webpage`, url: page.canonical, name: page.title, description: page.description, isPartOf: { '@id': WEBSITE_ID }, about: { '@id': ORGANIZATION_ID } };
  if (page.breadcrumbs.length > 1) webpage.breadcrumb = { '@type': 'BreadcrumbList', itemListElement: page.breadcrumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: crumb.path === '/' ? `${PRODUCTION_ORIGIN}/` : `${PRODUCTION_ORIGIN}${crumb.path}` })) };
  graph.push(webpage);
  if (page.template === 'capability' && page.serviceId) graph.push({ '@type': 'Service', '@id': `${page.canonical}#service`, name: page.heading, description: page.description, serviceType: page.heading, provider: { '@id': ORGANIZATION_ID }, url: page.canonical });
  return { '@context': 'https://schema.org', '@graph': graph };
}

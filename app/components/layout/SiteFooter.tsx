import { Link } from 'react-router';
import navigation from '../../../content/site/navigation.json';
import { pagesById } from '../../../src/generated';
import { truth } from '../../../src/authority/select-public-facts';

export function SiteFooter() {
  const address = truth.org.address as Record<string, string>;
  const links = navigation.footer.flatMap(id => pagesById[id] ? [pagesById[id]!] : []);
  return (
    <footer className="site-footer">
      <nav aria-label="Footer" className="site-footer-nav">{links.map(page => <Link key={page.id} to={page.path}>{page.heading}</Link>)}</nav>
      <p><strong>{truth.org.legalName}</strong> · {address.streetAddress}, {address.addressLocality}, {address.addressRegion} {address.postalCode} · <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> · <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a></p>
      <p className="site-footer-note">Founded {truth.org.foundingDate}. {truth.person.name}, {truth.person.jobTitle}.</p>
    </footer>
  );
}

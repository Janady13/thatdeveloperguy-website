import { Link, NavLink } from 'react-router';
import navigation from '../../../content/site/navigation.json';
import { pagesById } from '../../../src/generated';
import { truth } from '../../../src/authority/select-public-facts';

/** Navigation references page ids; URLs come from the registry. A missing id (draft page) is simply not shown. */
export function SiteHeader() {
  const items = navigation.primary.flatMap(id => pagesById[id] ? [pagesById[id]!] : []);
  const cta = pagesById[navigation.cta];
  return (
    <header className="site-header">
      <Link to="/" className="site-brand" aria-label={`${truth.org.name} — lobby`}>thatdeveloper<span>guy</span>.com</Link>
      <nav aria-label="Primary" className="site-nav">
        {items.map(page => <NavLink key={page.id} to={page.path}>{page.heading}</NavLink>)}
        {cta && <Link to={cta.path} className="site-nav-cta">{cta.heading}</Link>}
      </nav>
    </header>
  );
}

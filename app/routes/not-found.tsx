import { Link } from 'react-router';
import navigation from '../../content/site/navigation.json';
import { pagesById } from '../../src/generated';
import { truth } from '../../src/authority/select-public-facts';

export function meta() { return [{ title: `Page not found — ${truth.org.name}` }, { name: 'robots', content: 'noindex' }]; }

export function NotFoundContent() {
  const items = navigation.primary.flatMap(id => pagesById[id] ? [pagesById[id]!] : []);
  return (
    <section className="page-body not-found" aria-labelledby="nf-heading">
      <h1 id="nf-heading">Page not found</h1>
      <p>There is no page at this address. The rooms are here:</p>
      <ul>{items.map(page => <li key={page.id}><Link to={page.path}>{page.heading}</Link></li>)}<li><Link to="/">The lobby</Link></li></ul>
    </section>
  );
}
export default function NotFound() { return <NotFoundContent />; }

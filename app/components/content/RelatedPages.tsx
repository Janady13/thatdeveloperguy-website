import { Link } from 'react-router';
import type { CompiledPage } from '../../../src/contracts/page';
export function RelatedPages({ page }: { page: CompiledPage }) {
  if (!page.related.length) return null;
  return (
    <nav aria-label="Related pages" className="related-pages">
      <h2>Related</h2>
      <ul>{page.related.map(item => <li key={item.id}><Link to={item.path}>{item.title}</Link></li>)}</ul>
    </nav>
  );
}

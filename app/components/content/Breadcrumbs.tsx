import { Link } from 'react-router';
import type { CompiledPage } from '../../../src/contracts/page';
export function Breadcrumbs({ page }: { page: CompiledPage }) {
  if (page.breadcrumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>{page.breadcrumbs.map((crumb, i) => <li key={crumb.path}>{i === page.breadcrumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <Link to={crumb.path}>{crumb.name}</Link>}</li>)}</ol>
    </nav>
  );
}

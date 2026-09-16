import type { CompiledPage } from '../../../src/contracts/page';
import { Breadcrumbs } from './Breadcrumbs';
export function PageHeading({ page, level = 1 }: { page: CompiledPage; level?: 1 | 2 }) {
  const Tag = level === 1 ? 'h1' : 'h2';
  return (
    <header className="page-heading">
      <Breadcrumbs page={page} />
      <Tag>{page.heading}</Tag>
      <p className="page-summary">{page.summary}</p>
    </header>
  );
}

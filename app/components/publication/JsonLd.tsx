import type { CompiledPage } from '../../../src/contracts/page';
import { assemblePageGraph } from '../../../src/engines/seo/structured-data/assemble-page-graph';

/** A data block, not executable script: CSP script-src does not govern application/ld+json. */
export function JsonLd({ page }: { page: CompiledPage }) {
  const graph = assemblePageGraph(page);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }} />;
}

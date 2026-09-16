import type { CompiledPage } from '../../../src/contracts/page';

/** Claims and what supports them, with unsupported ones visibly marked rather than dropped or dressed up. */
export function EvidenceBlock({ page }: { page: CompiledPage }) {
  const evidence = page.serviceDetail?.evidence;
  if (!evidence?.length) return null;
  return (
    <section id="evidence" aria-labelledby="evidence-h" className="evidence-block">
      <h2 id="evidence-h">What supports this</h2>
      <dl>
        {evidence.map(e => (
          <div key={e.claim} className={`evidence-item evidence-${e.status}`}>
            <dt>{e.claim}</dt>
            <dd>{e.support} <span className="evidence-status">{e.status === 'supported' ? 'Supported by the organization record' : 'Not yet published — awaiting the owner'}</span></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

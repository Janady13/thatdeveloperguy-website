import type { CompiledPage } from '../../../src/contracts/page';

/** The eight buyer questions, rendered from serviceDetail in a fixed order so every service page reads the same way. */
export function ServiceDeliverables({ page }: { page: CompiledPage }) {
  const d = page.serviceDetail;
  if (!d) return null;
  return (
    <div className="service-detail">
      <section id="problem" aria-labelledby="problem-h"><h2 id="problem-h">The problem this solves</h2><p>{d.problem}</p></section>
      <section id="who" aria-labelledby="who-h"><h2 id="who-h">Who it is for</h2><ul>{d.audience.map(a => <li key={a}>{a}</li>)}</ul></section>
      <section id="included" aria-labelledby="included-h"><h2 id="included-h">What is included</h2><ul>{d.included.map(i => <li key={i}>{i}</li>)}</ul></section>
      <section id="deliverables" aria-labelledby="deliverables-h"><h2 id="deliverables-h">What you receive</h2><ul>{d.deliverables.map(i => <li key={i}>{i}</li>)}</ul></section>
      <section id="excluded" aria-labelledby="excluded-h"><h2 id="excluded-h">Limits and exclusions</h2><ul>{d.excluded.map(i => <li key={i}>{i}</li>)}</ul></section>
      <section id="engagement" aria-labelledby="engagement-h"><h2 id="engagement-h">How an engagement proceeds</h2><ol className="process-steps">{d.process.map(s => <li key={s.step}><strong>{s.step}.</strong> {s.detail}</li>)}</ol></section>
    </div>
  );
}

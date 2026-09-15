import { useSearchParams } from 'react-router';
import { truth } from '../../truth';
export function Contact() {
  const [params] = useSearchParams();
  const project = params.get('project') ?? 'general';
  return (
    <section className="room-overview" aria-labelledby="contact-title">
      <div>
        <h1 id="contact-title">Request a briefing</h1>
        <p>Intent: <code>{project}</code>. The mail service is wired in the next plan; until then call <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> or write to <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a>.</p>
      </div>
    </section>
  );
}

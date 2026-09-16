import { useSearchParams } from 'react-router';
import { truth } from '../../../src/authority/select-public-facts';

const SERVICES: Array<{ value: string; label: string }> = [
  { value: 'itsupport', label: 'IT Services — support, endpoints, infrastructure, deployment' },
  { value: 'govweb', label: 'Government Solutions — planning, requirements, contracting, delivery' },
  { value: 'security', label: 'Cyber Security — monitoring, review, response, protection' },
  { value: 'general', label: 'Something else' },
];

/** Plain HTML form posting to the same-origin inquiry endpoint. Works without JavaScript; the endpoint is wired in the API step. */
export function InquiryForm({ delivery }: { delivery: 'connected' | 'not-connected' }) {
  const [params] = useSearchParams();
  const preset = params.get('project') ?? 'general';
  const from = params.get('from') ?? '';
  return (
    <form className="inquiry-form" method="post" action="/api/inquiries" aria-describedby="inquiry-notice">
      <p id="inquiry-notice" className="form-notice">
        {delivery === 'connected' ? 'Non-sensitive inquiries only. No passwords, incident files or sensitive government material.' : `Demo host: the inquiry service is not connected here, so this form cannot send. Call ${truth.org.telephoneDisplay || truth.org.telephone} or write to ${truth.org.email}.`}
      </p>
      <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" type="text" autoComplete="name" required maxLength={120} /></div>
      <div className="field"><label htmlFor="email">Email for the reply</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={200} /></div>
      <div className="field"><label htmlFor="organization">Organization</label><input id="organization" name="organization" type="text" autoComplete="organization" maxLength={160} /></div>
      <div className="field"><label htmlFor="service">What is this about</label><select id="service" name="service" defaultValue={preset}>{SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      <div className="field"><label htmlFor="message">Message</label><textarea id="message" name="message" rows={6} required maxLength={4000} /></div>
      <input type="hidden" name="from" value={from} />
      <div className="field field-hp" aria-hidden="true"><label htmlFor="website">Leave this empty</label><input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
      <button type="submit" className="button" disabled={delivery !== 'connected'}>Send inquiry</button>
    </form>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { truth } from '../../../src/authority/select-public-facts';

const SERVICES: Array<{ value: string; label: string }> = [
  { value: 'itsupport', label: 'IT Services — support, endpoints, infrastructure, deployment' },
  { value: 'govweb', label: 'Government Solutions — planning, requirements, contracting, delivery' },
  { value: 'security', label: 'Cyber Security — monitoring, review, response, protection' },
  { value: 'general', label: 'Something else' },
];

type Outcome = 'validation_failed' | 'rate_limited' | 'abuse_refused' | 'provider_accepted' | 'provider_rejected' | 'delivery_unknown';
interface ApiResponse { outcome: Outcome; requestId: string; title: string; message: string; fields: Record<string, string>; duplicate: boolean }
type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; response: ApiResponse } | { kind: 'failed'; message: string };

/**
 * Plain HTML form posting to the same-origin inquiry endpoint; it works with JavaScript off (303 to the generic receipt).
 * With JavaScript, the same POST is made with fetch and the backend's outcome is shown verbatim — success only on provider acceptance.
 */
export function InquiryForm({ delivery }: { delivery: 'connected' | 'not-connected' }) {
  const [params] = useSearchParams();
  const preset = params.get('project') ?? 'general';
  const from = params.get('from') ?? '';
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // Prerendered HTML has no query string; adopt the door's intent after hydration instead of relying on mount-only defaults.
  const [service, setService] = useState('general');
  const [origin, setOrigin] = useState('');
  useEffect(() => { setService(SERVICES.some(s => s.value === preset) ? preset : 'general'); setOrigin(from); }, [preset, from]);
  const fields = status.kind === 'done' ? status.response.fields : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (delivery !== 'connected') return;
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch(form.action, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' });
      const body = (await response.json()) as ApiResponse;
      setStatus({ kind: 'done', response: body });
      if (body.outcome === 'provider_accepted') form.reset();
    } catch {
      setStatus({ kind: 'failed', message: 'The request could not be sent from this browser. Nothing was stored. Call or write to the address in the footer.' });
    }
  }

  const done = status.kind === 'done' ? status.response : null;
  const accepted = done?.outcome === 'provider_accepted';
  return (
    <form className="inquiry-form" method="post" action="/api/inquiries" aria-describedby="inquiry-notice" onSubmit={submit} noValidate={false}>
      <p id="inquiry-notice" className="form-notice">
        {delivery === 'connected' ? 'Non-sensitive inquiries only. No passwords, incident files or sensitive government material.' : `Demo host: the inquiry service is not connected here, so this form cannot send. Call ${truth.org.telephoneDisplay || truth.org.telephone} or write to ${truth.org.email}.`}
      </p>
      {done && (
        <div className={`form-status form-status-${accepted ? 'ok' : 'warn'}`} role={accepted ? 'status' : 'alert'} aria-live="polite">
          <strong>{done.title}</strong> {done.message}{done.duplicate ? ' (This message had already been received.)' : ''} <span className="form-ref">Reference {done.requestId}</span>
        </div>
      )}
      {status.kind === 'failed' && <div className="form-status form-status-warn" role="alert">{status.message}</div>}
      <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} aria-invalid={fields.name ? true : undefined} aria-describedby={fields.name ? 'err-name' : undefined} />{fields.name && <p id="err-name" className="field-error">{fields.name}</p>}</div>
      <div className="field"><label htmlFor="email">Email for the reply</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={200} aria-invalid={fields.email ? true : undefined} aria-describedby={fields.email ? 'err-email' : undefined} />{fields.email && <p id="err-email" className="field-error">{fields.email}</p>}</div>
      <div className="field"><label htmlFor="organization">Organization</label><input id="organization" name="organization" type="text" autoComplete="organization" maxLength={160} /></div>
      <div className="field"><label htmlFor="service">What is this about</label><select id="service" name="service" value={service} onChange={e => setService(e.target.value)}>{SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      <div className="field"><label htmlFor="message">Message</label><textarea id="message" name="message" rows={6} required minLength={10} maxLength={4000} aria-invalid={fields.message ? true : undefined} aria-describedby={fields.message ? 'err-message' : undefined} />{fields.message && <p id="err-message" className="field-error">{fields.message}</p>}</div>
      <input type="hidden" name="from" value={origin} />
      <div className="field field-hp" aria-hidden="true"><label htmlFor="website">Leave this empty</label><input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></div>
      <button type="submit" className="button" disabled={delivery !== 'connected' || status.kind === 'sending'}>{status.kind === 'sending' ? 'Sending…' : 'Send inquiry'}</button>
    </form>
  );
}

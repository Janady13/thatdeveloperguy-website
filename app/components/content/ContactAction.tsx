import { Link } from 'react-router';
import type { CompiledPage } from '../../../src/contracts/page';
export function ContactAction({ page }: { page: CompiledPage }) {
  return <p className="contact-action"><Link to={page.action.href} className="button">{page.action.label}</Link></p>;
}

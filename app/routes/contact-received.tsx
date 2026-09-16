import { Link } from 'react-router';
import { pageMeta } from '../components/publication/PageMetadata';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

/** Generic receipt: nothing about the sender is in the URL or the page. */
export default function ContactReceived() {
  const page = usePage();
  if (!page) return <Missing />;
  return <div className="page-wrap"><PageHeading page={page} /><ContentSections page={page} /><p><Link to={page.action.href}>{page.action.label}</Link></p></div>;
}

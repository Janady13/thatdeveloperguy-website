import { Link } from 'react-router';
import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { ContactAction } from '../components/content/ContactAction';
import { pages } from '../../src/generated';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Capabilities() {
  const page = usePage();
  if (!page) return <Missing />;
  const capabilities = pages.filter(p => p.template === 'capability');
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap">
        <PageHeading page={page} />
        <ContentSections page={page} />
        <ul className="capability-list">
          {capabilities.map(c => <li key={c.id}><Link to={c.path}><strong>{c.heading}</strong></Link><p>{c.description}</p></li>)}
        </ul>
        <ContactAction page={page} />
      </div>
    </>
  );
}

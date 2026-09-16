import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { RelatedPages } from '../components/content/RelatedPages';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Policy() {
  const page = usePage();
  if (!page) return <Missing />;
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap"><PageHeading page={page} /><ContentSections page={page} /><RelatedPages page={page} /></div>
    </>
  );
}

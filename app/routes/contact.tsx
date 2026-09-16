import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { InquiryForm } from '../components/forms/InquiryForm';
import { truth } from '../../src/authority/select-public-facts';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Contact() {
  const page = usePage();
  if (!page) return <Missing />;
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap">
        <PageHeading page={page} />
        <ContentSections page={page} />
        <InquiryForm delivery={import.meta.env.VITE_INQUIRY_DELIVERY === 'connected' ? 'connected' : 'not-connected'} />
        <p className="contact-alternatives">Prefer to talk: <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> · <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a></p>
      </div>
    </>
  );
}

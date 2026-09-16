import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { RelatedPages } from '../components/content/RelatedPages';
import { ContactAction } from '../components/content/ContactAction';
import { OwnerToSupply } from '../components/content/OwnerToSupply';
import { truth } from '../../src/authority/select-public-facts';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Company() {
  const page = usePage();
  if (!page) return <Missing />;
  const address = truth.org.address as Record<string, string>;
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap">
        <PageHeading page={page} />
        <ContentSections page={page} />
        <dl className="fact-list">
          <dt>Legal organization</dt><dd>{truth.org.legalName}</dd>
          <dt>Brand</dt><dd>{truth.org.name}</dd>
          <dt>Founded</dt><dd>{truth.org.foundingDate}</dd>
          <dt>Address</dt><dd>{address.streetAddress}, {address.addressLocality}, {address.addressRegion} {address.postalCode}</dd>
          <dt>Founder</dt><dd>{truth.person.name}, {truth.person.jobTitle} — <a href={truth.person.url}>public record</a></dd>
          <dt>Telephone</dt><dd><a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a></dd>
        </dl>
        <OwnerToSupply />
        <RelatedPages page={page} />
        <ContactAction page={page} />
      </div>
    </>
  );
}

import { truth } from '../truth';
export function Footer() {
  const a = truth.org.address as Record<string, string>;
  return (
    <footer className="site-footer">
      <p><strong>{truth.org.legalName}</strong> · {a.addressLocality}, {a.addressRegion} · <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> · <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a></p>
      <p className="site-footer-note">Founded {truth.org.foundingDate}. Registry identifiers the owner still has to supply are marked on the pages that need them.</p>
    </footer>
  );
}

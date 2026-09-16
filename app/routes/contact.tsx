import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { InquiryForm } from '../components/forms/InquiryForm';
import { truth } from '../../src/authority/select-public-facts';
import { usePage, Missing } from './_page';
import { lazy, Suspense, useEffect, useState } from 'react';
import { probeRenderer } from '../experience/renderer-capability';
import lobbyScene from '../experience/scenes/lobby/scene.json';
import type { SceneRecord } from '../../src/contracts/scene';

const ConsultantView = lazy(() => import('../experience/consultant/ConsultantView.client'));

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Contact() {
  const page = usePage();
  const [accepted, setAccepted] = useState(false);
  const [hardware, setHardware] = useState(false);
  useEffect(() => { setHardware(probeRenderer().ok); }, []);
  const consultant = (lobbyScene as unknown as SceneRecord).consultant;
  if (!page) return <Missing />;
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap">
        <PageHeading page={page} />
        <ContentSections page={page} />
        <div className="contact-layout">
          <InquiryForm delivery={import.meta.env.VITE_INQUIRY_DELIVERY === 'connected' ? 'connected' : 'not-connected'} onOutcome={outcome => setAccepted(outcome === 'provider_accepted')} />
          {/* The Consultant acknowledges the backend's outcome; it never establishes it. */}
          {hardware && consultant && (
            <aside className="contact-consultant" aria-hidden="true" data-acknowledged={accepted ? 'true' : 'false'}>
              <Suspense fallback={null}><ConsultantView file={consultant.file} placement={{ feet: [257, 805], scale: 1, artboard: { width: 515, height: 805 } }} state={accepted ? { motion: 'idle', expression: 'happy', gesture: 'thumbs-up' } : { motion: 'work', expression: 'focused', gesture: 'none' }} facing="right" paused={false} onError={() => {}} /></Suspense>
            </aside>
          )}
        </div>
        <p className="contact-alternatives">Prefer to talk: <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> · <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a></p>
      </div>
    </>
  );
}

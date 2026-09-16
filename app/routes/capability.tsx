import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { RelatedPages } from '../components/content/RelatedPages';
import { ContactAction } from '../components/content/ContactAction';
import { ServiceDeliverables } from '../components/content/ServiceDeliverables';
import { EvidenceBlock } from '../components/content/EvidenceBlock';
import { QuestionsAndAnswers } from '../components/content/QuestionsAndAnswers';
import { SceneShell } from '../experience/SceneShell';
import itScene from '../experience/scenes/it-services/scene.json';
import cyberScene from '../experience/scenes/cybersecurity/scene.json';
import type { SceneRecord } from '../../src/contracts/scene';
import { usePage, Missing } from './_page';

const SCENES: Record<string, SceneRecord> = { 'it-services': itScene as SceneRecord, cybersecurity: cyberScene as SceneRecord };
export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Capability() {
  const page = usePage();
  if (!page) return <Missing />;
  const scene = page.sceneId ? SCENES[page.sceneId] : undefined;
  return (
    <>
      <JsonLd page={page} />
      <div className="page-wrap"><PageHeading page={page} /></div>
      {scene && <SceneShell scene={scene} page={page} />}
      <div className="page-wrap">
        <ContentSections page={page} />
        <ServiceDeliverables page={page} />
        <EvidenceBlock page={page} />
        <QuestionsAndAnswers page={page} />
        <ContactAction page={page} />
        <RelatedPages page={page} />
      </div>
    </>
  );
}

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
import { ItServicesSceneShell } from '../experience/ItServicesSceneShell';
import { CybersecuritySceneShell } from '../experience/CybersecuritySceneShell';
import type { CompiledPage } from '../../src/contracts/page';
import itScene from '../experience/scenes/it-services/scene.json';
import cyberScene from '../experience/scenes/cybersecurity/scene.json';
import type { SceneRecord } from '../../src/contracts/scene';
import { usePage, Missing } from './_page';

const SCENES: Record<string, SceneRecord> = { 'it-services': itScene as unknown as SceneRecord, cybersecurity: cyberScene as unknown as SceneRecord };
export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

function RoomSemanticContent({ page }: { page: CompiledPage }) {
  return (
    <section className="room-semantic-content" id="overview" aria-label={`${page.heading} details`}>
      <h1>{page.heading}</h1>
      <p>{page.summary}</p>
      {page.sections?.map(section => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
          <h2 id={`${section.id}-heading`}>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      {page.serviceDetail && (
        <section aria-label="Service details">
          <h2>What this room covers</h2>
          <p>{page.serviceDetail.problem}</p>
          <ul>{page.serviceDetail.included.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      <a href={page.action.href}>{page.action.label}</a>
      {page.related.map(item => <a key={item.id} href={item.path}>{item.title}</a>)}
    </section>
  );
}

export default function Capability() {
  const page = usePage();
  if (!page) return <Missing />;
  const scene = page.sceneId ? SCENES[page.sceneId] : undefined;
  const roomIsPage = (page.sceneId === 'it-services' || page.sceneId === 'cybersecurity') && scene;
  if (roomIsPage) {
    return (
      <>
        <JsonLd page={page} />
        {page.sceneId === 'cybersecurity'
          ? <CybersecuritySceneShell scene={scene} page={page} />
          : <ItServicesSceneShell scene={scene} page={page} />}
        <RoomSemanticContent page={page} />
      </>
    );
  }
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

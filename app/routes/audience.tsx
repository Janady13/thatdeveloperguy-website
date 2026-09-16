import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { PageHeading } from '../components/content/PageHeading';
import { ContentSections } from '../components/content/ContentSections';
import { RelatedPages } from '../components/content/RelatedPages';
import { ContactAction } from '../components/content/ContactAction';
import { OwnerToSupply } from '../components/content/OwnerToSupply';
import { RoomSemanticContent } from '../components/content/RoomSemanticContent';
import { SceneShell } from '../experience/SceneShell';
import { GovernmentSceneShell } from '../experience/GovernmentSceneShell';
import governmentScene from '../experience/scenes/government/scene.json';
import type { SceneRecord } from '../../src/contracts/scene';
import { usePage, Missing } from './_page';

const SCENES: Record<string, SceneRecord> = { government: governmentScene as unknown as SceneRecord };
export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Audience() {
  const page = usePage();
  if (!page) return <Missing />;
  const scene = page.sceneId ? SCENES[page.sceneId] : undefined;
  if (scene && page.sceneId === 'government') {
    return (
      <>
        <JsonLd page={page} />
        <GovernmentSceneShell scene={scene} page={page} />
        <RoomSemanticContent>
          <PageHeading page={page} />
          <ContentSections page={page} />
          <OwnerToSupply />
          <RelatedPages page={page} />
          <ContactAction page={page} />
        </RoomSemanticContent>
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
        <OwnerToSupply />
        <RelatedPages page={page} />
        <ContactAction page={page} />
      </div>
    </>
  );
}

import { pageMeta } from '../components/publication/PageMetadata';
import { JsonLd } from '../components/publication/JsonLd';
import { SceneShell } from '../experience/SceneShell';
import scene from '../experience/scenes/lobby/scene.json';
import type { SceneRecord } from '../../src/contracts/scene';
import { usePage, Missing } from './_page';

export function meta({ location }: { location: { pathname: string } }) { return pageMeta(location.pathname); }

export default function Home() {
  const page = usePage();
  if (!page) return <Missing />;
  return (
    <>
      <JsonLd page={page} />
      <h1 className="sr-only">{page.heading} — {page.summary}</h1>
      <SceneShell scene={scene as unknown as SceneRecord} page={page} />
    </>
  );
}

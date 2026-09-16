import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import type { CompiledPage } from '../../src/contracts/page';
import type { SceneRecord } from '../../src/contracts/scene';
import { HotspotOverlay } from './HotspotOverlay';
import { MotionPreferenceControl, useMotionPreference } from './MotionPreferenceControl';
import { probeRenderer } from './renderer-capability';
import { sceneAspect } from './scene-coordinate-map';
import { useSceneNavigation } from './useSceneNavigation';
import '../styles/it-services-rive.css';

const GovernmentRiveCanvas = lazy(() => import('./GovernmentRiveCanvas.client'));
const ROUTE_TRANSITION_MS = 760;

/** Full-viewport Government Solutions room: poster first, native Rive room once verified, real links on top. */
export function GovernmentSceneShell({ scene, page }: { scene: SceneRecord; page: CompiledPage }) {
  const [mounted, setMounted] = useState(false);
  const [renderer, setRenderer] = useState('pending');
  const [nativeReady, setNativeReady] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [motion, setMotion] = useMotionPreference();
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('it-services-route', 'government-route');
    const verdict = probeRenderer();
    setRenderer(verdict.ok ? verdict.renderer : verdict.reason);
    return () => document.body.classList.remove('it-services-route', 'government-route');
  }, []);

  const { hotspots, activate, leaving, leavingTarget } = useSceneNavigation({
    hotspots: scene.hotspots,
    pageId: page.id,
    motion,
    transitionMs: ROUTE_TRANSITION_MS,
    onRouteStart: hotspot => setFocus(hotspot.id),
  });

  const hardware = mounted && !/^no |^software/i.test(renderer) && renderer !== 'pending';
  const showNative = Boolean(hardware && motion && scene.rive && !nativeFailed);
  const caption = focus ? scene.captions[focus] ?? hotspots.find(hotspot => hotspot.id === focus)?.label ?? '' : scene.captionRest;
  const planeStyle = {
    aspectRatio: sceneAspect(scene.canvas),
    '--scene-w': scene.canvas.width,
    '--scene-h': scene.canvas.height,
    '--pointer-x': pointer.x,
    '--pointer-y': pointer.y,
  } as CSSProperties;

  return (
    <section
      className={`scene scene-it-services scene-government${nativeReady ? ' scene-live scene-native-ready' : ''}${leaving ? ' scene-leaving' : ''}`}
      aria-label={`${page.heading} room`}
      data-scene="government"
      data-focus={focus ?? ''}
      data-motion={motion ? 'on' : 'reduced'}
      data-renderer={renderer}
      data-native={nativeReady ? 'ready' : nativeFailed ? 'failed' : showNative ? 'loading' : 'fallback'}
      data-leaving-target={leavingTarget ?? ''}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
          active: true,
        });
      }}
      onPointerLeave={() => setPointer(current => ({ ...current, active: false }))}
    >
      <div className="scene-plane" style={planeStyle}>
        <img
          className="scene-poster"
          src={scene.poster}
          alt={scene.posterAlt}
          width={scene.canvas.width}
          height={scene.canvas.height}
          decoding="async"
          fetchPriority="high"
          {...({ elementtiming: 'government-poster' } as Record<string, string>)}
        />
        {showNative && (
          <Suspense fallback={null}>
            <GovernmentRiveCanvas
              asset={scene.rive!}
              focus={focus}
              onReady={() => setNativeReady(true)}
              onError={() => { setNativeFailed(true); setNativeReady(false); }}
            />
          </Suspense>
        )}
        <HotspotOverlay
          label={page.heading}
          canvas={scene.canvas}
          hotspots={hotspots}
          onFocus={id => { if (!leaving) setFocus(id); }}
          onActivate={activate}
        />
      </div>
      <div className="scene-ui">
        <p className="scene-caption" aria-live="polite">{caption}</p>
        {mounted && <MotionPreferenceControl on={motion} onChange={setMotion} />}
      </div>
    </section>
  );
}

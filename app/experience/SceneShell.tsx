import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import type { CompiledPage } from '../../src/contracts/page';
import type { SceneRecord } from '../../src/contracts/scene';
import { sceneAspect } from './scene-coordinate-map';
import { HotspotOverlay } from './HotspotOverlay';
import { MotionPreferenceControl, useMotionPreference } from './MotionPreferenceControl';
import { probeRenderer } from './renderer-capability';
import { useSceneNavigation } from './useSceneNavigation';

const LobbyRiveCanvas = lazy(() => import('./LobbyRiveCanvas.client'));
const DOOR_OPEN_MS = 760;

function LobbyCopyOverlay() {
  return (
    <div className="lobby-copy" aria-hidden="true">
      <div className="lobby-mission"><span>★</span><p>Secure systems.<br />Stronger services.<br />A better tomorrow.</p><span>★</span></div>
      <div className="lobby-door-label lobby-door-label-it">IT Services</div>
      <div className="lobby-door-label lobby-door-label-gov">Gov Solutions</div>
      <div className="lobby-door-label lobby-door-label-cyber">Cyber Security</div>
    </div>
  );
}

/** Poster first (prerendered), native layer only in the browser and only when a verified .riv exists; real links on top. */
export function SceneShell({ scene, page }: { scene: SceneRecord; page: CompiledPage }) {
  const [mounted, setMounted] = useState(false);
  const [renderer, setRenderer] = useState('pending');
  const [nativeReady, setNativeReady] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [motion, setMotion] = useMotionPreference();
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });
  useEffect(() => {
    setMounted(true);
    const verdict = probeRenderer();
    setRenderer(verdict.ok ? verdict.renderer : verdict.reason);
  }, []);
  useEffect(() => { if (!motion) setNativeReady(false); }, [motion]);
  const { hotspots, activate, leaving, leavingTarget } = useSceneNavigation({
    hotspots: scene.hotspots,
    pageId: page.id,
    motion: motion && nativeReady,
    transitionMs: hotspot => scene.id === 'lobby' && hotspot.id.startsWith('door-') ? DOOR_OPEN_MS : 0,
    onRouteStart: hotspot => setFocus(hotspot.id),
  });
  const hardware = mounted && !/^no |^software/i.test(renderer) && renderer !== 'pending';
  const showLobbyNative = Boolean(hardware && motion && scene.id === 'lobby' && scene.rive && !nativeFailed);
  const caption = focus ? scene.captions[focus] ?? hotspots.find(h => h.id === focus)?.label ?? '' : scene.captionRest;
  const planeStyle = { aspectRatio: sceneAspect(scene.canvas), '--scene-w': scene.canvas.width, '--scene-h': scene.canvas.height } as CSSProperties;
  const sceneStyle = { ...planeStyle, '--pointer-x': pointer.x, '--pointer-y': pointer.y } as CSSProperties;
  return (
    <section
      className={`scene${nativeReady ? ' scene-live scene-native-ready' : ''}${leaving ? ' scene-leaving' : ''}`}
      aria-label={`${page.heading} room`}
      data-scene={scene.id}
      data-focus={focus ?? ''}
      data-pointer={pointer.active ? 'active' : 'idle'}
      data-motion={motion ? 'on' : 'reduced'}
      data-renderer={renderer}
      data-native={nativeReady ? 'ready' : nativeFailed ? 'failed' : showLobbyNative ? 'loading' : 'fallback'}
      data-leaving-target={leavingTarget ?? ''}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({ x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)), active: true });
      }}
      onPointerLeave={() => setPointer(pointer => ({ ...pointer, active: false }))}
    >
      {/* One plane in room coordinates, sized to cover the viewport: poster, native layer and hit shapes map the same way. */}
      <div className="scene-plane" style={sceneStyle}>
        <img className="scene-poster" src={scene.poster} alt={scene.posterAlt} width={scene.canvas.width} height={scene.canvas.height} decoding="async" fetchPriority="high" {...({ elementtiming: "poster" } as Record<string, string>)} />
        {showLobbyNative && (
          <Suspense fallback={null}>
            <LobbyRiveCanvas
              asset={scene.rive!}
              focus={focus}
              leavingTarget={leavingTarget}
              motion={motion}
              onReady={() => setNativeReady(true)}
              onError={() => { setNativeFailed(true); setNativeReady(false); }}
            />
          </Suspense>
        )}
        {scene.id === 'lobby' && nativeReady && <LobbyCopyOverlay />}
        <HotspotOverlay label={page.heading} canvas={scene.canvas} hotspots={hotspots} onFocus={id => { if (!leaving) setFocus(id); }} onActivate={activate} />
      </div>
      <div className="scene-ui">
        <p className="scene-caption" aria-live="polite">{caption}</p>
        {mounted && scene.id === 'lobby' && <MotionPreferenceControl on={motion} onChange={setMotion} />}
      </div>
    </section>
  );
}

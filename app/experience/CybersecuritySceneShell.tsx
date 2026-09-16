import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import type { CompiledPage } from '../../src/contracts/page';
import type { SceneRecord } from '../../src/contracts/scene';
import { HotspotOverlay } from './HotspotOverlay';
import { CybersecurityAtmosphere } from './CybersecurityAtmosphere';
import { CYBERSECURITY_CANVAS, CYBERSECURITY_CAPTIONS, CYBERSECURITY_HOTSPOTS, resolveCybersecurityObject, type CybersecurityFocus, type CybersecurityObjectFocus } from './cybersecurity-scene-graph';
import { MotionPreferenceControl, useMotionPreference } from './MotionPreferenceControl';
import { probeRenderer } from './renderer-capability';
import { sceneAspect } from './scene-coordinate-map';
import { useSceneNavigation } from './useSceneNavigation';
import '../styles/cybersecurity-rive.css';

const CybersecurityVector = lazy(() => import('./CybersecurityVector.client'));
const CybersecurityRiveCanvas = lazy(() => import('./CybersecurityRiveCanvas.client'));
const VECTOR_POSTER = '/animation/cybersecurity/cybersecurity-scene.svg';

/** Full-viewport Cybersecurity room built from the supplied animation kit and its named object contract. */
export function CybersecuritySceneShell({ scene, page }: { scene: SceneRecord; page: CompiledPage }) {
  const [mounted, setMounted] = useState(false);
  const [renderer, setRenderer] = useState('pending');
  const [vectorReady, setVectorReady] = useState(false);
  const [vectorFailed, setVectorFailed] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [focus, setFocus] = useState<CybersecurityFocus | null>(null);
  const [objectFocus, setObjectFocus] = useState<CybersecurityObjectFocus | null>(null);
  const [selected, setSelected] = useState<CybersecurityFocus | null>(null);
  const [motion, setMotion] = useMotionPreference();
  const [pointer, setPointer] = useState({ x: 50, y: 50 });

  useEffect(() => {
    setMounted(true);
    const verdict = probeRenderer();
    setRenderer(verdict.ok ? verdict.renderer : verdict.reason);
    const hash = window.location.hash.slice(1);
    const match = CYBERSECURITY_HOTSPOTS.find(hotspot => hotspot.target.kind === 'anchor' && hotspot.target.anchor === hash);
    if (match) setSelected(match.id as CybersecurityFocus);
  }, []);

  const { hotspots, activate, leaving, leavingTarget } = useSceneNavigation({
    hotspots: CYBERSECURITY_HOTSPOTS,
    pageId: page.id,
    motion,
    transitionMs: hotspot => hotspot.id === 'return-lobby' ? 650 : 500,
    onAnchor: hotspot => {
      const id = hotspot.id as CybersecurityFocus;
      setFocus(id);
      setSelected(current => current === id ? null : id);
      window.history.replaceState(window.history.state, '', hotspot.href);
    },
    onRouteStart: hotspot => {
      const id = hotspot.id as CybersecurityFocus;
      setFocus(id);
      setSelected(id);
    },
  });

  const hardware = mounted && !/^no |^software/i.test(renderer) && renderer !== 'pending';
  const showNative = Boolean(hardware && scene.rive && !nativeFailed);
  const active = focus ?? selected;
  const caption = active ? CYBERSECURITY_CAPTIONS[active] : 'Choose a system in the room. Every highlighted object is interactive.';
  const planeStyle = {
    aspectRatio: sceneAspect(scene.canvas),
    '--scene-w': scene.canvas.width,
    '--scene-h': scene.canvas.height,
    '--pointer-x-pct': `${pointer.x}%`,
    '--pointer-y-pct': `${pointer.y}%`,
  } as CSSProperties;

  return (
    <section
      className={`scene scene-cybersecurity scene-live${vectorReady ? ' scene-vector-ready' : ''}${nativeReady ? ' scene-native-ready' : ''}${leaving ? ' scene-leaving' : ''}`}
      aria-label={`${page.heading} room`}
      data-scene="cybersecurity"
      data-focus={focus ?? ''}
      data-selected={selected ?? ''}
      data-object-focus={objectFocus ?? ''}
      data-motion={motion ? 'on' : 'reduced'}
      data-renderer={renderer}
      data-vector={vectorReady ? 'ready' : vectorFailed ? 'failed' : mounted ? 'loading' : 'pending'}
      data-native={nativeReady ? 'ready' : nativeFailed ? 'failed' : showNative ? 'loading' : 'fallback'}
      data-leaving-target={leavingTarget ?? ''}
      onDragStart={event => event.preventDefault()}
      onPointerCancel={() => { setFocus(null); setObjectFocus(null); }}
      onPointerLeave={() => { setFocus(null); setObjectFocus(null); }}
      onPointerMove={event => {
        const plane = event.currentTarget.querySelector<HTMLElement>('.scene-plane');
        const rect = plane?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        const normalizedX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const normalizedY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        setPointer({
          x: normalizedX * 100,
          y: normalizedY * 100,
        });
        setObjectFocus(resolveCybersecurityObject(
          normalizedX * CYBERSECURITY_CANVAS.width,
          normalizedY * CYBERSECURITY_CANVAS.height,
        ));
      }}
    >
      <div className="scene-plane" style={planeStyle}>
        <img className="scene-poster" src={VECTOR_POSTER} alt={scene.posterAlt} width={scene.canvas.width} height={scene.canvas.height} decoding="async" fetchPriority="high" draggable={false} />
        {mounted && !vectorFailed && (
          <Suspense fallback={null}>
            <CybersecurityVector
              focus={focus}
              selected={selected}
              objectFocus={objectFocus}
              motion={motion}
              onReady={() => setVectorReady(true)}
              onError={() => { setVectorFailed(true); setVectorReady(false); }}
            />
          </Suspense>
        )}
        {showNative && (
          <Suspense fallback={null}>
            <CybersecurityRiveCanvas
              asset={scene.rive!}
              motion={motion}
              onReady={() => setNativeReady(true)}
              onError={() => { setNativeFailed(true); setNativeReady(false); }}
            />
          </Suspense>
        )}
        <CybersecurityAtmosphere motion={motion} />
        <HotspotOverlay
          label={page.heading}
          canvas={scene.canvas}
          hotspots={hotspots}
          onFocus={id => { if (!leaving) setFocus(id as CybersecurityFocus | null); }}
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

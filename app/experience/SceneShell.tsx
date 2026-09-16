import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import type { CompiledPage } from '../../src/contracts/page';
import type { SceneRecord } from '../../src/contracts/scene';
import { ASPECT } from './scene-coordinate-map';
import { resolveDestination } from './resolve-destination';
import { HotspotOverlay, type ResolvedHotspot } from './HotspotOverlay';
import { MotionPreferenceControl, useMotionPreference } from './MotionPreferenceControl';
import { probeRenderer } from './renderer-capability';

const RiveCanvas = lazy(() => import('./consultant/RiveCanvas.client'));
const DOOR_OPEN_MS = 26 / 60 * 1000 + 120;

/** Poster first (prerendered), native layer only in the browser and only when a verified .riv exists; real links on top. */
export function SceneShell({ scene, page }: { scene: SceneRecord; page: CompiledPage }) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [hardware, setHardware] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [fire, setFire] = useState<{ name: string; nonce: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [motion, setMotion] = useMotionPreference();
  useEffect(() => { setMounted(true); const verdict = probeRenderer(); setHardware(verdict.ok ? 'yes' : verdict.reason); }, []);
  const hotspots = useMemo<ResolvedHotspot[]>(() => scene.hotspots.flatMap(h => { const href = resolveDestination(h.target, page.id); return href ? [{ ...h, href }] : []; }), [scene, page.id]);
  const activate = useCallback((hotspot: ResolvedHotspot, event: MouseEvent<Element>) => {
    if (hotspot.href.startsWith('#')) return; // let the browser scroll to the section
    event.preventDefault();
    if (leaving) return;
    setLeaving(true); setFocus(hotspot.id);
    const animate = live && motion && hotspot.trigger;
    if (animate) setFire({ name: hotspot.trigger!, nonce: Date.now() });
    setTimeout(() => navigate(hotspot.href), animate ? DOOR_OPEN_MS : 0);
  }, [leaving, live, motion, navigate]);
  const showRive = mounted && hardware === 'yes' && scene.rive && !failed && motion;
  const caption = focus ? scene.captions[focus] ?? hotspots.find(h => h.id === focus)?.label ?? '' : scene.captionRest;
  return (
    <section className={`scene${live ? ' scene-live' : ''}`} aria-label={`${page.heading} room`} data-scene={scene.id} data-focus={focus ?? ''} data-renderer={hardware ?? ''}>
      <div className="scene-frame" style={{ aspectRatio: ASPECT }}>
        <img className="scene-poster" src={scene.poster} alt={scene.posterAlt} width={1648} height={928} decoding="async" fetchPriority="high" />
        {showRive && <Suspense fallback={null}><RiveCanvas rive={scene.rive!} focus={focus ?? 'none'} reducedMotion={!motion} fire={fire} onReady={() => setLive(true)} onError={() => setFailed(true)} /></Suspense>}
        <HotspotOverlay label={page.heading} hotspots={hotspots} onFocus={id => { if (!leaving) setFocus(id); }} onActivate={activate} />
      </div>
      <div className="scene-bar">
        <p className="scene-caption" aria-live="polite">{caption}</p>
        {scene.rive && mounted && <MotionPreferenceControl on={motion} onChange={setMotion} />}
      </div>
    </section>
  );
}

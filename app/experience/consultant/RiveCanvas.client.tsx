import { useEffect, useRef, useState } from 'react';
import { useRive, Layout, Fit, Alignment, RuntimeLoader, useViewModel, useViewModelInstance, useViewModelInstanceEnum, useViewModelInstanceBoolean, useViewModelInstanceTrigger } from '@rive-app/react-webgl2';
import type { SceneRive } from '../../../src/contracts/scene';

RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

export interface RiveCanvasProps { rive: SceneRive; focus: string; reducedMotion: boolean; fire: { name: string; nonce: number } | null; onReady: () => void; onError: (error: unknown) => void }

/**
 * Browser-only. Plays the room's state machine and mirrors page state into its view model; the HTML overlay owns every pointer event.
 * Playback is gated: offscreen or hidden document → paused. The gate state is exposed as data-playing for tests and support.
 */
export default function RiveCanvas({ rive: asset, focus, reducedMotion, fire, onReady, onError }: RiveCanvasProps) {
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: asset.file, artboard: asset.artboard, stateMachine: asset.stateMachine, autoplay: true, autoBind: true, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    onLoad: () => { setLoaded(true); callbacks.current.onReady(); }, onLoadError: e => callbacks.current.onError(e),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });
  // The contract check the manifest promised: the artboard must expose the state machine and view model the page drives.
  useEffect(() => {
    if (!rive || !loaded) return;
    const artboard = rive.contents?.artboards?.find(a => a.name === asset.artboard);
    const machines = artboard?.stateMachines?.map(m => m.name) ?? [];
    if (!artboard || !machines.includes(asset.stateMachine)) callbacks.current.onError(new Error(`incompatible contract: artboard ${asset.artboard} / state machine ${asset.stateMachine} not in file`));
  }, [rive, loaded, asset.artboard, asset.stateMachine]);
  const model = useViewModel(rive, { name: asset.viewModel });
  const instance = useViewModelInstance(model, { rive });
  const { setValue: setFocus } = useViewModelInstanceEnum('focus', instance);
  const { setValue: setReduced } = useViewModelInstanceBoolean('reducedMotion', instance);
  const trigger = useViewModelInstanceTrigger(fire?.name ?? 'openIt', instance);
  useEffect(() => { setFocus(focus); }, [focus, setFocus]);
  useEffect(() => { setReduced(reducedMotion); }, [reducedMotion, setReduced]);
  useEffect(() => { if (fire) trigger.trigger(); }, [fire?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const element = box.current; if (!element) return;
    const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.target === element) setVisible(entry.isIntersecting); }, { threshold: 0.05 });
    observer.observe(element);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const playing = loaded && visible && !hidden;
  useEffect(() => { if (!rive || !loaded) return; if (playing) rive.play(); else rive.pause(); }, [rive, loaded, playing]);
  useEffect(() => () => { rive?.cleanup(); }, [rive]);
  return <div ref={box} className="scene-rive" aria-hidden="true" data-playing={playing ? 'true' : 'false'}><RiveComponent /></div>;
}

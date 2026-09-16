import { useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, RuntimeLoader, useRive } from '@rive-app/react-webgl2';
import type { SceneRive } from '../../src/contracts/scene';

RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

interface Props {
  asset: SceneRive;
  motion: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
}

/** Native Rive ambient effects authored for the Cybersecurity room. */
export default function CybersecurityRiveCanvas({ asset, motion, onReady, onError }: Props) {
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [documentHidden, setDocumentHidden] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: asset.file,
    artboard: asset.artboard,
    stateMachine: asset.stateMachine,
    autoplay: true,
    autoBind: false,
    enableRiveAssetCDN: false,
    shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => setLoaded(true),
    onLoadError: event => callbacks.current.onError(event),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });

  useEffect(() => {
    if (!rive || !loaded) return;
    const artboard = rive.contents?.artboards?.find(candidate => candidate.name === asset.artboard);
    const machines = artboard?.stateMachines?.map(machine => machine.name) ?? [];
    if (!artboard || !machines.includes(asset.stateMachine)) {
      callbacks.current.onError(new Error(`Incompatible Cybersecurity Rive contract: ${asset.artboard} / ${asset.stateMachine}`));
      return;
    }
    callbacks.current.onReady();
  }, [asset.artboard, asset.stateMachine, loaded, rive]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(candidate => candidate.target === element);
      if (entry) setVisible(entry.isIntersecting);
    }, { threshold: 0.02 });
    const handleVisibility = () => setDocumentHidden(document.hidden);
    observer.observe(element);
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const playing = loaded && motion && visible && !documentHidden;
  useEffect(() => {
    if (!rive || !loaded) return;
    if (playing) rive.play(asset.stateMachine);
    else rive.pause();
  }, [asset.stateMachine, loaded, playing, rive]);

  useEffect(() => () => rive?.cleanup(), [rive]);

  return (
    <div ref={container} className="scene-rive cybersecurity-rive" aria-hidden="true" data-playing={playing ? 'true' : 'false'}>
      <RiveComponent />
    </div>
  );
}

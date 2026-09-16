import { useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, RuntimeLoader, decodeImage, useRive } from '@rive-app/react-webgl2';
import type { SceneRive, SceneRiveDensity } from '../../src/contracts/scene';

RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

const PLATES = '/animation/rooms/lobby-plates';
const DOORS = {
  'door-IT': { hover: 'hoverIt', open: 'openIt', amount: 'doorIt' },
  'door-Gov': { hover: 'hoverGov', open: 'openGov', amount: 'doorGov' },
  'door-Cyber': { hover: 'hoverCyber', open: 'openCyber', amount: 'doorCyber' },
} as const;
const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Props {
  asset: SceneRive;
  focus: string | null;
  leavingTarget: string | null;
  motion: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
}

/** Native lobby authored in RML. HTML links own navigation; the view model owns hover and door motion. */
export default function LobbyRiveCanvas({ asset, focus, leavingTarget, motion, onReady, onError }: Props) {
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const container = useRef<HTMLDivElement>(null);
  const density = useRef<SceneRiveDensity>(typeof window !== 'undefined' && window.innerWidth * window.devicePixelRatio > 3400 ? '4x' : '2x');
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [documentHidden, setDocumentHidden] = useState(false);
  const source = asset.variants?.[density.current]?.file ?? asset.file;

  const { rive, RiveComponent } = useRive({
    src: source,
    artboard: asset.artboard,
    stateMachine: asset.stateMachine,
    autoplay: true,
    autoBind: true,
    enableRiveAssetCDN: false,
    shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    assetLoader: (fileAsset, bytes) => {
      if (!fileAsset.isImage || bytes.length > 0) return false;
      fetch(`${PLATES}/${density.current}/${fileAsset.name}.webp`)
        .then(response => {
          if (!response.ok) throw new Error(`Lobby plate ${fileAsset.name} failed with ${response.status}.`);
          return response.arrayBuffer();
        })
        .then(buffer => decodeImage(new Uint8Array(buffer)))
        .then(image => {
          (fileAsset as unknown as { setRenderImage(image: unknown): void }).setRenderImage(image);
          image.unref();
        })
        .catch(error => callbacks.current.onError(error));
      return true;
    },
    onLoad: () => setLoaded(true),
    onLoadError: event => callbacks.current.onError(event),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });

  useEffect(() => {
    if (!rive || !loaded) return;
    const artboard = rive.contents?.artboards?.find(candidate => candidate.name === asset.artboard);
    const machines = artboard?.stateMachines?.map(machine => machine.name) ?? [];
    if (!artboard || !machines.includes(asset.stateMachine) || !rive.viewModelInstance) {
      callbacks.current.onError(new Error(`Incompatible lobby Rive contract: ${asset.artboard} / ${asset.stateMachine} / ${asset.viewModel}`));
      return;
    }
    callbacks.current.onReady();
  }, [asset.artboard, asset.stateMachine, asset.viewModel, loaded, rive]);

  useEffect(() => {
    const viewModel = rive?.viewModelInstance;
    if (!viewModel || !loaded) return;
    for (const [id, contract] of Object.entries(DOORS)) {
      const property = viewModel.boolean(contract.hover);
      if (property) property.value = focus === id;
    }
  }, [focus, loaded, rive]);

  useEffect(() => {
    const viewModel = rive?.viewModelInstance;
    const contract = leavingTarget ? DOORS[leavingTarget as keyof typeof DOORS] : undefined;
    if (!viewModel || !loaded || !contract) return;
    const open = viewModel.boolean(contract.open);
    const amount = viewModel.number(contract.amount);
    if (!open || !amount) {
      callbacks.current.onError(new Error(`Lobby view model is missing ${contract.open} or ${contract.amount}.`));
      return;
    }
    open.value = true;
    const start = amount.value;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / 700);
      amount.value = start + (1 - start) * ease(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [leavingTarget, loaded, rive]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(candidate => candidate.target === element);
      if (entry) setVisible(entry.isIntersecting);
    }, { threshold: .02 });
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
    <div ref={container} className="scene-rive lobby-rive" aria-hidden="true" data-density={density.current} data-playing={playing ? 'true' : 'false'}>
      <RiveComponent />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, RuntimeLoader, decodeImage, useRive } from '@rive-app/react-webgl2';
import type { SceneRive } from '../../src/contracts/scene';

RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

/** Page hotspot ids → the room's `hoverTarget` numbers (TDG_GOVERNMENT_SOLUTIONS_ANIMATION_KIT build-spec order). */
const HOVER_TARGET: Record<string, number> = { presentation: 1, planning: 2, requirements: 3, contracting: 4, briefing: 5, process: 6, 'return-lobby': 7, workstations: 8 };
const PLATES = '/animation/rooms/government-plates';
const DOOR_MS = 650, DRAWER_MS = 450, DRAWER_STAGGER_MS = 90, CHAIR_MS = 500, GLOBE_MS = 450, BOOK_MS = 450, CHECK_MS = 300;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Props {
  asset: SceneRive;
  focus: string | null;
  onReady: () => void;
  onError: (error: unknown) => void;
}

/**
 * Native Government Solutions room (rive/government). HTML hit shapes own hover and navigation; this component mirrors the
 * focused hotspot into the view model (hoverTarget) and drives the kit's effects: presentation refresh, checklist reveal on the
 * boards, contract drawers, chair nudge at the table, briefing door, globe tilt + book lift at the workstations.
 */
export default function GovernmentRiveCanvas({ asset, focus, onReady, onError }: Props) {
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [documentHidden, setDocumentHidden] = useState(false);
  const plateSet = useRef<'2x' | '4x'>('2x');

  const { rive, RiveComponent } = useRive({
    src: asset.file,
    artboard: asset.artboard,
    stateMachine: asset.stateMachine,
    autoplay: true,
    autoBind: true,
    enableRiveAssetCDN: false,
    shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    // The .riv ships without pixels; plates arrive as WebP, 4x when the device would otherwise upscale the 2x set.
    assetLoader: (fileAsset, bytes) => {
      if (!fileAsset.isImage || bytes.length > 0) return false;
      const set = plateSet.current;
      fetch(`${PLATES}/${set}/${fileAsset.name}.webp`)
        .then(response => { if (!response.ok) throw new Error(`${response.status} ${fileAsset.name}`); return response.arrayBuffer(); })
        .then(buffer => decodeImage(new Uint8Array(buffer)))
        .then(image => { (fileAsset as unknown as { setRenderImage(image: unknown): void }).setRenderImage(image); image.unref(); })
        .catch(error => callbacks.current.onError(error));
      return true;
    },
    onLoad: () => setLoaded(true),
    onLoadError: event => callbacks.current.onError(event),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });

  useEffect(() => {
    plateSet.current = window.innerWidth * window.devicePixelRatio > 3400 ? '4x' : '2x';
  }, []);

  useEffect(() => {
    if (!rive || !loaded) return;
    const artboard = rive.contents?.artboards?.find(candidate => candidate.name === asset.artboard);
    const machines = artboard?.stateMachines?.map(machine => machine.name) ?? [];
    if (!artboard || !machines.includes(asset.stateMachine)) {
      callbacks.current.onError(new Error(`Incompatible Government Solutions Rive contract: ${asset.artboard} / ${asset.stateMachine}`));
      return;
    }
    callbacks.current.onReady();
  }, [asset.artboard, asset.stateMachine, loaded, rive]);

  // Focus → view model: hoverTarget plus the kit's per-hotspot effect, tweened on the host (see rive-expert local facts).
  useEffect(() => {
    if (!rive || !loaded) return;
    const vmi = rive.viewModelInstance;
    if (!vmi) return;
    const number = (name: string) => { const property = vmi.number(name); if (!property) throw new Error(`Government view model has no number ${name}`); return property; };
    const target = focus ? HOVER_TARGET[focus] ?? 0 : 0;
    number('hoverTarget').value = target;
    if (focus === 'presentation') { const flag = vmi.boolean('refreshPresentation'); if (flag) { flag.value = true; setTimeout(() => { flag.value = false; }, 120); } }
    const goals: Array<[string, number, number, number]> = [
      ['doorAmount', focus === 'return-lobby' ? 1 : 0, DOOR_MS, 0],
      ['chairsAmount', focus === 'briefing' ? 1 : 0, CHAIR_MS, 0],
      ['globeAmount', focus === 'workstations' ? 1 : 0, GLOBE_MS, 0],
      ['bookAmount', focus === 'workstations' ? 1 : 0, BOOK_MS, 80],
      ['checklistAmount', focus === 'planning' || focus === 'requirements' ? 1 : 0, CHECK_MS, 0],
      ...[1, 2, 3, 4, 5].map((i): [string, number, number, number] => [`drawer${i}Amount`, focus === 'contracting' ? 1 : 0, DRAWER_MS, (i - 1) * DRAWER_STAGGER_MS]),
    ];
    const properties = goals.map(([name]) => number(name));
    const starts = properties.map(property => property.value);
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      let pending = false;
      goals.forEach(([, goal, ms, delay], index) => {
        const t = Math.min(1, Math.max(0, (now - t0 - delay) / ms));
        properties[index]!.value = starts[index]! + (goal - starts[index]!) * ease(t);
        if (t < 1) pending = true;
      });
      if (pending) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [focus, loaded, rive]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(candidate => candidate.target === element);
      if (entry) setVisible(entry.isIntersecting);
    }, { threshold: 0.05 });
    observer.observe(element);
    const handleVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const playing = loaded && visible && !documentHidden;
  useEffect(() => {
    if (!rive || !loaded) return;
    if (playing) rive.play(asset.stateMachine);
    else rive.pause();
  }, [asset.stateMachine, loaded, playing, rive]);

  useEffect(() => () => rive?.cleanup(), [rive]);

  return (
    <div
      ref={container}
      className="scene-rive government-rive"
      aria-hidden="true"
      data-playing={playing ? 'true' : 'false'}
      data-native-focus={focus ?? 'none'}
    >
      <RiveComponent />
    </div>
  );
}

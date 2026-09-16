import { useEffect, useRef } from 'react';
import { useRive, Layout, Fit, Alignment, RuntimeLoader, useViewModel, useViewModelInstance, useViewModelInstanceEnum, useViewModelInstanceBoolean, useViewModelInstanceTrigger } from '@rive-app/react-webgl2';
import type { SceneRive } from '../../../src/contracts/scene';

RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

export interface RiveCanvasProps { rive: SceneRive; focus: string; reducedMotion: boolean; fire: { name: string; nonce: number } | null; onReady: () => void; onError: (error: unknown) => void }

/** Browser-only. Plays the room's state machine and mirrors page state into its view model; the HTML overlay owns every pointer event. */
export default function RiveCanvas({ rive: asset, focus, reducedMotion, fire, onReady, onError }: RiveCanvasProps) {
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  const { rive, RiveComponent } = useRive({
    src: asset.file, artboard: asset.artboard, stateMachines: asset.stateMachine, autoplay: true, autoBind: true, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    onLoad: () => callbacks.current.onReady(), onLoadError: e => callbacks.current.onError(e),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });
  const model = useViewModel(rive, { name: asset.viewModel });
  const instance = useViewModelInstance(model, { rive });
  const { setValue: setFocus } = useViewModelInstanceEnum('focus', instance);
  const { setValue: setReduced } = useViewModelInstanceBoolean('reducedMotion', instance);
  const trigger = useViewModelInstanceTrigger(fire?.name ?? 'openIt', instance);
  useEffect(() => { setFocus(focus); }, [focus, setFocus]);
  useEffect(() => { setReduced(reducedMotion); }, [reducedMotion, setReduced]);
  useEffect(() => { if (fire) trigger.trigger(); }, [fire?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { rive?.cleanup(); }, [rive]);
  return <div className="scene-rive" aria-hidden="true"><RiveComponent /></div>;
}

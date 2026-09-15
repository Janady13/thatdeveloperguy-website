import { useEffect, useRef } from 'react';
import { useRive, Layout, Fit, Alignment, RuntimeLoader, useViewModel, useViewModelInstance, useViewModelInstanceEnum, useViewModelInstanceBoolean, useViewModelInstanceTrigger } from '@rive-app/react-webgl2';

if (typeof window !== 'undefined') { RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm'); RuntimeLoader.setWasmFallbackUrl(null); }

export interface RiveSceneProps { src: string; artboard: string; stateMachine: string; viewModel: string; focus: string; reducedMotion: boolean; fire: { name: string; nonce: number } | null; onReady: () => void; onError: (error: unknown) => void }

/** Plays a room's state machine and mirrors page state into its view model. Pointer events never reach this canvas; the HTML overlay owns them. */
export function RiveScene({ src, artboard, stateMachine, viewModel, focus, reducedMotion, fire, onReady, onError }: RiveSceneProps) {
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  const { rive, RiveComponent } = useRive({
    src, artboard, stateMachines: stateMachine, autoplay: true, autoBind: true, enableRiveAssetCDN: false, shouldDisableRiveListeners: true,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    onLoad: () => callbacks.current.onReady(), onLoadError: e => callbacks.current.onError(e),
  }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });
  const model = useViewModel(rive, { name: viewModel });
  const instance = useViewModelInstance(model, { rive });
  const focusProperty = useViewModelInstanceEnum('focus', instance);
  const reduced = useViewModelInstanceBoolean('reducedMotion', instance);
  const trigger = useViewModelInstanceTrigger(fire?.name ?? 'openIt', instance);
  const { setValue: setFocus } = focusProperty;
  const { setValue: setReduced } = reduced;
  useEffect(() => { setFocus(focus); }, [focus, setFocus]);
  useEffect(() => { setReduced(reducedMotion); }, [reducedMotion, setReduced]);
  useEffect(() => { if (fire) trigger.trigger(); }, [fire?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="stage-rive" aria-hidden="true"><RiveComponent /></div>;
}

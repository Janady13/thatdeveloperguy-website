import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Alignment, Fit, Layout, useRive, type Rive } from '@rive-app/react-webgl2';
import { createPatchController, PATCH_ARTBOARD, type PatchController, type PatchExpression, type PatchGesture, type PatchMotion } from './PatchController';

/**
 * Site adapter for the Patch package's React component: same props and controller contract (PatchController.ts is the
 * package file, unmodified); differences are the staged asset path, the non-deprecated state-machine option, and cleanup on unmount.
 */
export interface PatchMascotRiveProps {
  src: string; motion?: PatchMotion; expression?: PatchExpression; gesture?: PatchGesture; label?: string; className?: string; style?: CSSProperties;
  facing?: 'left' | 'right'; scale?: number; paused?: boolean; reducedMotion?: boolean; decorative?: boolean;
  onLoad?: (rive: Rive) => void; onReady?: (controller: PatchController) => void; onLoadError?: (error: unknown) => void;
}

export default function PatchMascotRive({ src, motion = 'idle', expression = 'neutral', gesture = 'none', label = 'Patch, the ThatDeveloperGuy consultant', className = '', style, facing = 'right', scale = 1, paused = false, reducedMotion = false, decorative = false, onLoad, onReady, onLoadError }: PatchMascotRiveProps) {
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => { const q = window.matchMedia('(prefers-reduced-motion: reduce)'); const u = () => setSystemReduced(q.matches); u(); q.addEventListener('change', u); return () => q.removeEventListener('change', u); }, []);
  const motionIsReduced = reducedMotion || systemReduced;
  const controllerRef = useRef<PatchController | null>(null);
  const callbacks = useRef({ onLoad, onReady, onLoadError }); callbacks.current = { onLoad, onReady, onLoadError };
  const layout = useMemo(() => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }), []);
  // PatchMachine's Motion layer loops as authored (see creative-source/consultant/patch/rive-manifest.json); the controller drives the coordinated timelines instead, so the machine is verified present (PATCH_STATE_MACHINE) but not run.
  const { RiveComponent, rive } = useRive({ src, artboard: PATCH_ARTBOARD, autoplay: !paused && !motionIsReduced, layout, enableRiveAssetCDN: false, shouldDisableRiveListeners: true, onLoadError: e => callbacks.current.onLoadError?.(e) }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });
  useEffect(() => {
    if (!rive || controllerRef.current) return;
    const controller = createPatchController(rive, { motion, expression, gesture }, { onError: e => callbacks.current.onLoadError?.(e), strict: false });
    controllerRef.current = controller;
    callbacks.current.onLoad?.(rive); callbacks.current.onReady?.(controller);
    return () => { controller.dispose(); controllerRef.current = null; };
  }, [rive]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!controllerRef.current) return; if (paused || motionIsReduced) controllerRef.current.pause(); else controllerRef.current.resume(); }, [motionIsReduced, paused, rive]);
  useEffect(() => { if (!controllerRef.current || motionIsReduced) return; controllerRef.current.setState({ motion, expression, gesture }); }, [expression, gesture, motion, motionIsReduced]);
  useEffect(() => () => { rive?.cleanup(); }, [rive]);
  const variables = { '--patch-scale': String(Math.max(0.1, scale)), '--patch-facing': facing === 'left' ? '-1' : '1' } as CSSProperties;
  return (
    <div className={`tdg-patch-rive ${className}`.trim()} style={{ ...variables, ...style }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined} data-motion={motion} data-expression={expression} data-gesture={gesture}>
      <RiveComponent />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  type Rive,
} from '@rive-app/react-webgl2';
import type { CSSProperties } from 'react';
import type { ITMascotFacing } from './ITServicesMascot';
import {
  createPatchController,
  type PatchController,
  type PatchExpression,
  type PatchGesture,
  type PatchMotion,
} from '../controller/PatchController';
import './patch-mascot-rive.css';

export const PATCH_RIVE_ARTBOARD = 'Patch';
export const PATCH_RIVE_STATE_MACHINE = 'PatchMachine';
const PATCH_RIVE_ASSET = new URL('../rive/tdg-patch.riv', import.meta.url).href;

export interface PatchMascotRiveProps {
  src?: string;
  motion?: PatchMotion;
  expression?: PatchExpression;
  gesture?: PatchGesture;
  label?: string;
  className?: string;
  style?: CSSProperties;
  facing?: ITMascotFacing;
  scale?: number;
  paused?: boolean;
  reducedMotion?: boolean;
  decorative?: boolean;
  onLoad?: (rive: Rive) => void;
  onReady?: (controller: PatchController) => void;
  onLoadError?: (error: unknown) => void;
}

function useSystemReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return prefersReducedMotion;
}

export function PatchMascotRive({
  src = PATCH_RIVE_ASSET,
  motion = 'idle',
  expression = 'neutral',
  gesture = 'none',
  label = 'Patch, the TDG IT services mascot',
  className = '',
  style,
  facing = 'right',
  scale = 1,
  paused = false,
  reducedMotion = false,
  decorative = false,
  onLoad,
  onReady,
  onLoadError,
}: PatchMascotRiveProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const motionIsReduced = reducedMotion || systemReducedMotion;
  const controllerRef = useRef<PatchController | null>(null);
  const autoplay = !paused && !motionIsReduced;
  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  );
  const { RiveComponent, rive } = useRive({
    src,
    artboard: PATCH_RIVE_ARTBOARD,
    stateMachines: PATCH_RIVE_STATE_MACHINE,
    autoplay,
    layout,
    onLoadError,
  });

  useEffect(() => {
    if (!rive || controllerRef.current) return;
    const controller = createPatchController(rive, { motion, expression, gesture }, {
      onError: onLoadError,
      strict: false,
    });
    controllerRef.current = controller;
    onLoad?.(rive);
    onReady?.(controller);
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [expression, gesture, motion, onLoad, onLoadError, onReady, rive]);

  useEffect(() => {
    if (!controllerRef.current) return;
    if (paused || motionIsReduced) {
      controllerRef.current.pause();
    } else {
      controllerRef.current.resume();
    }
  }, [motionIsReduced, paused]);

  useEffect(() => {
    if (!controllerRef.current || motionIsReduced) return;
    controllerRef.current.setState({ motion, expression, gesture });
  }, [expression, gesture, motion, motionIsReduced]);

  const variables = {
    '--patch-scale': String(Math.max(0.1, scale)),
    '--patch-facing': facing === 'left' ? '-1' : '1',
  } as CSSProperties;

  return (
    <div
      className={`tdg-patch-rive ${className}`.trim()}
      style={{ ...variables, ...style }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-motion={motion}
      data-reduced-motion={motionIsReduced || undefined}
    >
      <RiveComponent />
    </div>
  );
}

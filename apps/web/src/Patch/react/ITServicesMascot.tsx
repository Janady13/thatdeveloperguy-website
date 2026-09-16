import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './it-services-mascot.css';
import mascotArt from '../svg/tdg-it-services-specialist-master.svg?url';
import blinkFace from '../svg/PatchBlinkFace.svg?url';
import happyFace from '../svg/PatchHappyFace.svg?url';
import focusedFace from '../svg/PatchFocusedFace.svg?url';
import talkingFace from '../svg/PatchTalkingFace.svg?url';
import waveGesture from '../svg/PatchWaveGesture.svg?url';
import thumbsUpGesture from '../svg/PatchThumbsUpGesture.svg?url';

export const IT_MASCOT_MOTIONS = [
  'idle',
  'blink',
  'wave',
  'thumbs-up',
  'walk',
  'work',
  'enter',
  'exit',
] as const;

export type ITMascotMotion = (typeof IT_MASCOT_MOTIONS)[number];
export type ITMascotFacing = 'left' | 'right';
export type ITMascotExpression = 'neutral' | 'happy' | 'focused' | 'talking';
export type ITMascotGesture = 'none' | 'wave' | 'thumbs-up';

export interface ITServicesMascotProps {
  assetBase?: string;
  motion?: ITMascotMotion;
  label?: string;
  className?: string;
  style?: CSSProperties;
  x?: number;
  y?: number;
  facing?: ITMascotFacing;
  scale?: number;
  paused?: boolean;
  reducedMotion?: boolean;
  expression?: ITMascotExpression;
  gesture?: ITMascotGesture;
  decorative?: boolean;
  onMotionEnd?: (motion: ITMascotMotion) => void;
}

export function ITServicesMascot({
  motion = 'idle',
  label = 'IT Services specialist mascot',
  className = '',
  style,
  x = 0,
  y = 0,
  facing = 'right',
  scale = 1,
  paused = false,
  reducedMotion = false,
  expression = 'neutral',
  gesture = 'none',
  decorative = false,
  onMotionEnd,
}: ITServicesMascotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const motionIsReduced = reducedMotion || systemReducedMotion;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    const art = element?.querySelector<HTMLElement>('.tdg-it-mascot__art');
    if (!art || paused || !['enter', 'exit'].includes(motion)) return;
    if (motionIsReduced) {
      const frame = window.requestAnimationFrame(() => onMotionEnd?.(motion));
      return () => window.cancelAnimationFrame(frame);
    }
    const complete = () => onMotionEnd?.(motion);
    art.addEventListener('animationend', complete);
    return () => art.removeEventListener('animationend', complete);
  }, [motion, motionIsReduced, onMotionEnd, paused]);

  const variables = {
    '--mascot-x': `${x}px`,
    '--mascot-y': `${y}px`,
    '--mascot-scale': String(Math.max(0.1, scale)),
    '--mascot-facing': facing === 'left' ? '-1' : '1',
  } as CSSProperties;
  const gestureName = motion === 'wave'
    ? 'Wave'
    : motion === 'thumbs-up'
      ? 'ThumbsUp'
      : gesture === 'wave'
        ? 'Wave'
        : gesture === 'thumbs-up'
          ? 'ThumbsUp'
          : null;
  const faceAsset = motion === 'blink'
    ? blinkFace
    : expression === 'happy'
      ? happyFace
      : expression === 'focused'
          ? focusedFace
          : expression === 'talking'
            ? talkingFace
            : null;
  const gestureAsset = gestureName === 'Wave'
    ? waveGesture
    : gestureName === 'ThumbsUp'
      ? thumbsUpGesture
      : null;

  return (
    <div
      ref={rootRef}
      className={`tdg-it-mascot tdg-it-mascot--${motion} ${paused ? 'tdg-it-mascot--paused' : ''} ${motionIsReduced ? 'tdg-it-mascot--reduced' : ''} ${className}`.trim()}
      style={{ ...variables, ...style }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-expression={expression}
      data-gesture={gesture}
    >
      <span className="tdg-it-mascot__glow" aria-hidden="true" />
      <img
        className="tdg-it-mascot__art"
        src={mascotArt}
        alt=""
        aria-hidden="true"
        decoding="async"
      />
      {faceAsset && (
        <img
          className="tdg-it-mascot__face-overlay"
          src={faceAsset}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      )}
      {gestureAsset && (
        <img
          className="tdg-it-mascot__gesture-overlay"
          src={gestureAsset}
          alt=""
          aria-hidden="true"
          decoding="async"
        />
      )}
      <span className="tdg-it-mascot__shadow" aria-hidden="true" />
      <span className="tdg-it-mascot__state" aria-hidden="true" />
    </div>
  );
}

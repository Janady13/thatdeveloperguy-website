import type { Rive } from '@rive-app/react-webgl2';

export const PATCH_ARTBOARD = 'Patch';
export const PATCH_STATE_MACHINE = 'PatchMachine';

export const PATCH_MOTIONS = [
  'idle',
  'walk',
  'wave',
  'work',
  'enter',
  'exit',
] as const;
export type PatchMotion = (typeof PATCH_MOTIONS)[number];

export const PATCH_EXPRESSIONS = [
  'neutral',
  'happy',
  'focused',
  'talking',
] as const;
export type PatchExpression = (typeof PATCH_EXPRESSIONS)[number];

export const PATCH_GESTURES = ['none', 'wave', 'thumbs-up'] as const;
export type PatchGesture = (typeof PATCH_GESTURES)[number];

export interface PatchControllerState {
  motion: PatchMotion;
  expression: PatchExpression;
  gesture: PatchGesture;
}

export interface PatchControllerOptions {
  onError?: (error: Error) => void;
  strict?: boolean;
}

export interface PatchController {
  readonly state: PatchControllerState;
  setState(next: Partial<PatchControllerState>): void;
  blink(): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

const MOTION_ANIMATIONS: Record<PatchMotion, string> = {
  idle: 'Patch_Idle',
  walk: 'Patch_Walk',
  wave: 'Patch_Wave',
  work: 'Patch_Work',
  enter: 'Patch_Enter',
  exit: 'Patch_Exit',
};

const EXPRESSION_ANIMATIONS: Record<PatchExpression, string> = {
  neutral: 'Patch_Neutral',
  happy: 'Patch_Happy',
  focused: 'Patch_Focused',
  talking: 'Patch_Talking',
};

const GESTURE_ANIMATIONS: Record<PatchGesture, string | null> = {
  none: null,
  wave: 'Patch_WaveGesture',
  'thumbs-up': 'Patch_ThumbsUp',
};

const REQUIRED_ANIMATIONS = [
  ...Object.values(MOTION_ANIMATIONS),
  ...Object.values(EXPRESSION_ANIMATIONS),
  'Patch_Blink',
  'Patch_WaveGesture',
  'Patch_ThumbsUp',
].filter((name): name is string => Boolean(name));

function errorMessage(message: string) {
  return new Error(`[PatchController] ${message}`);
}

export function createPatchController(
  rive: Rive,
  initial: Partial<PatchControllerState> = {},
  options: PatchControllerOptions = {},
): PatchController {
  const state: PatchControllerState = {
    motion: 'idle',
    expression: 'neutral',
    gesture: 'none',
    ...initial,
  };
  let disposed = false;
  let paused = false;

  const report = (error: Error) => {
    options.onError?.(error);
    if (options.strict !== false) throw error;
  };

  if (!rive.stateMachineNames.includes(PATCH_STATE_MACHINE)) {
    report(errorMessage(`Missing state machine "${PATCH_STATE_MACHINE}".`));
  }

  const missing = REQUIRED_ANIMATIONS.filter(
    (name) => !rive.animationNames.includes(name),
  );
  if (missing.length) {
    report(errorMessage(`Missing animations: ${missing.join(', ')}.`));
  }

  const playState = () => {
    if (disposed || paused) return;
    const requested = [
      MOTION_ANIMATIONS[state.motion],
      EXPRESSION_ANIMATIONS[state.expression],
      GESTURE_ANIMATIONS[state.gesture],
    ].filter((name): name is string => Boolean(name));
    const animationNames = requested.filter((name) =>
      rive.animationNames.includes(name),
    );
    if (animationNames.length !== requested.length) {
      report(errorMessage('The active Patch state references a missing animation.'));
    }
    rive.stop();
    rive.play(animationNames);
  };

  return {
    get state() {
      return { ...state };
    },
    setState(next) {
      if (disposed) return;
      Object.assign(state, next);
      playState();
    },
    blink() {
      if (disposed || paused) return;
      rive.play('Patch_Blink');
    },
    pause() {
      if (disposed) return;
      paused = true;
      rive.pause();
    },
    resume() {
      if (disposed) return;
      paused = false;
      playState();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rive.stop();
    },
  };
}

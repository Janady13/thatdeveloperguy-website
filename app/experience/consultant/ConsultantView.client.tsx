import { useEffect, useRef } from 'react';
import PatchMascotRive from './patch/PatchMascotRive.client';
import type { PatchController, PatchControllerState } from './patch/PatchController';
import type { ConsultantPlacement } from '../../../src/contracts/scene';
import { ROOM } from '../../../src/contracts/scene';

export interface ConsultantViewProps { file: string; placement: ConsultantPlacement; state: PatchControllerState; facing: 'left' | 'right'; paused: boolean; onError: (error: unknown) => void }

/** The Consultant standing in the room at the kit's spawn point (room coordinates → percentages of the frame). Blinks on its own; everything else is told by the page. */
export default function ConsultantView({ file, placement, state, facing, paused, onError }: ConsultantViewProps) {
  const controller = useRef<PatchController | null>(null);
  useEffect(() => { const id = setInterval(() => { if (!paused) controller.current?.blink(); }, 3800 + Math.random() * 1500); return () => clearInterval(id); }, [paused]);
  const width = (placement.artboard.width * placement.scale / ROOM.width) * 100;
  const height = (placement.artboard.height * placement.scale / ROOM.height) * 100;
  const style = { left: `${(placement.feet[0] / ROOM.width) * 100}%`, bottom: `${((ROOM.height - placement.feet[1]) / ROOM.height) * 100}%`, width: `${width}%`, height: `${height}%` };
  return (
    <div className="consultant" style={style} data-consultant="patch">
      <PatchMascotRive src={file} motion={state.motion} expression={state.expression} gesture={state.gesture} facing={facing} paused={paused} decorative onReady={c => { controller.current = c; }} onLoadError={onError} />
    </div>
  );
}

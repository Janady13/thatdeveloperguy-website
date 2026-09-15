import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { RiveScene } from '../rive/RiveScene';
import type { Hotspot } from '../../rooms/lobby/hotspots';
import '../../styles/stage.css';

export interface SceneStageProps { poster: string; rive: { src: string; artboard: string; stateMachine: string; viewModel: string } | null; hotspots: Hotspot[]; caption: (id: string | null) => string; onActivate: (h: Hotspot) => Promise<void> | void; label: string; focus: string | null; onFocus: (id: string | null) => void; fire: { name: string; nonce: number } | null }

/** 1648×928 room coordinates mapped to the stage; poster underneath, Rive on top, real links on top of that. */
export function SceneStage({ poster, rive, hotspots, caption, onActivate, label, focus, onFocus, fire }: SceneStageProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const u = () => setReducedMotion(m.matches); u(); m.addEventListener('change', u); return () => m.removeEventListener('change', u); }, []);
  const activate = useCallback((event: MouseEvent, h: Hotspot) => { event.preventDefault(); void onActivate(h); }, [onActivate]);
  return (
    <section className={`stage${ready ? ' stage-live' : ''}`} aria-label={label} data-focus={focus ?? ''}>
      <div className="stage-frame">
        <img className="stage-poster" src={poster} alt="" width={1648} height={928} decoding="async" />
        {rive && !failed && !reducedMotion && <RiveScene {...rive} focus={focus ?? 'none'} reducedMotion={reducedMotion} fire={fire} onReady={() => setReady(true)} onError={() => setFailed(true)} />}
        <svg className="stage-hits" viewBox="0 0 1648 928" role="navigation" aria-label={`${label} destinations`}>
          {hotspots.map(h => (
            <a key={h.id} href={h.href} aria-label={h.label} className="stage-hit" data-hit={h.id} tabIndex={0} onMouseEnter={() => onFocus(h.id)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(h.id)} onBlur={() => onFocus(null)} onClick={e => activate(e, h)}>
              <rect x={h.hit.x} y={h.hit.y} width={h.hit.width} height={h.hit.height} rx={6} />
            </a>
          ))}
        </svg>
      </div>
      <p className="stage-caption" aria-live="polite">{caption(focus)}</p>
    </section>
  );
}

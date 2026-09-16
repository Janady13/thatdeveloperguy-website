import type { MouseEvent } from 'react';
import type { SceneCanvas, SceneHotspot } from '../../src/contracts/scene';
import { sceneViewBox } from './scene-coordinate-map';

export interface ResolvedHotspot extends SceneHotspot { href: string }
interface Props { label: string; canvas: SceneCanvas; hotspots: ResolvedHotspot[]; onFocus: (id: string | null) => void; onActivate: (hotspot: ResolvedHotspot, event: MouseEvent<Element>) => void }

/** Real anchors drawn as invisible hit shapes in room coordinates. Modified clicks and new-tab opens are left to the browser. */
export function HotspotOverlay({ label, canvas, hotspots, onFocus, onActivate }: Props) {
  return (
    <svg className="scene-hits" viewBox={sceneViewBox(canvas)} preserveAspectRatio="xMidYMid meet" role="navigation" aria-label={`${label} destinations`}>
      {hotspots.map(h => (
        <a key={h.id} href={h.href} aria-label={h.label} className="scene-hit" data-hit={h.id} tabIndex={0}
          onMouseEnter={() => onFocus(h.id)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(h.id)} onBlur={() => onFocus(null)}
          onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; onActivate(h, event); }}>
          <rect x={h.hit.x} y={h.hit.y} width={h.hit.width} height={h.hit.height} rx={6} />
        </a>
      ))}
    </svg>
  );
}

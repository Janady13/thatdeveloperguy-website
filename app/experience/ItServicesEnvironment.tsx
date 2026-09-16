import type { CSSProperties } from 'react';
import { FLOOR_EFFECTS, FOCUS_REGIONS, IT_ROOM, KIT_LAYERS, MASCOT_ANCHORS, RACK_LED_GROUPS, STATUS_PULSES, WORKSTATION_SCREENS, toSceneRect, type ItRegion, type ItSceneState } from './it-services-scene-graph';

interface Props {
  focus: string | null;
  motion: boolean;
  debug?: boolean;
  staticMode?: boolean;
  pointer?: { x: number; y: number; active: boolean };
  sceneState?: ItSceneState;
}

function isItRegion(value: string | null): value is ItRegion {
  return value === 'status' || value === 'helpdesk' || value === 'workstations' || value === 'racks' || value === 'deployment' || value === 'toolcart';
}

function DebugBox({ id, x, y, width, height, label, depth, role }: { id: string; x: number; y: number; width: number; height: number; label: string; depth: number; role: string }) {
  return <span className="it-debug-box" style={toSceneRect(x, y, width, height)} data-depth={depth}>{label}<em>{id} · z{depth} · {role}</em></span>;
}

function Anchor({ id, x, y, role }: { id: string; x: number; y: number; role: string }) {
  return <span className="it-mascot-anchor" style={toSceneRect(x - 6, y - 6, 12, 12)} title={`${id}: ${role}`} />;
}

export function ItServicesEnvironment({ focus, motion, debug = false, staticMode = false, pointer = { x: 0.5, y: 0.5, active: false }, sceneState = 'idle' }: Props) {
  if (staticMode) return null;
  const region = isItRegion(focus) ? focus : null;
  const reduced = !motion;
  const px = Number(((pointer.x - 0.5) * 2).toFixed(3));
  const py = Number(((pointer.y - 0.5) * 2).toFixed(3));
  const activeAnimations = reduced ? 0 : 38;
  const style = {
    '--it-pointer-x': px,
    '--it-pointer-y': py,
    '--it-scene-w': IT_ROOM.width,
    '--it-scene-h': IT_ROOM.height,
  } as CSSProperties;

  return (
    <div className="it-environment" aria-hidden="true" data-motion={motion ? 'on' : 'reduced'} data-focus={region ?? ''} data-scene-state={sceneState} data-pointer-active={pointer.active ? 'true' : 'false'} style={style}>
      {motion && <>
        <div className="it-effect-layer it-depth-system">
          <div className="it-depth-far" />
          <div className="it-depth-mid" />
          <div className="it-depth-foreground" />
        </div>

        <div className="it-effect-layer it-kit-production-layers">
          {KIT_LAYERS.map(layer => <img key={layer.id} src={layer.src} alt="" className={layer.className} data-system={layer.system} data-region={layer.region ?? ''} data-depth={layer.depth} style={{ zIndex: layer.depth }} decoding="async" />)}
        </div>

        <div className="it-effect-layer it-lighting-system">
          <div className="it-ceiling-glow it-ceiling-glow-left" />
          <div className="it-ceiling-glow it-ceiling-glow-center" />
          <div className="it-ceiling-glow it-ceiling-glow-right" />
          <div className="it-ceiling-fixture-pulse it-fixture-a" />
          <div className="it-ceiling-fixture-pulse it-fixture-b" />
          <div className="it-ceiling-fixture-pulse it-fixture-c" />
          <div className="it-equipment-light-spill it-spill-status" />
          <div className="it-equipment-light-spill it-spill-racks" />
          <div className="it-equipment-light-spill it-spill-workstations" />
        </div>

        <div className="it-effect-layer it-display-system">
          <div className="it-status-board-glow" style={toSceneRect(615, 217, 431, 203)} />
          <div className="it-status-board-scan" style={toSceneRect(632, 244, 392, 132)} />
          <div className="it-status-telemetry-bars" style={toSceneRect(674, 273, 183, 118)}><span /><span /><span /><span /></div>
          {STATUS_PULSES.map(pulse => <span key={pulse.id} className="it-status-pulse" style={toSceneRect(pulse.x, pulse.y, pulse.width, pulse.height, { animationDelay: `${pulse.delay}s` })} />)}
          {WORKSTATION_SCREENS.map(screen => <div key={screen.id} className={`it-screen-activity it-screen-${screen.id}`} style={toSceneRect(screen.x, screen.y, screen.width, screen.height, { animationDelay: `${screen.delay}s` })}><span /><span /></div>)}
        </div>

        <div className="it-effect-layer it-rack-system">
          {RACK_LED_GROUPS.slice(0, 16).map(led => <span key={led.id} className="it-rack-led" style={toSceneRect(led.x, led.y, led.width, led.height, { animationDelay: `${led.delay}s` })} />)}
          <div className="it-rack-activity-column it-rack-a" />
          <div className="it-rack-activity-column it-rack-b" />
          <div className="it-rack-activity-column it-rack-c" />
          <div className="it-rack-glass it-rack-glass-a" style={toSceneRect(1350, 221, 92, 330)} />
          <div className="it-rack-glass it-rack-glass-b" style={toSceneRect(1455, 199, 96, 352)} />
          <div className="it-rack-glass it-rack-glass-c" style={toSceneRect(1556, 180, 88, 376)} />
        </div>

        <div className="it-effect-layer it-reception-system">
          <div className="it-reader-led" style={toSceneRect(884, 462, 18, 12)} />
          <div className="it-phone-notice" style={toSceneRect(255, 486, 55, 32)} />
          <div className="it-coffee-steam" style={toSceneRect(118, 505, 62, 86)}><i /><i /><i /><i /></div>
        </div>

        <div className="it-effect-layer it-window-system">
          <div className="it-window-atmosphere it-window-a" />
          <div className="it-window-atmosphere it-window-b" />
        </div>

        <div className="it-effect-layer it-floor-system">
          {FLOOR_EFFECTS.map(effect => <div key={effect.id} className={`it-floor-mask ${effect.className ?? ''}`} data-floor-effect={effect.id} style={toSceneRect(effect.x, effect.y, effect.width, effect.height)} />)}
        </div>

        <div className="it-effect-layer it-mechanical-system">
          <div className="it-deployment-indicator" style={toSceneRect(1118, 359, 27, 25)} />
          <div className="it-toolcart-sequence" style={toSceneRect(1377, 545, 160, 248)}><span /><span /><span /><span /><span /></div>
        </div>

        <div className="it-effect-layer it-interaction-system">
          {FOCUS_REGIONS.map(target => <div key={target.id} className={`it-focus-wash it-focus-${target.id}`} style={toSceneRect(target.x, target.y, target.width, target.height)} />)}
          <div className="it-pointer-specular" />
        </div>
      </>}

      {debug && <div className="it-debug-panel">
        <strong>IT Services production debug</strong>
        <small>state {sceneState} · focus {region ?? 'none'} · pointer {px},{py} · animations {activeAnimations}</small>
        <small>canvas {IT_ROOM.width}×{IT_ROOM.height} · layers {KIT_LAYERS.length} · LEDs {RACK_LED_GROUPS.length}</small>
        {FOCUS_REGIONS.map(r => <DebugBox key={r.id} {...r} />)}
        {MASCOT_ANCHORS.map(a => <Anchor key={a.id} {...a} />)}
      </div>}
    </div>
  );
}

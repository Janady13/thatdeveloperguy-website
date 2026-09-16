import type { RoomManifest } from './import-rooms.ts';
import type { RoomId } from './kits.ts';

export const ARTBOARD_NAMES: Record<RoomId, string> = { lobby: 'Lobby', 'it-services': 'ITServices', government: 'GovernmentSolutions', cybersecurity: 'Cybersecurity' };

export type Prop = 'scaleX' | 'scaleY' | 'x' | 'y' | 'opacity' | 'rotation';
export interface PlanKey { target: string; property: Prop; frame: number; value: number; interpolation: 'cubic' | 'linear' | 'hold' }
export interface PlanAnimation { name: string; durationFrames: number; loop: 'oneShot' | 'loop' | 'pingPong'; keys: PlanKey[] }
export interface PlanLayer { name: string; states: Array<{ name: string; animation?: string }>; transitions: Array<{ from: string; to: string; when?: { property: string; equals?: string | boolean }; durationMs?: number }> }
export interface PlanTarget { id: string; kind: string; amount: number; pivot: [number, number] | null }
export interface PlanDoor { id: string; leafId: string; hinge: [number, number]; accessLightId: string | null; hotspotId: string | null; trigger: string }
export interface PlanHotspot { id: string; label: string; hit: { x: number; y: number; width: number; height: number }; pageId: string; section: string; trigger: string | null; targets: string[] }
export interface RoomPlan {
  room: RoomId; artboard: string; width: number; height: number;
  scene: { file: 'scene.svg'; nodeName: 'scene' };
  targets: PlanTarget[]; doors: PlanDoor[]; hotspots: PlanHotspot[]; floorAnchor: [number, number];
  enum: { name: string; values: string[] };
  viewModel: { name: string; properties: Array<{ name: string; type: 'enum' | 'trigger' | 'boolean' }> };
  animations: PlanAnimation[]; layers: PlanLayer[];
}

const PIVOTED = new Set(['door', 'glass', 'rotate', 'laptop']);
const cubic = 'cubic' as const, linear = 'linear' as const, hold = 'hold' as const;
const stem = (id: string) => id.split('__')[1] ?? id;

/** Which room objects a hotspot wakes up, by name family (the package's ids). Doors are listed by their leaf family and open on click. */
const HOTSPOT_TARGETS: Record<RoomId, Record<string, RegExp>> = {
  lobby: { 'door-IT': /^Door_IT_AccessLight|^DoorPlant_IT_/, 'door-Gov': /^Door_Gov_AccessLight|^DoorPlant_Gov_/, 'door-Cyber': /^Door_Cyber_AccessLight|^DoorPlant_Cyber_/, reception: /^ReceptionMonitor|^ReceptionFiles|^ReceptionMug|^ReceptionPlant_|^Camera_/, lounge: /^LoungePlant_|^ForegroundPalm_/ },
  'it-services': { status: /^StatusIndicator|^RearMonitor|^RearChair/, deployment: /^DeploymentDoor/, toolcart: /^ToolCart_/, workstations: /^WorkMonitor|^WorkChair|^WorkstationStorage|^RepairLaptop|^WorkMug|^DeskDocuments/, racks: /^IT_Rack_/ },
  government: { briefing: /^BriefingDoor|^GovRearPlant/, display: /^BriefingDisplay|^GovOfficeMonitor|^GovReference/, files: /^ContractFiles_|^RearStorage_|^ForegroundFiles_/, table: /^Conference|^DeskGlobe|^GovMug/ },
  cybersecurity: { network: /^NetworkNode|^Console\d_Monitor|^CyberStrip/, 'secure-door': /^SecureDoor|^CyberRack_|^CyberCamera/ },
};

/** Active pose per kind, as the reviewer projects it (preview/motion.js), expressed as Rive keys on the target or its pivot group. */
function activeKeys(t: PlanTarget, frame0: number, frame1: number, phase = 1): PlanKey[] {
  const a = t.amount, tgt = PIVOTED.has(t.kind) ? `pivot:${t.id}` : t.id;
  switch (t.kind) {
    case 'door': return [{ target: tgt, property: 'scaleX', frame: frame0, value: 100, interpolation: cubic }, { target: tgt, property: 'scaleX', frame: frame1, value: Math.round(100 * (1 - a * phase)), interpolation: cubic }];
    case 'glass': return [{ target: tgt, property: 'scaleX', frame: frame0, value: 100, interpolation: cubic }, { target: tgt, property: 'scaleX', frame: frame1, value: Math.round(100 * (1 - a * phase)), interpolation: cubic }];
    case 'laptop': return [{ target: tgt, property: 'scaleY', frame: frame0, value: 100, interpolation: cubic }, { target: tgt, property: 'scaleY', frame: frame1, value: Math.round(100 * (1 - a * phase)), interpolation: cubic }];
    case 'rotate': return [{ target: tgt, property: 'rotation', frame: frame0, value: 0, interpolation: cubic }, { target: tgt, property: 'rotation', frame: frame1, value: a * phase, interpolation: cubic }];
    case 'drawer': return [{ target: tgt, property: 'x', frame: frame0, value: 0, interpolation: cubic }, { target: tgt, property: 'x', frame: frame1, value: -a * 0.75 * phase, interpolation: cubic }, { target: tgt, property: 'y', frame: frame0, value: 0, interpolation: cubic }, { target: tgt, property: 'y', frame: frame1, value: a * 0.55 * phase, interpolation: cubic }];
    case 'translateY': return [{ target: tgt, property: 'y', frame: frame0, value: 0, interpolation: cubic }, { target: tgt, property: 'y', frame: frame1, value: a * phase, interpolation: cubic }];
    case 'translateX': return [{ target: tgt, property: 'x', frame: frame0, value: 0, interpolation: cubic }, { target: tgt, property: 'x', frame: frame1, value: a * phase, interpolation: cubic }];
    case 'steam': return [{ target: tgt, property: 'y', frame: frame0, value: 0, interpolation: linear }, { target: tgt, property: 'y', frame: frame1, value: -a * phase, interpolation: linear }, { target: tgt, property: 'opacity', frame: frame0, value: 100, interpolation: linear }, { target: tgt, property: 'opacity', frame: frame1, value: 35, interpolation: linear }];
    case 'opacity': return [{ target: tgt, property: 'opacity', frame: frame0, value: 100, interpolation: cubic }, { target: tgt, property: 'opacity', frame: frame1, value: Math.round(100 * (1 - a * phase)), interpolation: cubic }];
    default: return [];
  }
}
/** Rest pose keys at one frame (used by the Rest timeline so focus states blend back). */
function restKeys(t: PlanTarget, frame: number): PlanKey[] {
  const tgt = PIVOTED.has(t.kind) ? `pivot:${t.id}` : t.id;
  switch (t.kind) {
    case 'door': case 'glass': return [{ target: tgt, property: 'scaleX', frame, value: 100, interpolation: cubic }];
    case 'laptop': return [{ target: tgt, property: 'scaleY', frame, value: 100, interpolation: cubic }];
    case 'rotate': return [{ target: tgt, property: 'rotation', frame, value: 0, interpolation: cubic }];
    case 'drawer': return [{ target: tgt, property: 'x', frame, value: 0, interpolation: cubic }, { target: tgt, property: 'y', frame, value: 0, interpolation: cubic }];
    case 'translateY': return [{ target: tgt, property: 'y', frame, value: 0, interpolation: cubic }];
    case 'translateX': return [{ target: tgt, property: 'x', frame, value: 0, interpolation: cubic }];
    case 'steam': return [{ target: tgt, property: 'y', frame, value: 0, interpolation: linear }, { target: tgt, property: 'opacity', frame, value: 100, interpolation: linear }];
    case 'opacity': return [{ target: tgt, property: 'opacity', frame, value: 100, interpolation: cubic }];
    default: return [];
  }
}

/**
 * The complete motion plan for a v3 room: every motion target animated (ambient on three desynchronised layers), every hotspot
 * waking its objects (Focus states blending back to Rest), every door opening on its trigger. Targets keep the package's ids and amounts.
 */
export function planRoom(manifest: RoomManifest): RoomPlan {
  const targets: PlanTarget[] = manifest.ambient.map(a => ({ id: a.id, kind: a.kind, amount: a.amount, pivot: PIVOTED.has(a.kind) ? a.pivot : null }));
  for (const d of manifest.doors) targets.push({ id: d.leafId, kind: 'door', amount: 0.65, pivot: d.pivot });
  const byId = new Map(targets.map(t => [t.id, t]));
  const doors: PlanDoor[] = manifest.doors.map(d => ({ id: d.id, leafId: d.leafId, hinge: d.pivot, accessLightId: d.accessLightId, hotspotId: d.hotspotId, trigger: `open${d.id}` }));
  const families = HOTSPOT_TARGETS[manifest.room] ?? {};
  const hotspots: PlanHotspot[] = manifest.hotspots.map(h => {
    const door = doors.find(d => d.hotspotId === h.id);
    const pattern = families[h.id];
    const matched = pattern ? targets.filter(t => pattern.test(stem(t.id)) && t.kind !== 'door').map(t => t.id) : [];
    return { id: h.id, label: h.label, hit: { x: h.rect[0], y: h.rect[1], width: h.rect[2], height: h.rect[3] }, pageId: h.pageId, section: h.section, trigger: door?.trigger ?? null, targets: door ? [...matched, door.leafId] : matched };
  });

  // Ambient: three layers with different periods; rotate/opacity/steam/translate targets dealt out round-robin, alternating sign.
  const ambientTargets = targets.filter(t => ['rotate', 'opacity', 'steam', 'translateY'].includes(t.kind) && !doors.some(d => d.accessLightId === t.id));
  const periods = [240, 300, 372];
  const animations: PlanAnimation[] = periods.map((period, i) => {
    const keys: PlanKey[] = [];
    ambientTargets.filter((_, n) => n % 3 === i).forEach((t, n) => {
      const sign = n % 2 === 0 ? 1 : -1;
      if (t.kind === 'rotate') { keys.push({ target: `pivot:${t.id}`, property: 'rotation', frame: 0, value: -t.amount * sign, interpolation: cubic }, { target: `pivot:${t.id}`, property: 'rotation', frame: period, value: t.amount * sign, interpolation: cubic }); }
      else if (t.kind === 'opacity') { const low = Math.round(100 * (1 - t.amount)); keys.push({ target: t.id, property: 'opacity', frame: 0, value: sign > 0 ? 100 : low, interpolation: cubic }, { target: t.id, property: 'opacity', frame: period, value: sign > 0 ? low : 100, interpolation: cubic }); }
      else if (t.kind === 'steam') { keys.push({ target: t.id, property: 'y', frame: 0, value: 0, interpolation: linear }, { target: t.id, property: 'y', frame: period, value: -t.amount * 2, interpolation: linear }, { target: t.id, property: 'opacity', frame: 0, value: 100, interpolation: linear }, { target: t.id, property: 'opacity', frame: period, value: 20, interpolation: linear }); }
      else if (t.kind === 'translateY') { keys.push({ target: t.id, property: 'y', frame: 0, value: 0, interpolation: cubic }, { target: t.id, property: 'y', frame: period, value: t.amount * 0.5 * sign, interpolation: cubic }); }
    });
    return { name: `Ambient_${'ABC'[i]}`, durationFrames: period, loop: 'pingPong' as const, keys };
  });
  // Access lights breathe on their own layer so a focus can override them.
  const lightKeys: PlanKey[] = doors.flatMap(d => d.accessLightId ? [{ target: d.accessLightId, property: 'opacity' as Prop, frame: 0, value: 55, interpolation: cubic }, { target: d.accessLightId, property: 'opacity' as Prop, frame: 150, value: 100, interpolation: cubic }] : []);
  if (lightKeys.length) animations.push({ name: 'Ambient_Lights', durationFrames: 150, loop: 'pingPong', keys: lightKeys });
  // Rest: every interactive target at rest, so leaving a hotspot blends everything back.
  const interactiveIds = new Set(hotspots.flatMap(h => h.targets));
  animations.push({ name: 'Rest', durationFrames: 12, loop: 'oneShot', keys: [...interactiveIds].flatMap(id => { const t = byId.get(id); return t && t.kind !== 'door' ? restKeys(t, 0) : t ? [{ target: `pivot:${t.id}`, property: 'scaleX' as Prop, frame: 0, value: 100, interpolation: cubic }] : []; }) });
  // Focus per hotspot: its objects to their active pose (doors only ajar on hover; drawers stagger).
  for (const h of hotspots) {
    const keys: PlanKey[] = [];
    let drawerIndex = 0;
    for (const id of h.targets) {
      const t = byId.get(id); if (!t) continue;
      if (t.kind === 'door') { keys.push(...activeKeys(t, 0, 14, 0.18)); continue; }
      if (t.kind === 'drawer') { const start = Math.min(drawerIndex++ * 3, 9); keys.push(...activeKeys(t, start, start + 12)); continue; }
      if (t.kind === 'rotate') { keys.push(...activeKeys(t, 0, 14, 1.5)); continue; }
      if (t.kind === 'opacity' && doors.some(d => d.accessLightId === id)) { keys.push({ target: id, property: 'opacity', frame: 0, value: 60, interpolation: cubic }, { target: id, property: 'opacity', frame: 14, value: 100, interpolation: cubic }, { target: id, property: 'scaleX', frame: 0, value: 100, interpolation: cubic }, { target: id, property: 'scaleX', frame: 14, value: 125, interpolation: cubic }, { target: id, property: 'scaleY', frame: 0, value: 100, interpolation: cubic }, { target: id, property: 'scaleY', frame: 14, value: 125, interpolation: cubic }); continue; }
      keys.push(...activeKeys(t, 0, 14));
    }
    if (keys.length) animations.push({ name: `Focus_${h.id}`, durationFrames: 24, loop: 'oneShot', keys });
  }
  for (const d of doors) animations.push({ name: `DoorOpen_${d.id}`, durationFrames: 26, loop: 'oneShot', keys: [{ target: `pivot:${d.leafId}`, property: 'scaleX', frame: 0, value: 100, interpolation: cubic }, { target: `pivot:${d.leafId}`, property: 'scaleX', frame: 26, value: 35, interpolation: cubic }, ...(d.accessLightId ? [{ target: d.accessLightId, property: 'opacity' as Prop, frame: 0, value: 100, interpolation: hold }] : [])] });

  const focusStates = animations.filter(a => a.name.startsWith('Focus_')).map(a => a.name);
  const layers: PlanLayer[] = [
    ...animations.filter(a => a.name.startsWith('Ambient')).map(a => ({ name: a.name, states: [{ name: 'Still' }, { name: 'Moving', animation: a.name }], transitions: [
      { from: '{Entry State}', to: 'Still' }, { from: 'Still', to: 'Moving', when: { property: 'reducedMotion', equals: false }, durationMs: 400 }, { from: 'Moving', to: 'Still', when: { property: 'reducedMotion', equals: true }, durationMs: 400 },
    ] })),
    ...doors.map(d => ({ name: `Door_${d.id}`, states: [{ name: 'Closed' }, { name: 'Open', animation: `DoorOpen_${d.id}` }], transitions: [{ from: '{Entry State}', to: 'Closed' }, { from: 'Closed', to: 'Open', when: { property: d.trigger } }] })),
    { name: 'Focus', states: [{ name: 'None', animation: 'Rest' }, ...focusStates.map(name => ({ name, animation: name }))], transitions: [
      { from: '{Entry State}', to: 'None' },
      ...focusStates.map(name => ({ from: '{Any State}', to: name, when: { property: 'focus', equals: name.replace('Focus_', '') }, durationMs: 220 })),
      { from: '{Any State}', to: 'None', when: { property: 'focus', equals: 'none' }, durationMs: 320 },
    ] },
  ];
  const artboard = ARTBOARD_NAMES[manifest.room];
  return {
    room: manifest.room, artboard, width: manifest.canvas.width, height: manifest.canvas.height, scene: { file: 'scene.svg', nodeName: 'scene' },
    targets, doors, hotspots, floorAnchor: manifest.floorAnchor,
    enum: { name: `${artboard}Focus`, values: ['none', ...hotspots.map(h => h.id)] },
    viewModel: { name: `${artboard}Room`, properties: [{ name: 'focus', type: 'enum' }, ...doors.map(d => ({ name: d.trigger, type: 'trigger' as const })), { name: 'reducedMotion', type: 'boolean' }] },
    animations, layers,
  };
}

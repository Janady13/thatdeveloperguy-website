import type { RoomManifest } from './import-rooms.ts';
import type { RoomId } from './kits.ts';

export const ARTBOARD_NAMES: Record<RoomId, string> = { lobby: 'Lobby', 'it-services': 'ITServices', government: 'GovernmentSolutions', cybersecurity: 'Cybersecurity' };

export interface PlanKey { target: string; property: 'scaleX' | 'scaleY' | 'x' | 'y' | 'opacity' | 'rotation'; frame: number; value: number; interpolation: 'cubic' | 'linear' | 'hold' }
export interface PlanAnimation { name: string; durationFrames: number; loop: 'oneShot' | 'loop' | 'pingPong'; keys: PlanKey[] }
export interface PlanLayer { name: string; states: Array<{ name: string; animation?: string }>; transitions: Array<{ from: string; to: string; when?: { property: string; equals?: string | boolean } }> }
export interface PlanDoor { id: string; leafId: string; hinge: [number, number]; accessLightId: string | null; hotspotId: string | null; trigger: string }
export interface PlanHotspot { id: string; label: string; hit: { x: number; y: number; width: number; height: number }; pageId: string; section: string; trigger: string | null }
export interface RoomPlan {
  room: RoomId; artboard: string; width: number; height: number;
  scene: { file: 'scene.svg'; nodeName: 'scene' };
  doors: PlanDoor[]; hotspots: PlanHotspot[]; floorAnchor: [number, number];
  ambient: { lightLevelId: string | null; steamIds: string[] };
  enum: { name: string; values: string[] };
  viewModel: { name: 'Room'; properties: Array<{ name: string; type: 'enum' | 'trigger' | 'boolean' }> };
  animations: PlanAnimation[];
  layers: PlanLayer[];
}

const cubic = 'cubic' as const, linear = 'linear' as const;

/**
 * Motion vocabulary for a v3 room. Doors: 2-D hinge compression toward the leaf's top-left pivot over 26 frames (the drawn recess shows
 * through); access lights brighten on focus; ambient = the room light level breathing and mug steam drifting. Targets are the package's ids.
 */
export function planRoom(manifest: RoomManifest): RoomPlan {
  const doors: PlanDoor[] = manifest.doors.map(d => ({ id: d.id, leafId: d.leafId, hinge: d.pivot, accessLightId: d.accessLightId, hotspotId: d.hotspotId, trigger: `open${d.id}` }));
  const hotspots: PlanHotspot[] = manifest.hotspots.map(h => ({ id: h.id, label: h.label, hit: { x: h.rect[0], y: h.rect[1], width: h.rect[2], height: h.rect[3] }, pageId: h.pageId, section: h.section, trigger: doors.find(d => d.hotspotId === h.id)?.trigger ?? null }));
  const lightLevelId = manifest.ambient.find(a => /LightLevel$/.test(a.id))?.id ?? null;
  const steamIds = manifest.ambient.filter(a => a.kind === 'steam').map(a => a.id);
  const enumValues = ['none', ...hotspots.map(h => h.id)];
  const animations: PlanAnimation[] = [];
  const ambientKeys: PlanKey[] = [];
  if (lightLevelId) ambientKeys.push({ target: lightLevelId, property: 'opacity', frame: 0, value: 100, interpolation: cubic }, { target: lightLevelId, property: 'opacity', frame: 240, value: 70, interpolation: cubic });
  for (const d of doors) if (d.accessLightId) ambientKeys.push({ target: d.accessLightId, property: 'opacity', frame: 0, value: 60, interpolation: cubic }, { target: d.accessLightId, property: 'opacity', frame: 240, value: 100, interpolation: cubic });
  for (const s of steamIds) ambientKeys.push({ target: s, property: 'y', frame: 0, value: 0, interpolation: linear }, { target: s, property: 'y', frame: 240, value: -14, interpolation: linear }, { target: s, property: 'opacity', frame: 0, value: 90, interpolation: linear }, { target: s, property: 'opacity', frame: 240, value: 0, interpolation: linear });
  animations.push({ name: 'Ambient', durationFrames: 240, loop: 'pingPong', keys: ambientKeys });
  for (const d of doors) animations.push({ name: `DoorOpen_${d.id}`, durationFrames: 26, loop: 'oneShot', keys: [
    { target: `hinge:${d.id}`, property: 'scaleX', frame: 0, value: 100, interpolation: cubic },
    { target: `hinge:${d.id}`, property: 'scaleX', frame: 26, value: 22, interpolation: cubic },
    ...(d.accessLightId ? [{ target: d.accessLightId, property: 'opacity' as const, frame: 0, value: 100, interpolation: hold }, { target: d.accessLightId, property: 'opacity' as const, frame: 26, value: 100, interpolation: hold }] : []),
  ] });
  for (const h of hotspots) {
    const door = doors.find(d => d.hotspotId === h.id);
    if (!door?.accessLightId) continue;
    animations.push({ name: `Focus_${h.id}`, durationFrames: 12, loop: 'oneShot', keys: [
      { target: door.accessLightId, property: 'opacity', frame: 0, value: 60, interpolation: cubic }, { target: door.accessLightId, property: 'opacity', frame: 12, value: 100, interpolation: cubic },
      { target: door.accessLightId, property: 'scaleX', frame: 0, value: 100, interpolation: cubic }, { target: door.accessLightId, property: 'scaleX', frame: 12, value: 125, interpolation: cubic },
      { target: door.accessLightId, property: 'scaleY', frame: 0, value: 100, interpolation: cubic }, { target: door.accessLightId, property: 'scaleY', frame: 12, value: 125, interpolation: cubic },
    ] });
  }
  const focusStates = animations.filter(a => a.name.startsWith('Focus_')).map(a => a.name);
  const layers: PlanLayer[] = [
    { name: 'Ambient', states: [{ name: 'Ambient', animation: 'Ambient' }], transitions: [{ from: '{Entry State}', to: 'Ambient' }] },
    ...doors.map(d => ({ name: `Door_${d.id}`, states: [{ name: 'Closed' }, { name: 'Open', animation: `DoorOpen_${d.id}` }], transitions: [{ from: '{Entry State}', to: 'Closed' }, { from: 'Closed', to: 'Open', when: { property: d.trigger } }] })),
    { name: 'Focus', states: [{ name: 'None' }, ...focusStates.map(name => ({ name, animation: name }))], transitions: [
      { from: '{Entry State}', to: 'None' },
      ...focusStates.map(name => ({ from: '{Any State}', to: name, when: { property: 'focus', equals: name.replace('Focus_', '') } })),
      { from: '{Any State}', to: 'None', when: { property: 'focus', equals: 'none' } },
    ] },
  ];
  return {
    room: manifest.room, artboard: ARTBOARD_NAMES[manifest.room], width: manifest.canvas.width, height: manifest.canvas.height, scene: { file: 'scene.svg', nodeName: 'scene' },
    doors, hotspots, floorAnchor: manifest.floorAnchor, ambient: { lightLevelId, steamIds },
    enum: { name: `${ARTBOARD_NAMES[manifest.room]}Focus`, values: enumValues },
    viewModel: { name: 'Room', properties: [{ name: 'focus', type: 'enum' }, ...doors.map(d => ({ name: d.trigger, type: 'trigger' as const })), { name: 'reducedMotion', type: 'boolean' }] },
    animations, layers,
  };
}
const hold = 'hold' as const;

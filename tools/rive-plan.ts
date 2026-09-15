import type { RefinedManifest } from './refine-vectors.ts';

export type DoorId = 'it' | 'government' | 'cyber';
export const TITLE: Record<DoorId, string> = { it: 'It', government: 'Government', cyber: 'Cyber' };
interface KitDoor { id: DoorId; label: string; href: string; leafId: string; pivot: [number, number]; hitbox: { x: number; y: number; width: number; height: number } }

export interface PlanKey { target: 'hinge' | 'light' | 'leaf'; door?: DoorId; property: 'scaleX' | 'y' | 'opacity' | 'scaleY'; frame: number; value: number; interpolation: 'cubic' | 'linear' | 'hold' }
export interface PlanAnimation { name: string; durationFrames: number; loop: 'oneShot' | 'loop' | 'pingPong'; keys: PlanKey[] }
export interface PlanLayer { name: string; states: Array<{ name: string; animation?: string }>; transitions: Array<{ from: string; to: string; when?: { property: string; equals?: string | boolean } }> }
export interface LobbyPlan {
  artboard: 'Lobby'; width: 1648; height: 928;
  scene: { file: 'scene.svg'; nodeName: 'scene' };
  doors: Array<{ id: DoorId; leafId: string; hinge: [number, number]; hit: { x: number; y: number; width: number; height: number }; href: string; label: string }>;
  enum: { name: 'LobbyFocus'; values: ['none', 'it', 'government', 'cyber'] };
  viewModel: { name: 'Lobby'; properties: Array<{ name: string; type: 'enum' | 'trigger' | 'boolean' }> };
  animations: PlanAnimation[];
  layers: PlanLayer[];
}

/** The lobby's motion vocabulary. Door = 2-D hinge compression toward the kit pivot over 26 frames; focus = 4 px lift + status light swell; ambient = lights breathe. */
export function planLobby(manifest: RefinedManifest): LobbyPlan {
  const hotspots = manifest.hotspots as { doors: KitDoor[] };
  const doors = hotspots.doors.map(door => ({ id: door.id, leafId: door.leafId, hinge: door.pivot, hit: door.hitbox, href: door.href, label: door.label }));
  const cubic = 'cubic' as const, linear = 'linear' as const;
  const animations: PlanAnimation[] = [
    { name: 'Ambient', durationFrames: 180, loop: 'pingPong', keys: [
      ...doors.map(d => ({ target: 'light' as const, door: d.id, property: 'opacity' as const, frame: 0, value: 70, interpolation: cubic })),
      ...doors.map(d => ({ target: 'light' as const, door: d.id, property: 'opacity' as const, frame: 180, value: 100, interpolation: cubic })),
    ] },
    ...doors.map(d => ({ name: `DoorOpen${TITLE[d.id]}`, durationFrames: 26, loop: 'oneShot' as const, keys: [
      { target: 'hinge' as const, door: d.id, property: 'scaleX' as const, frame: 0, value: 100, interpolation: cubic },
      { target: 'hinge' as const, door: d.id, property: 'scaleX' as const, frame: 26, value: 22, interpolation: cubic },
      { target: 'leaf' as const, door: d.id, property: 'opacity' as const, frame: 0, value: 100, interpolation: linear },
      { target: 'leaf' as const, door: d.id, property: 'opacity' as const, frame: 26, value: 82, interpolation: linear },
    ] })),
    ...doors.map(d => ({ name: `Focus${TITLE[d.id]}`, durationFrames: 12, loop: 'oneShot' as const, keys: [
      { target: 'hinge' as const, door: d.id, property: 'y' as const, frame: 0, value: d.hinge[1], interpolation: cubic },
      { target: 'hinge' as const, door: d.id, property: 'y' as const, frame: 12, value: d.hinge[1] - 4, interpolation: cubic },
      { target: 'light' as const, door: d.id, property: 'scaleX' as const, frame: 0, value: 100, interpolation: cubic },
      { target: 'light' as const, door: d.id, property: 'scaleX' as const, frame: 12, value: 130, interpolation: cubic },
      { target: 'light' as const, door: d.id, property: 'scaleY' as const, frame: 0, value: 100, interpolation: cubic },
      { target: 'light' as const, door: d.id, property: 'scaleY' as const, frame: 12, value: 130, interpolation: cubic },
    ] })),
  ];
  const layers: PlanLayer[] = [
    { name: 'Ambient', states: [{ name: 'Ambient', animation: 'Ambient' }], transitions: [{ from: '{Entry State}', to: 'Ambient' }] },
    ...doors.map(d => ({ name: `Door${TITLE[d.id]}`, states: [{ name: 'Closed' }, { name: 'Open', animation: `DoorOpen${TITLE[d.id]}` }], transitions: [{ from: 'Closed', to: 'Open', when: { property: `open${TITLE[d.id]}` } }] })),
    { name: 'Focus', states: [{ name: 'None' }, ...doors.map(d => ({ name: `Focus${TITLE[d.id]}`, animation: `Focus${TITLE[d.id]}` }))], transitions: [
      ...doors.map(d => ({ from: '{Any State}', to: `Focus${TITLE[d.id]}`, when: { property: 'focus', equals: d.id } })),
      { from: '{Any State}', to: 'None', when: { property: 'focus', equals: 'none' } },
    ] },
  ];
  return {
    artboard: 'Lobby', width: 1648, height: 928, scene: { file: 'scene.svg', nodeName: 'scene' }, doors,
    enum: { name: 'LobbyFocus', values: ['none', 'it', 'government', 'cyber'] },
    viewModel: { name: 'Lobby', properties: [{ name: 'focus', type: 'enum' }, ...doors.map(d => ({ name: `open${TITLE[d.id]}`, type: 'trigger' as const })), { name: 'reducedMotion', type: 'boolean' }] },
    animations, layers,
  };
}

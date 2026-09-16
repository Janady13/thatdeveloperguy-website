import manifest from '../../../../../creative-source/rive/lobby/rive-manifest.json';

export interface Hotspot { id: string; label: string; href: string; hit: { x: number; y: number; width: number; height: number }; focusValue: string; trigger: string }
interface DoorRecord { id: string; leafId: string; hinge: [number, number]; hit: Hotspot['hit']; href: string; label: string }
const TITLE: Record<string, string> = { it: 'It', government: 'Government', cyber: 'Cyber' };

export function hotspotsFromManifest(m: { doors: DoorRecord[] }): Hotspot[] {
  return m.doors.map(door => ({ id: door.id, label: door.label, href: door.href, hit: door.hit, focusValue: door.id, trigger: `open${TITLE[door.id] ?? door.id}` }));
}
const m = manifest as unknown as { file: string; artboard: string; stateMachine: string; viewModel: string; doors: DoorRecord[]; exportedBy?: string };
export const LOBBY_HOTSPOTS = hotspotsFromManifest(m);
/** The Rive layer is only offered when the .riv is a real editor export; the MCP export omits the Lobby artboard. */
export const LOBBY_RIVE = m.exportedBy === 'editor-ui' ? { src: `/scenes/lobby/${m.file}`, artboard: m.artboard, stateMachine: m.stateMachine, viewModel: m.viewModel } : null;

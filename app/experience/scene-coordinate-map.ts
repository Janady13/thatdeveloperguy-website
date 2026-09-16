import { ROOM, type Hitbox, type SceneCanvas } from '../../src/contracts/scene';
/** Room coordinates come from the scene manifest; the overlay SVG shares the poster/Rive viewBox so hit targets stay on the doors at any size. */
export const DEFAULT_CANVAS = ROOM;
export function sceneViewBox(canvas: SceneCanvas = DEFAULT_CANVAS): string { return `0 0 ${canvas.width} ${canvas.height}`; }
export function sceneAspect(canvas: SceneCanvas = DEFAULT_CANVAS): string { return `${canvas.width} / ${canvas.height}`; }
export function hitCenter(hit: Hitbox): { x: number; y: number } { return { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 }; }

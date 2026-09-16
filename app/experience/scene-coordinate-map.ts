import { ROOM, type Hitbox } from '../../src/contracts/scene';
/** Room coordinates (1648×928) are the only coordinate system; the overlay SVG shares the poster's viewBox so hit targets stay on the doors at any size. */
export const VIEWBOX = `0 0 ${ROOM.width} ${ROOM.height}`;
export const ASPECT = `${ROOM.width} / ${ROOM.height}`;
export function hitCenter(hit: Hitbox): { x: number; y: number } { return { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 }; }

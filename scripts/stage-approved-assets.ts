/**
 * creative-source → public/ + app/experience/scenes/<id>/scene.json.
 * Posters (refined scene SVGs) always ship. A .riv ships only when its manifest says it came from the editor UI or the official CLI
 * (`exportedBy: editor-ui | rive-cli`); the MCP's own riv export omits MCP-created artboards, so it is never staged.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SceneHotspot, SceneRecord } from '../src/contracts/scene.ts';
import destinations from '../content/site/scene-destinations.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const KITS: Record<string, { room: string; poster: string; captions: Record<string, string> }> = {
  lobby: { room: 'lobby', poster: 'A lobby with three doors: IT Services, Government Solutions, Cyber Security', captions: { it: 'IT Services — support, endpoints, infrastructure and deployment.', government: 'Government Solutions — planning, requirements, contracting and delivery.', cyber: 'Cyber Security — monitoring, review, response and infrastructure protection.' } },
  'it-services': { room: 'it-services', poster: 'The IT Services room: status board, service desk, workstations, server racks and a tool cart', captions: {} },
  government: { room: 'government-solutions', poster: 'The Government Solutions room: presentation display, planning boards, contract files and a conference table', captions: {} },
  cybersecurity: { room: 'cybersecurity', poster: 'The Cyber Security room: threat map, health and operations displays, server racks and reference files', captions: {} },
};
const TITLE: Record<string, string> = { it: 'It', government: 'Government', cyber: 'Cyber' };

function hotspotsFor(sceneId: string, kitHotspots: any): SceneHotspot[] {
  const dest = (destinations as any)[sceneId];
  if (kitHotspots.doors) return kitHotspots.doors.map((door: any) => ({ id: door.id, label: door.label, hit: door.hitbox, target: { kind: 'page', pageId: dest.doors[door.id] }, focusValue: door.id, trigger: `open${TITLE[door.id] ?? door.id}` }));
  return kitHotspots.hotspots.filter((h: any) => h.hitbox).map((h: any) => {
    const [x, y, width, height] = h.hitbox as [number, number, number, number];
    const href: string = h.href;
    const target = href.startsWith('#') ? { kind: 'anchor' as const, anchor: href.slice(1) } : href.startsWith('/contact') ? { kind: 'page' as const, pageId: dest.contactPage, project: new URL(href, 'https://x').searchParams.get('project') ?? undefined } : { kind: 'page' as const, pageId: dest.lobbyPage };
    return { id: h.id, label: h.label, hit: { x, y, width, height }, target, focusValue: h.id };
  });
}

mkdirSync(resolve(root, 'public/images/posters'), { recursive: true });
mkdirSync(resolve(root, 'public/animation/rooms'), { recursive: true });
for (const [sceneId, kit] of Object.entries(KITS)) {
  const refined = resolve(root, 'creative-source/refined', kit.room);
  const manifest = JSON.parse(readFileSync(resolve(refined, 'manifest.json'), 'utf8'));
  copyFileSync(resolve(refined, existsSync(resolve(refined, 'poster.svg')) ? 'poster.svg' : 'scene.svg'), resolve(root, `public/images/posters/${sceneId}.svg`));
  const rivePath = resolve(root, 'creative-source/rive', kit.room, 'rive-manifest.json');
  let rive: SceneRecord['rive'] = null;
  if (existsSync(rivePath)) {
    const rm = JSON.parse(readFileSync(rivePath, 'utf8'));
    if (rm.exportedBy === 'editor-ui' || rm.exportedBy === 'rive-cli') { copyFileSync(resolve(root, 'creative-source/rive', kit.room, rm.file), resolve(root, `public/animation/rooms/${sceneId}.riv`)); rive = { file: `/animation/rooms/${sceneId}.riv`, artboard: rm.artboard, stateMachine: rm.stateMachine, viewModel: rm.viewModel, sha256: rm.sha256 }; }
  }
  const scene: SceneRecord = { id: sceneId, poster: `/images/posters/${sceneId}.svg`, posterAlt: kit.poster, rive, hotspots: hotspotsFor(sceneId, manifest.hotspots), captionRest: (destinations as any)[sceneId].captionRest, captions: kit.captions };
  const out = resolve(root, 'app/experience/scenes', sceneId); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
  console.log(`${sceneId}: poster staged, ${scene.hotspots.length} hotspots, rive ${rive ? 'staged' : 'not staged (no editor export yet)'}`);
}

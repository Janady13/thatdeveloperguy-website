/**
 * creative-source → public/ + app/experience/scenes/<id>/scene.json.
 * Posters are the v3 vector masters as-is. A room .riv ships only from a verified export (`exportedBy: rive-cli | editor-ui`);
 * the Consultant likewise. Hotspots carry the site's page ids and sections straight from the package; door hotspots get their Rive trigger.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SceneConsultant, SceneHotspot, SceneRecord } from '../src/contracts/scene.ts';

const root = resolve(import.meta.dirname, '..');
const ROOMS: Record<string, { posterAlt: string; captionRest: string }> = {
  lobby: { posterAlt: 'The lobby: reception desk, three doors — IT Services, Government Solutions, Cybersecurity — and a lounge by the window', captionRest: 'Three doors. Pick the room you need.' },
  'it-services': { posterAlt: 'The IT Services room: status board, service desk, workstations, server racks and a tool cart', captionRest: 'Every object in the room is a section of this page.' },
  government: { posterAlt: 'The Government Solutions room: presentation display, project and review boards, contract files and a conference table', captionRest: 'Every object in the room is a section of this page.' },
  cybersecurity: { posterAlt: 'The Cybersecurity room: network visibility, review scope and security operations displays, consoles, racks and a secure door', captionRest: 'Every object in the room is a section of this page.' },
};
const CAPTIONS: Record<string, string> = {
  'door-IT': 'IT Services — support, endpoints, infrastructure and deployment.', 'door-Gov': 'Government Solutions — planning, requirements, contracting and delivery.', 'door-Cyber': 'Cyber Security — monitoring, review, response and infrastructure protection.',
  reception: 'Reception — request a briefing.', lounge: 'The lounge — who we are.',
};

mkdirSync(resolve(root, 'public/images/posters'), { recursive: true });
mkdirSync(resolve(root, 'public/animation/rooms'), { recursive: true });
mkdirSync(resolve(root, 'public/animation/consultant'), { recursive: true });

const consultantManifestPath = resolve(root, 'creative-source/consultant/patch/rive-manifest.json');
let consultant: Omit<SceneConsultant, 'placement'> | null = null;
if (existsSync(consultantManifestPath)) {
  const cm = JSON.parse(readFileSync(consultantManifestPath, 'utf8'));
  if (cm.exportedBy === 'rive-cli' || cm.exportedBy === 'editor-ui') { copyFileSync(resolve(root, 'creative-source/consultant/patch', cm.file), resolve(root, 'public/animation/consultant/patch.riv')); consultant = { file: '/animation/consultant/patch.riv', sha256: cm.sha256, artboard: cm.artboard, stateMachine: cm.stateMachine }; }
}

for (const [sceneId, meta] of Object.entries(ROOMS)) {
  const refined = resolve(root, 'creative-source/refined', sceneId);
  const manifest = JSON.parse(readFileSync(resolve(refined, 'manifest.json'), 'utf8'));
  copyFileSync(resolve(refined, 'poster.svg'), resolve(root, `public/images/posters/${sceneId}.svg`));
  const rivePath = resolve(root, 'creative-source/rive', sceneId, 'rive-manifest.json');
  let rive: SceneRecord['rive'] = null; let triggers: Record<string, string> = {};
  if (existsSync(rivePath)) {
    const rm = JSON.parse(readFileSync(rivePath, 'utf8'));
    if ((rm.exportedBy === 'rive-cli' || rm.exportedBy === 'editor-ui') && rm.source?.sha256 === manifest.source.sha256) {
      copyFileSync(resolve(root, 'creative-source/rive', sceneId, rm.file), resolve(root, `public/animation/rooms/${sceneId}.riv`));
      rive = { file: `/animation/rooms/${sceneId}.riv`, artboard: rm.artboard, stateMachine: rm.stateMachine, viewModel: rm.viewModel, sha256: rm.sha256 };
      for (const h of rm.hotspots ?? []) if (h.trigger) triggers[h.id] = h.trigger;
    } else console.warn(`${sceneId}: rive-manifest present but not a verified export of the current master; not staged`);
  }
  const hotspots: SceneHotspot[] = manifest.hotspots.map((h: any) => ({ id: h.id, label: h.label, hit: { x: h.rect[0], y: h.rect[1], width: h.rect[2], height: h.rect[3] }, target: h.section ? { kind: 'anchor' as const, anchor: h.section.replace(/^#/, ''), pageId: h.pageId } : { kind: 'page' as const, pageId: h.pageId }, focusValue: h.id, ...(triggers[h.id] ? { trigger: triggers[h.id] } : {}) }));
  const scene: SceneRecord = { id: sceneId, poster: `/images/posters/${sceneId}.svg`, posterAlt: meta.posterAlt, rive, consultant: consultant ? { ...consultant, placement: { feet: manifest.floorAnchor, scale: 0.42, artboard: { width: 515, height: 805 } } } : null, hotspots, captionRest: meta.captionRest, captions: CAPTIONS };
  const out = resolve(root, 'app/experience/scenes', sceneId); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
  console.log(`${sceneId}: poster ${(manifest.source.bytes / 1024).toFixed(0)} KB, ${hotspots.length} hotspots, rive ${rive ? 'staged' : 'not staged'}, consultant ${consultant ? `at ${manifest.floorAnchor.join(',')}` : 'not staged'}`);
}

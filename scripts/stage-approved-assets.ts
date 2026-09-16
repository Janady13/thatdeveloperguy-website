/**
 * creative-source → public/ + app/experience/scenes/<id>/scene.json.
 * Posters are the approved room masters as-is. A room .riv ships only from a verified export (`exportedBy: rive-cli | editor-ui`).
 * Hotspots carry the site's page ids and sections straight from the package; door hotspots get their Rive trigger.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { SceneHotspot, SceneRecord } from '../src/contracts/scene.ts';

const root = resolve(import.meta.dirname, '..');
const ROOMS: Record<string, { posterAlt: string; captionRest: string }> = {
  lobby: { posterAlt: 'The lobby: reception desk, three doors — IT Services, Government Solutions, Cybersecurity — and a lounge by the window', captionRest: 'Three doors. Pick the room you need.' },
  'it-services': { posterAlt: 'The IT Services room: status board, service desk, workstations, server racks and a tool cart', captionRest: 'Every object in the room is a section of this page.' },
  government: { posterAlt: 'The Government Solutions room: presentation display, project and review boards, contract files and a conference table', captionRest: 'Every object in the room is a section of this page.' },
  cybersecurity: { posterAlt: 'The Cybersecurity room: network visibility, review scope and security operations displays, consoles, racks and a secure door', captionRest: 'Every object in the room is a section of this page.' },
};
const ROOM_CAPTIONS: Record<string, Record<string, string>> = {
  lobby: {
    'door-IT': 'IT Services — support, endpoints, infrastructure and deployment.',
    'door-Gov': 'Government Solutions — planning, requirements, contracting and delivery.',
    'door-Cyber': 'Cyber Security — monitoring, review, response and infrastructure protection.',
    reception: 'Reception — request a briefing.',
    lounge: 'The lounge — who we are.',
  },
  'it-services': {
    status: 'Systems health, service status, deployments and continuity at a glance.',
    helpdesk: 'IT support desk, service requests and day-to-day user help.',
    deployment: 'Planned deployment and maintenance with rollback discipline.',
    toolcart: 'Plan, configure, deploy, maintain and improve.',
    workstations: 'Support desk, endpoints, accounts and workstation management.',
    racks: 'Network, infrastructure, servers and cloud foundations.',
  },
  government: {},
  cybersecurity: {},
};

mkdirSync(resolve(root, 'public/images/posters'), { recursive: true });
const roomAnimationDir = resolve(root, 'public/animation/rooms');
mkdirSync(roomAnimationDir, { recursive: true });
for (const [sceneId, meta] of Object.entries(ROOMS)) {
  const refined = resolve(root, 'creative-source/refined', sceneId);
  const manifest = JSON.parse(readFileSync(resolve(refined, 'manifest.json'), 'utf8'));
  const rivePath = resolve(root, 'creative-source/rive', sceneId, 'rive-manifest.json');
  let riveManifest: any = null;
  if (existsSync(rivePath)) riveManifest = JSON.parse(readFileSync(rivePath, 'utf8'));
  const canvas = riveManifest?.canvas ?? manifest.canvas;
  const rasterPoster = resolve(root, 'creative-source/rive', sceneId, 'poster.webp');
  const posterExt = existsSync(rasterPoster) ? 'webp' : 'svg';
  if (sceneId === 'lobby') {
    const vectorSource = resolve(refined, 'scene.svg');
    const vectorBytes = readFileSync(vectorSource);
    const sourceHash = createHash('sha256').update(vectorBytes).digest('hex');
    if (sourceHash !== manifest.source.sha256) throw new Error(`lobby kit hash mismatch: ${sourceHash}`);
  }
  if (posterExt === 'webp') copyFileSync(rasterPoster, resolve(root, `public/images/posters/${sceneId}.webp`));
  else copyFileSync(resolve(refined, 'poster.svg'), resolve(root, `public/images/posters/${sceneId}.svg`));
  if (sceneId === 'cybersecurity') {
    const kitMetadata = JSON.parse(readFileSync(resolve(refined, 'kit-source.json'), 'utf8'));
    const vectorSource = resolve(refined, 'animation-scene.svg');
    const vectorHash = createHash('sha256').update(readFileSync(vectorSource)).digest('hex');
    if (vectorHash !== kitMetadata.productionVector.sha256) throw new Error(`cybersecurity kit hash mismatch: ${vectorHash}`);
    const vectorOutput = resolve(root, 'public/animation/cybersecurity');
    mkdirSync(vectorOutput, { recursive: true });
    copyFileSync(vectorSource, resolve(vectorOutput, 'cybersecurity-scene.svg'));
    for (const pass of kitMetadata.depthPasses ?? []) {
      const passSource = resolve(root, pass.repoSource);
      const passHash = createHash('sha256').update(readFileSync(passSource)).digest('hex');
      if (passHash !== pass.sha256) throw new Error(`cybersecurity ${pass.id} depth-pass hash mismatch: ${passHash}`);
      copyFileSync(passSource, resolve(vectorOutput, `${pass.id}.svg`));
    }
  }
  let rive: SceneRecord['rive'] = null; let triggers: Record<string, string> = {}; let focusValues: Record<string, string> = {};
  if (riveManifest) {
    const rm = riveManifest;
    const rmlSourcePath = rm.source?.kind === 'rive-rml-project' && typeof rm.source?.path === 'string' ? resolve(root, rm.source.path) : null;
    const rmlSourceMatches = Boolean(rmlSourcePath && existsSync(rmlSourcePath) && createHash('sha256').update(readFileSync(rmlSourcePath)).digest('hex') === rm.source.sha256);
    const sourceMatches = rm.source?.sha256 === manifest.source.sha256 || rmlSourceMatches;
    const lobbyNativeOverride = sceneId === 'lobby' && (rm.source?.kind === 'production-layer-stack' || rm.source?.kind === 'optimized-production-layer-stack') && rm.sha256 && rm.file;
    if ((rm.exportedBy === 'rive-cli' || rm.exportedBy === 'editor-ui') && (sourceMatches || lobbyNativeOverride)) {
      const sourceRive = resolve(root, 'creative-source/rive', sceneId, rm.file);
      const bytes = readFileSync(sourceRive);
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (hash !== rm.sha256) throw new Error(`${sceneId}: compiled Rive hash mismatch: ${hash}`);
      const shortHash = hash.slice(0, 12);
      const riveFileName = `${sceneId}.${shortHash}.riv`;
      for (const file of readdirSync(roomAnimationDir)) if (file === `${sceneId}.riv` || file.startsWith(`${sceneId}.`) && file.endsWith('.riv')) unlinkSync(resolve(roomAnimationDir, file));
      copyFileSync(sourceRive, resolve(roomAnimationDir, riveFileName));
      rive = { file: `/animation/rooms/${riveFileName}`, artboard: rm.artboard, stateMachine: rm.stateMachine, viewModel: rm.viewModel, sha256: hash, ...(rm.viewModelOptional ? { viewModelOptional: true } : {}), ...(rm.nativeInputs ? { nativeInputs: rm.nativeInputs } : {}) };
      for (const h of rm.hotspots ?? []) { if (h.trigger) triggers[h.id] = h.trigger; if (h.focusValue) focusValues[h.id] = h.focusValue; }
    } else if (sceneId === 'lobby') throw new Error('lobby: verified RML source and compiled Rive are required');
    else console.warn(`${sceneId}: rive-manifest present but not a verified export of the current master; not staged`);
  }
  const hotspots: SceneHotspot[] = manifest.hotspots.map((h: any) => ({ id: h.id, label: h.label, hit: { x: h.rect[0], y: h.rect[1], width: h.rect[2], height: h.rect[3] }, target: h.section ? { kind: 'anchor' as const, anchor: h.section.replace(/^#/, ''), pageId: h.pageId } : { kind: 'page' as const, pageId: h.pageId }, focusValue: focusValues[h.id] ?? (rive ? 'none' : h.id), ...(triggers[h.id] ? { trigger: triggers[h.id] } : {}) }));
  if (sceneId === 'lobby' && !rive) throw new Error('lobby: animation cannot be disabled or replaced by a fallback implementation');
  const scene: SceneRecord = { id: sceneId, canvas, poster: `/images/posters/${sceneId}.${posterExt}`, posterAlt: meta.posterAlt, rive, hotspots, captionRest: meta.captionRest, captions: ROOM_CAPTIONS[sceneId] ?? {} };
  const out = resolve(root, 'app/experience/scenes', sceneId); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
  console.log(`${sceneId}: poster ${(manifest.source.bytes / 1024).toFixed(0)} KB, ${hotspots.length} hotspots, rive ${rive ? 'staged' : 'not staged'}`);
}

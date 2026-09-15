/**
 * Authors the lobby artboard in the open Rive Early Access file and exports it.
 *   npm run rive:author -- --room lobby [--replace | --resume]
 *   npm run rive:author -- --room lobby --riv <path-to-editor-ui-export.riv>   (ingest)
 * Every editor call is appended to scenes/rive/lobby/authoring-log.json.
 *
 * Editor facts this relies on (probed 2026-09-15, editor MCP 0.6): property keys are short names
 * (x=13, y=14, r=15, sx=16, sy=17, opacity=18; animation fps=56, duration=57 in frames, loop=59 enum
 * oneShot|loop|pingPong); createLinearAnimations.duration is in seconds; reparenting keeps world
 * position; group_editor cannot wrap a plain Node (no stage bounds), so hinges are empty groups + reparent.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './kits.ts';
import { RiveEditor, type LogEntry } from './rive-mcp.ts';
import { planLobby, TITLE, type DoorId, type LobbyPlan } from './rive-plan.ts';
import type { RefinedManifest } from './refine-vectors.ts';

const LIGHT_ID: Record<DoorId, string> = { it: 'door_it_status_light', government: 'door_government_status_light', cyber: 'door_cyber_status_light' };
const KEY_ALIAS: Record<string, string[]> = { scaleX: ['sx', 'scalex'], scaleY: ['sy', 'scaley'], rotation: ['r', 'rotation'], x: ['x'], y: ['y'], opacity: ['opacity'], loop: ['loop'], duration: ['duration'], fps: ['fps'] };
const LOOP_INDEX = { oneShot: 0, loop: 1, pingPong: 2 } as const;

interface Ctx { editor: RiveEditor; plan: LobbyPlan; artboardId: string; ids: Map<string, string>; keys: Map<string, Record<string, number>>; vm: { id: string; props: Record<string, string> }; animations: Record<string, string>; stateMachineId: string; stateMachineName: string }

async function propertyKey(ctx: Ctx, objectId: string, name: string): Promise<number> {
  if (!ctx.keys.has(objectId)) {
    const result = await ctx.editor.call<{ properties: Record<string, Record<string, number>> }>('query_property_keys', { objectIds: [objectId] });
    ctx.keys.set(objectId, result.properties[objectId] ?? {});
  }
  const table = ctx.keys.get(objectId)!;
  for (const alias of KEY_ALIAS[name] ?? [name.toLowerCase()]) if (alias in table) return table[alias]!;
  throw new Error(`property ${name} not found on ${objectId}: ${Object.keys(table).join(', ')}`);
}

async function values(ctx: Ctx, objectId: string, keys: number[]): Promise<Record<string, number>> {
  const result = await ctx.editor.call<{ values: Record<string, Record<string, number>> }>('query_property_values', { propertyKeys: { [objectId]: keys } });
  return result.values[objectId] ?? {};
}

async function findId(ctx: Ctx, name: string): Promise<string> {
  const result = await ctx.editor.call<{ objects: Array<{ id: string; name: string }> }>('find_objects', { name });
  const exact = result.objects.find(o => o.name === name);
  if (!exact) throw new Error(`object ${name} not found in artboard`);
  return exact.id;
}

/** Hinge = an empty group at the kit pivot; the leaf is reparented into it (the editor keeps its world position), then the group takes the leaf's slot in the door group so draw order is unchanged. */
async function hinge(ctx: Ctx, door: LobbyPlan['doors'][number]): Promise<void> {
  const leafId = await findId(ctx, door.leafId);
  const leaf = await ctx.editor.call<{ objects: Array<{ id: string; parentId: string }> }>('find_objects', { name: door.leafId });
  const doorGroupId = leaf.objects.find(o => o.id === leafId)!.parentId;
  const group = await ctx.editor.call<{ group: { id: string } }>('group_editor', { name: `hinge_${door.id}`, parentId: doorGroupId });
  const hingeId = group.group.id;
  await ctx.editor.call('set_property_values', { propertyValues: { [hingeId]: { [await propertyKey(ctx, hingeId, 'x')]: door.hinge[0], [await propertyKey(ctx, hingeId, 'y')]: door.hinge[1] } } });
  await ctx.editor.call('reparent_objects', { operations: [{ objectId: leafId, newParentId: hingeId, position: 'start' }] });
  await ctx.editor.call('reparent_objects', { operations: [{ objectId: hingeId, newParentId: doorGroupId, position: 'start' }] });
  ctx.ids.set(`hinge:${door.id}`, hingeId); ctx.ids.set(`leaf:${door.id}`, leafId); ctx.ids.set(`light:${door.id}`, await findId(ctx, LIGHT_ID[door.id]));
}

async function hitShapes(ctx: Ctx): Promise<void> {
  const shapes = ctx.plan.doors.map(door => ({ primitive: 'rectangle', name: `hit_${door.id}`, parentId: ctx.artboardId, x: door.hit.x + door.hit.width / 2, y: door.hit.y + door.hit.height / 2, width: door.hit.width, height: door.hit.height, paints: [{ paintType: 'fill', color: '#00000000' }] }));
  await ctx.editor.call('path_editor', { command: 'createParametricShapes', data: { createParametricShapes: { shapes } } });
  for (const door of ctx.plan.doors) ctx.ids.set(`hit:${door.id}`, await findId(ctx, `hit_${door.id}`));
}

async function viewModel(ctx: Ctx): Promise<void> {
  await ctx.editor.call('viewmodel_editor', { command: 'createDataEnums', data: { createDataEnums: { dataEnums: [{ name: ctx.plan.enum.name, values: [...ctx.plan.enum.values] }] } } });
  await ctx.editor.call('viewmodel_editor', { command: 'createViewModels', data: { createViewModels: { viewModels: [{ name: ctx.plan.viewModel.name, viewModelProperties: ctx.plan.viewModel.properties.map(p => p.type === 'enum' ? { name: p.name, propertyType: 'enum', enumName: ctx.plan.enum.name } : { name: p.name, propertyType: p.type }) }] } } });
  const listed = await ctx.editor.call<{ viewModels: Array<{ id: string; name: string; properties?: Array<{ id: string; name: string }>; viewModelProperties?: Array<{ id: string; name: string }> }> }>('viewmodel_editor', { command: 'listViewModels', data: { listViewModels: {} } });
  const vm = listed.viewModels.find(v => v.name === ctx.plan.viewModel.name);
  if (!vm) throw new Error(`view model ${ctx.plan.viewModel.name} not listed after creation: ${JSON.stringify(listed).slice(0, 300)}`);
  const props: Record<string, string> = {};
  for (const p of vm.properties ?? vm.viewModelProperties ?? []) props[p.name] = p.id;
  for (const p of ctx.plan.viewModel.properties) if (!props[p.name]) throw new Error(`view-model property ${p.name} missing: ${JSON.stringify(vm).slice(0, 400)}`);
  ctx.vm = { id: vm.id, props };
  await ctx.editor.call('viewmodel_editor', { command: 'bindViewModelToArtboard', data: { bindViewModelToArtboard: { artboardId: ctx.artboardId, viewModelId: vm.id } } });
}

async function animations(ctx: Ctx): Promise<void> {
  const existing = await ctx.editor.call<{ linearAnimations: Array<{ id: string; name: string }> }>('animation_editor', { command: 'listLinearAnimations', data: { listLinearAnimations: {} } });
  const [first, ...rest] = ctx.plan.animations;
  const pristine = existing.linearAnimations.find(a => /^Timeline( \d+)?$/.test(a.name));
  if (pristine) { await ctx.editor.call('animation_editor', { command: 'renameAnimations', data: { renameAnimations: { animations: [{ animationId: pristine.id, name: first!.name }] } } }); ctx.animations[first!.name] = pristine.id; }
  const toCreate = pristine ? rest : ctx.plan.animations;
  const created = await ctx.editor.call<{ animations: Array<{ id: string; name: string }> }>('animation_editor', { command: 'createLinearAnimations', data: { createLinearAnimations: { linearAnimations: toCreate.map(a => ({ name: a.name, duration: 1 })) } } });
  for (const a of created.animations) ctx.animations[a.name] = a.id;
  for (const a of ctx.plan.animations) if (!ctx.animations[a.name]) throw new Error(`animation ${a.name} was not created`);
  for (const a of ctx.plan.animations) {
    const id = ctx.animations[a.name]!;
    await ctx.editor.call('set_property_values', { propertyValues: { [id]: { [await propertyKey(ctx, id, 'duration')]: a.durationFrames, [await propertyKey(ctx, id, 'loop')]: LOOP_INDEX[a.loop], [await propertyKey(ctx, id, 'fps')]: 60 } } });
    const add = [];
    for (const key of a.keys) {
      const objectId = ctx.ids.get(`${key.target}:${key.door}`)!;
      add.push({ objectId, propertyKey: await propertyKey(ctx, objectId, key.property), frame: key.frame, value: key.value, interpolationType: key.interpolation, ...(key.interpolation === 'cubic' ? { cubicParams: { x1: 0.42, y1: 0, x2: 0.2, y2: 1 } } : {}) });
    }
    await ctx.editor.call('animation_editor', { command: 'modifyKeyFrames', data: { modifyKeyFrames: { animationId: id, add } } });
  }
}

/** queryStateMachine emits state ids on transitions; resolve them to names, with the special states as "Any State" / "Entry State". */
function transitionsOf(layer: any): Array<{ id: string; from: string; to: string; conditions: number }> {
  const names = new Map<string, string>();
  for (const s of layer.states ?? []) names.set(s.id, s.type === 'any' ? 'Any State' : s.type === 'entry' ? 'Entry State' : s.type === 'exit' ? 'Exit State' : String(s.stateName ?? s.name ?? ''));
  return (layer.transitions ?? []).map((t: any) => ({ id: t.id, from: names.get(t.fromStateId) ?? '', to: names.get(t.toStateId) ?? '', conditions: (t.conditions ?? []).length }));
}

async function stateMachine(ctx: Ctx): Promise<void> {
  const machines = await ctx.editor.call<{ stateMachines: Array<{ id: string; name: string; layers: Array<{ id: string; name: string }> }> }>('animation_editor', { command: 'listStateMachines', data: { listStateMachines: {} } });
  const machine = machines.stateMachines[0];
  if (!machine) throw new Error('the artboard has no default state machine');
  ctx.stateMachineId = machine.id; ctx.stateMachineName = machine.name;
  const stray = machine.layers.filter(l => /^Layer \d+$/.test(l.name) && !ctx.plan.layers.some(p => p.name === l.name));
  if (stray.length) await ctx.editor.call('delete_objects', { objectIds: stray.map(l => l.id) }); // the default layer's Entry already plays the renamed default timeline; two Ambient players is one too many
  const have = new Set(machine.layers.filter(l => !stray.includes(l)).map(l => l.name));
  const missing = ctx.plan.layers.filter(layer => !have.has(layer.name));
  if (missing.length) await ctx.editor.call('animation_editor', { command: 'createStateMachineLayers', data: { createStateMachineLayers: { stateMachineId: machine.id, layers: missing.map(layer => ({ name: layer.name, states: layer.states.map((s, i) => ({ name: s.name, x: 120 + i * 240, y: 140, ...(s.animation ? { linearAnimationName: s.animation } : {}) })), otherTransitions: layer.transitions.map(t => ({ from: t.from, to: t.to })) })) } } });
  const full = await ctx.editor.call<any>('animation_editor', { command: 'queryStateMachine', data: { queryStateMachine: { stateMachineId: machine.id } } });
  writeFileSync(join(resolve(repoRoot, 'scenes/rive/lobby'), 'state-machine.json'), JSON.stringify(full, null, 1));
  const conditions: Array<{ id: string; conditions: any[] }> = [];
  for (const layer of ctx.plan.layers) {
    const live = (full.layers as any[]).find(l => l.layerName === layer.name);
    if (!live) throw new Error(`layer ${layer.name} missing after creation`);
    const liveTransitions = transitionsOf(live);
    for (const t of layer.transitions) {
      if (!t.when) continue;
      const from = t.from.replace(/[{}]/g, '');
      const liveT = liveTransitions.find(x => x.from === from && x.to === t.to);
      if (!liveT) throw new Error(`transition ${t.from} → ${t.to} missing in layer ${layer.name}; have ${JSON.stringify(liveTransitions)}`);
      if (liveT.conditions > 0) continue; // already wired on a previous run
      const propertyId = ctx.vm.props[t.when.property]!;
      conditions.push({ id: liveT.id, conditions: [t.when.equals === undefined ? { leftComparator: { viewModelPropertyId: propertyId } } : { leftComparator: { viewModelPropertyId: propertyId }, comparationOperation: 'equal', rightComparator: { valueType: 'constantValueType', value: t.when.equals } }] });
    }
  }
  if (conditions.length) await ctx.editor.call('animation_editor', { command: 'createConditions', data: { createConditions: { transitions: conditions } } });
  const existingListeners = new Set((full.listeners as any[]).map(l => l.name));
  const listeners = ctx.plan.doors.flatMap(door => [
    { name: `hover_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['enter'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: door.id }] },
    { name: `leave_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['exit'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: 'none' }] },
    { name: `click_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['click'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props[`open${TITLE[door.id]}`] }] },
  ]).filter(l => !existingListeners.has(l.name));
  if (listeners.length) await ctx.editor.call('create_listeners', { stateMachineId: machine.id, listeners });
}

/** Rebuild the authoring context from an artboard that already has its scene, hinges, hit shapes, view model and animations. */
async function resumeContext(editor: RiveEditor, plan: LobbyPlan, artboardId: string): Promise<Ctx> {
  const ctx: Ctx = { editor, plan, artboardId, ids: new Map(), keys: new Map(), vm: { id: '', props: {} }, animations: {}, stateMachineId: '', stateMachineName: '' };
  for (const door of plan.doors) {
    ctx.ids.set(`hinge:${door.id}`, await findId(ctx, `hinge_${door.id}`)); ctx.ids.set(`leaf:${door.id}`, await findId(ctx, door.leafId));
    ctx.ids.set(`light:${door.id}`, await findId(ctx, LIGHT_ID[door.id])); ctx.ids.set(`hit:${door.id}`, await findId(ctx, `hit_${door.id}`));
  }
  const listed = await editor.call<{ viewModels: Array<{ id: string; name: string; properties?: Array<{ id: string; name: string }>; viewModelProperties?: Array<{ id: string; name: string }> }> }>('viewmodel_editor', { command: 'listViewModels', data: { listViewModels: {} } });
  const vm = listed.viewModels.find(v => v.name === plan.viewModel.name);
  if (!vm) throw new Error('view model not found; run without --resume');
  for (const p of vm.properties ?? vm.viewModelProperties ?? []) ctx.vm.props[p.name] = p.id;
  ctx.vm.id = vm.id;
  const anims = await editor.call<{ linearAnimations: Array<{ id: string; name: string }> }>('animation_editor', { command: 'listLinearAnimations', data: { listLinearAnimations: {} } });
  for (const a of anims.linearAnimations) ctx.animations[a.name] = a.id;
  return ctx;
}

/** Copy an export made from the editor UI (File → Export → For Runtime) into place and refresh the manifest. The MCP's own export omits MCP-created artboards. */
export function ingestLobbyExport(rivPath: string): void {
  const outDir = resolve(repoRoot, 'scenes/rive/lobby');
  const manifestPath = join(outDir, 'rive-manifest.json');
  if (!existsSync(manifestPath)) throw new Error('author the lobby first; rive-manifest.json is missing');
  const bytes = readFileSync(rivPath);
  if (bytes.subarray(0, 4).toString() !== 'RIVE') throw new Error(`${rivPath} is not a RIVE file`);
  const finalPath = join(outDir, 'lobby.riv');
  if (existsSync(finalPath)) renameSync(finalPath, join(outDir, 'lobby.previous.riv'));
  writeFileSync(finalPath, bytes);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest, { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, exportedBy: 'editor-ui', exportedFrom: rivPath, ingestedAt: new Date().toISOString() });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`ingested ${rivPath} → ${finalPath} (${bytes.length} bytes); run npm run rive:verify`);
}

export async function authorLobby(mode: 'build' | 'replace' | 'resume' = 'build'): Promise<void> {
  const refinedDir = resolve(repoRoot, 'scenes/refined/lobby');
  const outDir = resolve(repoRoot, 'scenes/rive/lobby'); mkdirSync(outDir, { recursive: true });
  const log: LogEntry[] = [];
  const editor = new RiveEditor(undefined, entry => { log.push(entry); writeFileSync(join(outDir, 'authoring-log.json'), JSON.stringify(log, null, 1)); });
  const server = await editor.initialize();
  const session = await editor.call<{ activeFileId: number; activeFileName: string; openTabs: Array<{ url: string; isActive: boolean }> }>('session_info');
  if (!session.activeFileId) throw new Error('No file is open in Rive Early Access');
  console.log(`editor ${server.name} ${server.version} · file "${session.activeFileName}" (${session.activeFileId})`);
  const manifest = JSON.parse(readFileSync(join(refinedDir, 'manifest.json'), 'utf8')) as RefinedManifest;
  const plan = planLobby(manifest);
  const boards = await editor.call<{ artboards: Array<{ id: string; name: string }> }>('list_artboards');
  const existing = boards.artboards.find(b => b.name === plan.artboard);
  let ctx: Ctx;
  if (mode === 'resume') {
    if (!existing) throw new Error(`Artboard ${plan.artboard} does not exist; nothing to resume`);
    await editor.call('open_file_editor', { command: 'focusArtboard', data: { focusArtboard: { artboardId: existing.id, fitToViewport: true } } });
    ctx = await resumeContext(editor, plan, existing.id);
  } else {
    if (existing && mode !== 'replace') throw new Error(`Artboard ${plan.artboard} already exists; pass --replace to delete and rebuild it, or --resume to finish wiring it`);
    if (existing) await editor.call('delete_objects', { objectIds: [existing.id] });
    const created = await editor.call<{ artboards: Array<{ id: string; name: string }> }>('open_file_editor', { command: 'createArtboard', data: { createArtboard: [{ name: plan.artboard, width: plan.width, height: plan.height }] } });
    const artboardId = created.artboards[0]!.id;
    await editor.call('open_file_editor', { command: 'focusArtboard', data: { focusArtboard: { artboardId, fitToViewport: true } } });
    ctx = { editor, plan, artboardId, ids: new Map(), keys: new Map(), vm: { id: '', props: {} }, animations: {}, stateMachineId: '', stateMachineName: '' };
    const t = Date.now();
    const sceneAsset = await editor.uploadSvg(join(refinedDir, plan.scene.file), 'lobby-scene');
    await editor.call('assets_tool', { command: 'addSvgInstance', data: { addSvgInstance: { assetId: sceneAsset, name: plan.scene.nodeName, parentId: artboardId, x: 0, y: 0 } } });
    console.log(`scene imported in ${Date.now() - t} ms`);
    for (const door of plan.doors) await hinge(ctx, door);
    await hitShapes(ctx);
    await viewModel(ctx);
    await animations(ctx);
  }
  await stateMachine(ctx);
  await editor.capture(plan.artboard, join(outDir, 'capture.png'));
  const exported = await editor.exportRiv(outDir);
  const finalPath = join(outDir, 'lobby.riv');
  if (exported.path !== finalPath) { if (existsSync(finalPath)) renameSync(finalPath, join(outDir, 'lobby.previous.riv')); renameSync(exported.path, finalPath); }
  const bytes = readFileSync(finalPath);
  writeFileSync(join(outDir, 'rive-manifest.json'), JSON.stringify({
    room: 'lobby', file: 'lobby.riv', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    artboard: plan.artboard, stateMachine: ctx.stateMachineName, viewModel: plan.viewModel.name, enum: { [plan.enum.name]: plan.enum.values },
    inputs: Object.fromEntries(plan.viewModel.properties.map(p => [p.name, p.type])), animations: plan.animations.map(a => a.name),
    doors: plan.doors, editor: { fileId: session.activeFileId, url: session.openTabs.find(t => t.isActive)?.url ?? '' }, authoredAt: new Date().toISOString(),
    exportedBy: 'mcp', exportNote: 'The editor MCP export omits MCP-created artboards (probed 2026-09-15). Export from the editor UI and ingest with --riv <path>.',
  }, null, 2) + '\n');
  console.log(`exported ${finalPath} (${bytes.length} bytes), state machine "${ctx.stateMachineName}", ${log.length} editor calls`);
  console.log('NOTE: the MCP export omits MCP-created artboards; export from the editor UI (File → Export → For Runtime) and run: npm run rive:author -- --room lobby --riv <path>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rivIndex = process.argv.indexOf('--riv');
  if (rivIndex > 0) ingestLobbyExport(resolve(process.argv[rivIndex + 1]!));
  else await authorLobby(process.argv.includes('--resume') ? 'resume' : process.argv.includes('--replace') ? 'replace' : 'build');
}

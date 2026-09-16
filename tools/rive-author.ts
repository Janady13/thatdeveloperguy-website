/**
 * Authors one room artboard in the open Rive Early Access file from the v3 vector master and exports it through the official CLI.
 *   npm run rive:author -- --room lobby [--replace | --resume]
 * Every editor call is logged to creative-source/rive/<room>/authoring-log.json.
 *
 * Editor facts this relies on (probed 2026-09-15, editor MCP 0.6): property keys are short names (x=13, y=14, r=15, sx=16, sy=17,
 * opacity=18; animation fps=56, duration=57 in frames, loop=59 enum oneShot|loop|pingPong); createLinearAnimations.duration is in
 * seconds; reparenting keeps world position; group_editor cannot wrap a plain Node, so hinges are empty groups + reparent; a layer
 * needs an Entry transition or it never enters its first state; deleting an artboard orphans its children, so old artboards are renamed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, ROOM_IDS, type RoomId } from './kits.ts';
import { RiveEditor, type LogEntry } from './rive-mcp.ts';
import { exportArtboardViaCli } from './rive-export.ts';
import { planRoom, type RoomPlan } from './rive-plan.ts';
import type { RoomManifest } from './import-rooms.ts';

const KEY_ALIAS: Record<string, string[]> = { scaleX: ['sx'], scaleY: ['sy'], rotation: ['r'], x: ['x'], y: ['y'], opacity: ['opacity'], loop: ['loop'], duration: ['duration'], fps: ['fps'] };
const LOOP_INDEX = { oneShot: 0, loop: 1, pingPong: 2 } as const;

interface Ctx { editor: RiveEditor; plan: RoomPlan; artboardId: string; ids: Map<string, string>; keys: Map<string, Record<string, number>>; vm: { id: string; props: Record<string, string> }; animations: Record<string, string>; stateMachineId: string; stateMachineName: string }

async function propertyKey(ctx: Ctx, objectId: string, name: string): Promise<number> {
  if (!ctx.keys.has(objectId)) { const result = await ctx.editor.call<{ properties: Record<string, Record<string, number>> }>('query_property_keys', { objectIds: [objectId] }); ctx.keys.set(objectId, result.properties[objectId] ?? {}); }
  const table = ctx.keys.get(objectId)!;
  for (const alias of KEY_ALIAS[name] ?? [name.toLowerCase()]) if (alias in table) return table[alias]!;
  throw new Error(`property ${name} not found on ${objectId}: ${Object.keys(table).join(', ')}`);
}
async function findId(ctx: Ctx, name: string): Promise<string> {
  const result = await ctx.editor.call<{ objects: Array<{ id: string; name: string; parentId?: string }> }>('find_objects', { name });
  const exact = result.objects.find(o => o.name === name);
  if (!exact) throw new Error(`object ${name} not found in artboard ${ctx.plan.artboard}`);
  return exact.id;
}
/** Resolve a plan target: a package art id, or `hinge:<door>` for a door's hinge group. */
function targetId(ctx: Ctx, target: string): string {
  const id = ctx.ids.get(target);
  if (!id) throw new Error(`target ${target} not resolved`);
  return id;
}

/** Hinge = empty group at the leaf's pivot; the leaf is reparented in (world position kept) and the group takes the leaf's slot. */
async function hinge(ctx: Ctx, door: RoomPlan['doors'][number]): Promise<void> {
  const leafId = await findId(ctx, door.leafId);
  const found = await ctx.editor.call<{ objects: Array<{ id: string; parentId: string }> }>('find_objects', { name: door.leafId });
  const parentId = found.objects.find(o => o.id === leafId)!.parentId;
  const group = await ctx.editor.call<{ group: { id: string } }>('group_editor', { name: `hinge_${door.id}`, parentId });
  const hingeId = group.group.id;
  await ctx.editor.call('set_property_values', { propertyValues: { [hingeId]: { [await propertyKey(ctx, hingeId, 'x')]: door.hinge[0], [await propertyKey(ctx, hingeId, 'y')]: door.hinge[1] } } });
  await ctx.editor.call('reparent_objects', { operations: [{ objectId: leafId, newParentId: hingeId, position: 'start' }] });
  await ctx.editor.call('reparent_objects', { operations: [{ objectId: hingeId, newParentId: parentId, position: 'start' }] });
  ctx.ids.set(`hinge:${door.id}`, hingeId); ctx.ids.set(door.leafId, leafId);
  if (door.accessLightId) ctx.ids.set(door.accessLightId, await findId(ctx, door.accessLightId));
}

async function resolveAmbientTargets(ctx: Ctx): Promise<void> {
  const wanted = new Set<string>();
  for (const a of ctx.plan.animations) for (const k of a.keys) if (!k.target.startsWith('hinge:') && !ctx.ids.has(k.target)) wanted.add(k.target);
  for (const name of wanted) { try { ctx.ids.set(name, await findId(ctx, name)); } catch { console.warn(`ambient target ${name} not in artboard; its keys are skipped`); } }
}

async function hitShapes(ctx: Ctx): Promise<void> {
  const shapes = ctx.plan.hotspots.map(h => ({ primitive: 'rectangle', name: `hit_${h.id}`, parentId: ctx.artboardId, x: h.hit.x + h.hit.width / 2, y: h.hit.y + h.hit.height / 2, width: h.hit.width, height: h.hit.height, paints: [{ paintType: 'fill', color: '#00000000' }] }));
  await ctx.editor.call('path_editor', { command: 'createParametricShapes', data: { createParametricShapes: { shapes } } });
  for (const h of ctx.plan.hotspots) ctx.ids.set(`hit:${h.id}`, await findId(ctx, `hit_${h.id}`));
}

async function viewModel(ctx: Ctx): Promise<void> {
  const enums = await ctx.editor.call<{ dataEnums?: Array<{ id: string; name: string }>; enums?: Array<{ id: string; name: string }> }>('viewmodel_editor', { command: 'listDataEnums', data: { listDataEnums: {} } });
  if (!(enums.dataEnums ?? enums.enums ?? []).some(e => e.name === ctx.plan.enum.name)) await ctx.editor.call('viewmodel_editor', { command: 'createDataEnums', data: { createDataEnums: { dataEnums: [{ name: ctx.plan.enum.name, values: [...ctx.plan.enum.values] }] } } });
  const vmName = `${ctx.plan.artboard}Room`;
  const listed0 = await ctx.editor.call<{ viewModels: Array<{ id: string; name: string; properties?: Array<{ id: string; name: string }>; viewModelProperties?: Array<{ id: string; name: string }> }> }>('viewmodel_editor', { command: 'listViewModels', data: { listViewModels: {} } });
  if (!listed0.viewModels.some(v => v.name === vmName)) await ctx.editor.call('viewmodel_editor', { command: 'createViewModels', data: { createViewModels: { viewModels: [{ name: vmName, viewModelProperties: ctx.plan.viewModel.properties.map(p => p.type === 'enum' ? { name: p.name, propertyType: 'enum', enumName: ctx.plan.enum.name } : { name: p.name, propertyType: p.type }) }] } } });
  const listed = await ctx.editor.call<typeof listed0>('viewmodel_editor', { command: 'listViewModels', data: { listViewModels: {} } });
  const vm = listed.viewModels.find(v => v.name === vmName);
  if (!vm) throw new Error(`view model ${vmName} not listed after creation`);
  const props: Record<string, string> = {};
  for (const p of vm.properties ?? vm.viewModelProperties ?? []) props[p.name] = p.id;
  for (const p of ctx.plan.viewModel.properties) if (!props[p.name]) throw new Error(`view-model property ${p.name} missing`);
  ctx.vm = { id: vm.id, props };
  await ctx.editor.call('viewmodel_editor', { command: 'bindViewModelToArtboard', data: { bindViewModelToArtboard: { artboardId: ctx.artboardId, viewModelId: vm.id } } });
}

async function animations(ctx: Ctx): Promise<void> {
  const existing = await ctx.editor.call<{ linearAnimations: Array<{ id: string; name: string }> }>('animation_editor', { command: 'listLinearAnimations', data: { listLinearAnimations: {} } });
  for (const a of existing.linearAnimations) if (ctx.plan.animations.some(p => p.name === a.name)) ctx.animations[a.name] = a.id;
  const pristine = existing.linearAnimations.find(a => /^Timeline( \d+)?$/.test(a.name));
  const todo = ctx.plan.animations.filter(a => !ctx.animations[a.name]);
  if (pristine && todo.length) { await ctx.editor.call('animation_editor', { command: 'renameAnimations', data: { renameAnimations: { animations: [{ animationId: pristine.id, name: todo[0]!.name }] } } }); ctx.animations[todo[0]!.name] = pristine.id; }
  const toCreate = todo.filter(a => !ctx.animations[a.name]);
  if (toCreate.length) { const created = await ctx.editor.call<{ animations: Array<{ id: string; name: string }> }>('animation_editor', { command: 'createLinearAnimations', data: { createLinearAnimations: { linearAnimations: toCreate.map(a => ({ name: a.name, duration: 1 })) } } }); for (const a of created.animations) ctx.animations[a.name] = a.id; }
  for (const a of ctx.plan.animations) {
    const id = ctx.animations[a.name]; if (!id) throw new Error(`animation ${a.name} was not created`);
    if (!todo.some(t => t.name === a.name)) continue; // already keyed on a previous run
    await ctx.editor.call('set_property_values', { propertyValues: { [id]: { [await propertyKey(ctx, id, 'duration')]: a.durationFrames, [await propertyKey(ctx, id, 'loop')]: LOOP_INDEX[a.loop], [await propertyKey(ctx, id, 'fps')]: 60 } } });
    const add = [];
    for (const key of a.keys) {
      if (!ctx.ids.has(key.target)) continue;
      const objectId = targetId(ctx, key.target);
      add.push({ objectId, propertyKey: await propertyKey(ctx, objectId, key.property), frame: key.frame, value: key.value, interpolationType: key.interpolation, ...(key.interpolation === 'cubic' ? { cubicParams: { x1: 0.42, y1: 0, x2: 0.2, y2: 1 } } : {}) });
    }
    if (add.length) await ctx.editor.call('animation_editor', { command: 'modifyKeyFrames', data: { modifyKeyFrames: { animationId: id, add } } });
  }
}

function transitionsOf(layer: any): Array<{ id: string; from: string; to: string; conditions: number }> {
  const names = new Map<string, string>();
  for (const s of layer.states ?? []) names.set(s.id, s.type === 'any' ? 'Any State' : s.type === 'entry' ? 'Entry State' : s.type === 'exit' ? 'Exit State' : String(s.stateName ?? s.name ?? ''));
  return (layer.transitions ?? []).map((t: any) => ({ id: t.id, from: names.get(t.fromStateId) ?? '', to: names.get(t.toStateId) ?? '', conditions: (t.conditions ?? []).length }));
}

async function stateMachine(ctx: Ctx, outDir: string): Promise<void> {
  const machines = await ctx.editor.call<{ stateMachines: Array<{ id: string; name: string; layers: Array<{ id: string; name: string }> }> }>('animation_editor', { command: 'listStateMachines', data: { listStateMachines: {} } });
  const machine = machines.stateMachines[0]; if (!machine) throw new Error('the artboard has no default state machine');
  ctx.stateMachineId = machine.id; ctx.stateMachineName = machine.name;
  const stray = machine.layers.filter(l => /^Layer \d+$/.test(l.name) && !ctx.plan.layers.some(p => p.name === l.name));
  if (stray.length) await ctx.editor.call('delete_objects', { objectIds: stray.map(l => l.id) });
  const have = new Set(machine.layers.filter(l => !stray.includes(l)).map(l => l.name));
  const missing = ctx.plan.layers.filter(layer => !have.has(layer.name));
  if (missing.length) await ctx.editor.call('animation_editor', { command: 'createStateMachineLayers', data: { createStateMachineLayers: { stateMachineId: machine.id, layers: missing.map(layer => ({ name: layer.name, states: layer.states.map((s, i) => ({ name: s.name, x: 120 + i * 240, y: 140, ...(s.animation ? { linearAnimationName: s.animation } : {}) })), otherTransitions: layer.transitions.map(t => ({ from: t.from, to: t.to })) })) } } });
  let full = await ctx.editor.call<any>('animation_editor', { command: 'queryStateMachine', data: { queryStateMachine: { stateMachineId: machine.id } } });
  const missingTransitions: Array<{ id: string; transitions: Array<{ to: string }> }> = [];
  for (const layer of ctx.plan.layers) {
    const live = (full.layers as any[]).find(l => l.layerName === layer.name); if (!live) continue;
    const stateId = (name: string) => { const n = name.replace(/[{}]/g, ''); return (live.states as any[]).find(st => (n === 'Entry State' && st.type === 'entry') || (n === 'Any State' && st.type === 'any') || (!['entry', 'any', 'exit'].includes(st.type) && (st.stateName ?? st.name) === n))?.id as string | undefined; };
    const have = transitionsOf(live);
    for (const t of layer.transitions) { const from = t.from.replace(/[{}]/g, ''); if (have.some(x => x.from === from && x.to === t.to)) continue; const fromId = stateId(t.from), toId = stateId(t.to); if (!fromId || !toId) throw new Error(`cannot resolve ${t.from} → ${t.to} in ${layer.name}`); missingTransitions.push({ id: fromId, transitions: [{ to: toId }] }); }
  }
  if (missingTransitions.length) { await ctx.editor.call('animation_editor', { command: 'createTransitions', data: { createTransitions: { states: missingTransitions } } }); full = await ctx.editor.call<any>('animation_editor', { command: 'queryStateMachine', data: { queryStateMachine: { stateMachineId: machine.id } } }); }
  writeFileSync(join(outDir, 'state-machine.json'), JSON.stringify(full, null, 1));
  const conditions: Array<{ id: string; conditions: any[] }> = [];
  for (const layer of ctx.plan.layers) {
    const live = (full.layers as any[]).find(l => l.layerName === layer.name); if (!live) throw new Error(`layer ${layer.name} missing after creation`);
    const liveTransitions = transitionsOf(live);
    for (const t of layer.transitions) {
      if (!t.when) continue;
      const liveT = liveTransitions.find(x => x.from === t.from.replace(/[{}]/g, '') && x.to === t.to);
      if (!liveT) throw new Error(`transition ${t.from} → ${t.to} missing in layer ${layer.name}`);
      if (liveT.conditions > 0) continue;
      const propertyId = ctx.vm.props[t.when.property]!;
      conditions.push({ id: liveT.id, conditions: [t.when.equals === undefined ? { leftComparator: { viewModelPropertyId: propertyId } } : { leftComparator: { viewModelPropertyId: propertyId }, comparationOperation: 'equal', rightComparator: { valueType: 'constantValueType', value: t.when.equals } }] });
    }
  }
  if (conditions.length) await ctx.editor.call('animation_editor', { command: 'createConditions', data: { createConditions: { transitions: conditions } } });
  const existingListeners = new Set((full.listeners as any[]).map(l => l.name));
  const listeners = ctx.plan.hotspots.flatMap(h => [
    { name: `hover_${h.id}`, targetId: ctx.ids.get(`hit:${h.id}`), listenerTypes: ['enter'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: h.id }] },
    { name: `leave_${h.id}`, targetId: ctx.ids.get(`hit:${h.id}`), listenerTypes: ['exit'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: 'none' }] },
    ...(h.trigger ? [{ name: `click_${h.id}`, targetId: ctx.ids.get(`hit:${h.id}`), listenerTypes: ['click'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props[h.trigger] }] }] : []),
  ]).filter(l => !existingListeners.has(l.name));
  if (listeners.length) await ctx.editor.call('create_listeners', { stateMachineId: machine.id, listeners });
}

async function resumeContext(editor: RiveEditor, plan: RoomPlan, artboardId: string): Promise<Ctx> {
  const ctx: Ctx = { editor, plan, artboardId, ids: new Map(), keys: new Map(), vm: { id: '', props: {} }, animations: {}, stateMachineId: '', stateMachineName: '' };
  for (const d of plan.doors) { ctx.ids.set(`hinge:${d.id}`, await findId(ctx, `hinge_${d.id}`)); ctx.ids.set(d.leafId, await findId(ctx, d.leafId)); if (d.accessLightId) ctx.ids.set(d.accessLightId, await findId(ctx, d.accessLightId)); }
  for (const h of plan.hotspots) ctx.ids.set(`hit:${h.id}`, await findId(ctx, `hit_${h.id}`));
  await resolveAmbientTargets(ctx);
  return ctx;
}

export async function authorRoom(room: RoomId, mode: 'build' | 'replace' | 'resume' = 'build'): Promise<void> {
  const refinedDir = resolve(repoRoot, 'creative-source/refined', room);
  const outDir = resolve(repoRoot, 'creative-source/rive', room); mkdirSync(outDir, { recursive: true });
  const log: LogEntry[] = [];
  const editor = new RiveEditor(undefined, entry => { log.push(entry); writeFileSync(join(outDir, 'authoring-log.json'), JSON.stringify(log, null, 1)); });
  const server = await editor.initialize();
  const session = await editor.call<{ activeFileId: number; activeFileName: string; openTabs: Array<{ url: string; isActive: boolean }> }>('session_info');
  if (!session.activeFileId) throw new Error('No file is open in Rive Early Access');
  console.log(`editor ${server.name} ${server.version} · file "${session.activeFileName}" (${session.activeFileId})`);
  const manifest = JSON.parse(readFileSync(join(refinedDir, 'manifest.json'), 'utf8')) as RoomManifest;
  const plan = planRoom(manifest);
  const boards = await editor.call<{ artboards: Array<{ id: string; name: string }> }>('list_artboards');
  const existing = boards.artboards.find(b => b.name === plan.artboard);
  let ctx: Ctx;
  if (mode === 'resume') {
    if (!existing) throw new Error(`Artboard ${plan.artboard} does not exist; nothing to resume`);
    await editor.call('open_file_editor', { command: 'focusArtboard', data: { focusArtboard: { artboardId: existing.id, fitToViewport: true } } });
    ctx = await resumeContext(editor, plan, existing.id);
    if (!ctx.vm.id) await viewModel(ctx);
  } else {
    if (existing && mode !== 'replace') throw new Error(`Artboard ${plan.artboard} already exists; pass --replace to retire it and rebuild, or --resume`);
    if (existing) await editor.call('open_file_editor', { command: 'renameArtboard', data: { renameArtboard: [{ artboardId: existing.id, newName: `_retired_${plan.artboard}_${Date.now()}` }] } }); // deleting via MCP orphans children; retire instead
    const created = await editor.call<{ artboards: Array<{ id: string; name: string }> }>('open_file_editor', { command: 'createArtboard', data: { createArtboard: [{ name: plan.artboard, width: plan.width, height: plan.height }] } });
    const artboardId = created.artboards[0]!.id;
    await editor.call('open_file_editor', { command: 'focusArtboard', data: { focusArtboard: { artboardId, fitToViewport: true } } });
    ctx = { editor, plan, artboardId, ids: new Map(), keys: new Map(), vm: { id: '', props: {} }, animations: {}, stateMachineId: '', stateMachineName: '' };
    const t = Date.now();
    const sceneAsset = await editor.uploadSvg(join(refinedDir, plan.scene.file), `${room}-scene`);
    await editor.call('assets_tool', { command: 'addSvgInstance', data: { addSvgInstance: { assetId: sceneAsset, name: plan.scene.nodeName, parentId: artboardId, x: 0, y: 0 } } });
    console.log(`scene imported in ${Date.now() - t} ms`);
    for (const door of plan.doors) await hinge(ctx, door);
    await resolveAmbientTargets(ctx);
    await hitShapes(ctx);
    await viewModel(ctx);
    await animations(ctx);
  }
  await stateMachine(ctx, outDir);
  await editor.capture(plan.artboard, join(outDir, 'capture.png'));
  const exported = await exportArtboardViaCli(editor, plan.artboard, outDir, room);
  const bytes = readFileSync(exported.riv);
  writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(exported.inventory, null, 2) + '\n');
  writeFileSync(join(outDir, 'rive-manifest.json'), JSON.stringify({
    room, file: `${room}.riv`, sha256: exported.inventory.sha256, bytes: bytes.length,
    artboard: plan.artboard, stateMachine: ctx.stateMachineName, viewModel: `${plan.artboard}Room`, enum: { [plan.enum.name]: plan.enum.values },
    inputs: Object.fromEntries(plan.viewModel.properties.map(p => [p.name, p.type])), animations: plan.animations.map(a => a.name),
    doors: plan.doors, hotspots: plan.hotspots, floorAnchor: plan.floorAnchor,
    source: manifest.source, editor: { fileId: session.activeFileId, url: session.openTabs.find(t => t.isActive)?.url ?? '' }, authoredAt: new Date().toISOString(),
    exportedBy: 'rive-cli', compiler: exported.compiler, document: { rev: 'document.rev', bytes: exported.rev.bytes, sha256: exported.rev.sha256 },
  }, null, 2) + '\n');
  console.log(`built ${exported.riv} (${bytes.length} bytes, sha ${exported.inventory.sha256.slice(0, 12)}…) with ${exported.compiler}; artboards ${exported.inventory.artboards.map(a => a.name).join(', ')}; ${log.length} editor calls`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const room = (index > 0 ? process.argv[index + 1] : 'lobby') as RoomId;
  if (!ROOM_IDS.includes(room)) throw new Error(`unknown room ${room}`);
  await authorRoom(room, process.argv.includes('--resume') ? 'resume' : process.argv.includes('--replace') ? 'replace' : 'build');
}

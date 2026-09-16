/**
 * Runtime export that actually contains MCP-authored artboards.
 * The editor's `export_file(riv)` omits artboards created through the MCP (probed 2026-09-15), but its `.rev` export is the
 * full document. So: .rev → editor's own sandbox tmp (the only place it may write; we may read) → official CLI
 * `create --from-rev` → keep one artboard → CLI `--once` → .riv → inventory with the pinned runtime.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { repoRoot } from './kits.ts';
import type { RiveEditor } from './rive-mcp.ts';
import { inventory, type RivInventory } from './riv-inventory.ts';

export const EDITOR_CONTAINER_TMP = join(homedir(), 'Library/Containers/app.rive.ea-editor/Data/tmp');
export const RIVE_CLI = resolve(repoRoot, '.tools/rive/rive');

function cli(args: string[], cwd: string, timeout = 600_000): string {
  if (!existsSync(RIVE_CLI)) throw new Error('official Rive CLI missing; run node scripts/install-rive-cli.mjs');
  const run = spawnSync(RIVE_CLI, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
  if (run.error || run.status !== 0) throw new Error(`rive ${args.join(' ')}: ${run.stderr || run.stdout}`);
  return run.stdout;
}

/** Ask the editor for a .rev of the open document, written where it is allowed to write. */
export async function exportRev(editor: RiveEditor, outPath: string): Promise<{ bytes: number; sha256: string }> {
  mkdirSync(EDITOR_CONTAINER_TMP, { recursive: true });
  for (const stale of readdirSync(EDITOR_CONTAINER_TMP)) if (/\.(rev|riv)$/.test(stale)) rmSync(join(EDITOR_CONTAINER_TMP, stale), { force: true }); // the editor never overwrites
  const result = await editor.call<{ path: string; bytes: number }>('export_file', { format: 'rev', destination: EDITOR_CONTAINER_TMP, embed_assets: false });
  copyFileSync(result.path, outPath);
  rmSync(result.path, { force: true });
  const bytes = readFileSync(outPath);
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Keep exactly one top-level artboard in the converted RML; everything else at top level (enums, view models, assets) stays. */
export function keepArtboard(rml: string, name: string): string {
  const starts = [...rml.matchAll(/\n    <Artboard [^>]*>/g)].map(m => ({ index: m.index!, name: / name="([^"]*)"/.exec(m[0])?.[1] ?? '' }));
  const ends = [...rml.matchAll(/\n    <\/Artboard>/g)].map(m => m.index! + m[0].length);
  if (starts.length !== ends.length) throw new Error('unbalanced <Artboard> elements in RML');
  if (!starts.some(s => s.name === name)) throw new Error(`artboard ${name} not in RML (have ${starts.map(s => s.name).join(', ')})`);
  let out = rml;
  for (let i = starts.length - 1; i >= 0; i--) if (starts[i]!.name !== name) out = out.slice(0, starts[i]!.index) + out.slice(ends[i]!);
  return out;
}

export interface CliExport { riv: string; rev: { path: string; bytes: number; sha256: string }; inventory: RivInventory; compiler: string; projectDir: string }

export async function exportArtboardViaCli(editor: RiveEditor, artboard: string, outDir: string, slug: string): Promise<CliExport> {
  mkdirSync(outDir, { recursive: true });
  const revPath = join(outDir, 'document.rev');
  const rev = await exportRev(editor, revPath);
  const projectDir = resolve(repoRoot, '.tools/rive-projects', slug);
  rmSync(projectDir, { recursive: true, force: true });
  cli(['create', projectDir, `--from-rev=${revPath}`], repoRoot);
  const rmlPath = join(projectDir, 'scene.rml');
  writeFileSync(rmlPath, keepArtboard(readFileSync(rmlPath, 'utf8'), artboard));
  writeFileSync(join(projectDir, 'rive.yaml'), `name: ${slug}\nmain: "${artboard}"\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n`);
  const compiler = cli(['--version'], repoRoot).trim();
  const report = JSON.parse(cli([projectDir, '--once', '--format=json'], repoRoot));
  if (!report.success) throw new Error(`compile failed: ${JSON.stringify(report.errors)}`);
  const built = join(projectDir, 'build', `${slug}.riv`);
  const riv = join(outDir, `${slug}.riv`);
  copyFileSync(built, riv);
  const inv = await inventory(riv);
  if (!inv.artboards.some(a => a.name === artboard)) throw new Error(`built file lacks artboard ${artboard}`);
  return { riv, rev: { path: revPath, ...rev }, inventory: inv, compiler, projectDir };
}

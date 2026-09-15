# Lobby Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `npm run dev` lobby for thatdeveloperguy.com: the kit's traced lobby refined to clean vector, authored as a Rive artboard through the editor MCP, exported to `.riv`, verified headlessly, and played in a React stage where the three doors are real links that open in Rive and navigate.

**Architecture:** Three layers that only meet through files: `tools/` turns the Desktop kit into `scenes/refined/lobby/` (SVG + manifest) and drives the Rive editor over HTTP to produce `scenes/rive/lobby/lobby.riv` + `rive-manifest.json`; `apps/web/` is a Vite/React 19 site whose `SceneStage` plays the `.riv`, overlays real `<a>` hit shapes from the kit's hotspots, and writes view-model properties (`focus`, door triggers). Nothing under `scenes/` is hand-edited.

**Tech Stack:** Node 24.21 (`~/.local/node/node-v24.21.0-darwin-arm64/bin`), TypeScript 7.0.2 via `tsx`, `node --test`, Vite 8.3.0 + React 19.3.0 + react-router 8.3.1, `@rive-app/react-webgl2` 4.34.2, `@rive-app/canvas-advanced` 2.42.1, `@xmldom/xmldom` 0.9.12, `fit-curve` 0.2.0, `polygon-clipping` 0.15.7, `@resvg/resvg-js` 2.6.2, `pixelmatch` 7.2.0, `pngjs` 7.0.0, Playwright 1.63.0, `@axe-core/playwright` 4.13.0.

**Spec:** `docs/superpowers/specs/2026-09-15-thatdeveloperguy-rive-site-design.md`

## Global Constraints

- Node `>=24.19.0 <25`; `.npmrc` has `engine-strict=true`; every command below runs with `export PATH=~/.local/node/node-v24.21.0-darwin-arm64/bin:$PATH`.
- The kits under `~/Desktop/ThatDeveloperGuy/` are **read-only inputs**; never write into them.
- `scenes/refined/**` and `scenes/rive/**` are generated only by `tools/`; commit the generated files.
- Artboard is `1648 × 928`; room coordinates are kit coordinates; artboard name `Lobby`.
- Rive editor MCP: `http://127.0.0.1:9791/mcp`, Rive Early Access must be running with the target file active. `upload_asset` must use a `data:` URI; `export_file` must use `inline_base64: true` (editor is sandboxed).
- Content wording comes from `~/Code/thatdeveloperguy-truth/organization.json` unchanged; government-contracting facts the node lacks are rendered as `owner-to-supply` placeholders, never invented.
- Navigation and copy are HTML; the `.riv` is motion only. Every hotspot is a real `<a>` with `aria-label`, tabbable.
- No new `.md` reports; results are printed to the terminal and written as JSON manifests.
- Commit after every task with the trailer:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01Te9aj6wYECisNq9sKX1qfR`.

---

## File structure (this plan)

| Path | Responsibility |
| --- | --- |
| `package.json`, `.npmrc`, `tsconfig.json`, `.gitignore` | toolchain pins, test runner |
| `scenes/kits.config.json` | absolute kit paths, per-room file names, hotspot/manifest locations |
| `tools/kits.ts` | load `kits.config.json`, resolve a room's kit files, checksum them |
| `tools/svg/model.ts` | `SceneDoc`, `GroupNode`, `PathNode`, `Ring` types |
| `tools/svg/parse.ts` | kit SVG → `SceneDoc` (groups with ids, paths with fill + polygon rings) |
| `tools/svg/geometry.ts` | ring area, corner detection, cubic fitting (`fit-curve`), union (`polygon-clipping`) |
| `tools/svg/refine.ts` | speckle drop → union → curve fit → `RefinedDoc` + stats |
| `tools/svg/serialize.ts` | `RefinedDoc` → compact SVG text; part extraction |
| `tools/svg/diff.ts` | render SVG with resvg, compare to the reference PNG with pixelmatch |
| `tools/refine-vectors.ts` | CLI: `--room lobby` → `scenes/refined/lobby/{scene.svg,parts/*.svg,manifest.json}` |
| `tools/rive-mcp.ts` | `RiveEditor` JSON-RPC client: call, uploadSvg, capture, exportRiv, log |
| `tools/rive-plan.ts` | pure: refined manifest + hotspots → ordered authoring steps |
| `tools/rive-author.ts` | CLI: executes the plan against the editor, writes `scenes/rive/lobby/` |
| `tools/verify-riv.ts` | CLI: loads `.riv` headlessly, asserts artboard/animations/state machine/view model |
| `tools/import-truth.ts` | node `organization.json` → `apps/web/src/truth/projection.json` |
| `apps/web/index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` | app shell + routes |
| `apps/web/src/styles/{tokens,base,layout,stage}.css` | palette, type, stage geometry |
| `apps/web/src/animation/rive/RiveScene.tsx` | plays a room `.riv`, exposes `setFocus`/`fire` |
| `apps/web/src/animation/stage/SceneStage.tsx` | poster + Rive + hit-shape overlay + caption |
| `apps/web/src/rooms/lobby/{hotspots.ts,content.ts,Lobby.tsx}` | the lobby page |
| `apps/web/src/rooms/{it-services,government-solutions,cybersecurity}/Room.tsx` | placeholder rooms (Plan 2 fills them) |
| `apps/web/src/components/{Header,Footer}.tsx` | chrome |
| `scripts/sync-rive-wasm.mjs`, `scripts/sync-scenes.mjs` | copy runtime WASM and scene files into `apps/web/public/` |
| `tools/shots.ts` | headless Chrome fps + screenshots of `/` |
| `tests/unit/*.test.ts`, `tests/browser/lobby.spec.ts`, `playwright.config.ts` | tests |

---

### Task 1: Repository toolchain

**Files:**
- Create: `package.json`, `.npmrc`, `tsconfig.json`, `.gitignore`, `scenes/kits.config.json`, `tools/kits.ts`
- Test: `tests/unit/kits.test.ts`

**Interfaces:**
- Produces: `loadKits(): KitsConfig`, `resolveRoom(room: RoomId): RoomKit` where
  `type RoomId = 'lobby' | 'it-services' | 'government-solutions' | 'cybersecurity'` and
  `interface RoomKit { room: RoomId; dir: string; svg: string; manifest: string; hotspots: string; reference: string }` (absolute paths).

- [ ] **Step 1: Write the toolchain files**

`package.json`:
```json
{
  "name": "thatdeveloperguy-website",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "thatdeveloperguy.com — illustrated Rive site",
  "engines": { "node": ">=24.19.0 <25" },
  "scripts": {
    "dev": "vite --config apps/web/vite.config.ts --host 127.0.0.1 --port 4410",
    "build": "vite build --config apps/web/vite.config.ts",
    "typecheck": "tsc --noEmit",
    "test": "node --test --import tsx tests/unit/*.test.ts",
    "test:browser": "playwright test",
    "refine": "node --import tsx tools/refine-vectors.ts",
    "rive:author": "node --import tsx tools/rive-author.ts",
    "rive:verify": "node --import tsx tools/verify-riv.ts",
    "truth": "node --import tsx tools/import-truth.ts",
    "sync": "node scripts/sync-rive-wasm.mjs && node scripts/sync-scenes.mjs",
    "shots": "node --import tsx tools/shots.ts"
  },
  "dependencies": {
    "@rive-app/react-webgl2": "4.34.2",
    "gsap": "3.15.0",
    "lenis": "1.3.26",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-router": "8.3.1"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.13.0",
    "@playwright/test": "1.63.0",
    "@resvg/resvg-js": "2.6.2",
    "@rive-app/canvas-advanced": "2.42.1",
    "@types/node": "24.13.4",
    "@types/pixelmatch": "5.2.6",
    "@types/pngjs": "6.0.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "@xmldom/xmldom": "0.9.12",
    "fit-curve": "0.2.0",
    "pixelmatch": "7.2.0",
    "pngjs": "7.0.0",
    "polygon-clipping": "0.15.7",
    "tsx": "4.23.13",
    "typescript": "7.0.2",
    "vite": "8.3.0"
  }
}
```

`.npmrc`:
```
engine-strict=true
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"],
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  },
  "include": ["apps/web/src", "tools", "tests", "scripts"]
}
```

`.gitignore`:
```
node_modules/
apps/web/dist/
apps/web/public/scenes/
apps/web/public/animation/
.tools/
test-results/
shots/
*.log
.DS_Store
```

`scenes/kits.config.json`:
```json
{
  "root": "/Users/josephanady/Desktop/ThatDeveloperGuy",
  "canvas": { "width": 1648, "height": 928 },
  "rooms": {
    "lobby": {
      "dir": "TDG_LOBBY_ANIMATION_KIT",
      "svg": "svg/tdg-lobby.rive-import.svg",
      "manifest": "docs/scene-manifest.json",
      "hotspots": "web/hotspots.json",
      "reference": "source/tdg-lobby.reference.png"
    },
    "it-services": {
      "dir": "TDG_IT_SERVICES_ANIMATION_KIT",
      "svg": "svg/tdg-it-services.rive-import.svg",
      "manifest": "docs/scene-manifest.json",
      "hotspots": "web/hotspots.json",
      "reference": "source/tdg-it-services.reference.png"
    },
    "government-solutions": {
      "dir": "TDG_GOVERNMENT_SOLUTIONS_ANIMATION_KIT",
      "svg": "svg/tdg-government-solutions.rive-import.svg",
      "manifest": "docs/scene-manifest.json",
      "hotspots": "web/hotspots.json",
      "reference": "source/tdg-government-solutions.reference.png"
    },
    "cybersecurity": {
      "dir": "TDG_CYBERSECURITY_ANIMATION_KIT",
      "svg": "svg/tdg-cybersecurity.rive-import.svg",
      "manifest": "docs/scene-manifest.json",
      "hotspots": "web/hotspots.json",
      "reference": "source/tdg-cybersecurity.reference.png"
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/kits.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadKits, resolveRoom } from '../../tools/kits.ts';

test('kits config names four rooms on a 1648×928 canvas', () => {
  const kits = loadKits();
  assert.deepEqual(Object.keys(kits.rooms).sort(), ['cybersecurity', 'government-solutions', 'it-services', 'lobby']);
  assert.deepEqual(kits.canvas, { width: 1648, height: 928 });
});

test('resolveRoom returns absolute paths that exist for the lobby', () => {
  const kit = resolveRoom('lobby');
  for (const key of ['svg', 'manifest', 'hotspots', 'reference'] as const) {
    assert.ok(kit[key].startsWith('/'), `${key} must be absolute`);
    assert.ok(existsSync(kit[key]), `${key} missing: ${kit[key]}`);
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/kits.ts'`

- [ ] **Step 4: Write `tools/kits.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RoomId = 'lobby' | 'it-services' | 'government-solutions' | 'cybersecurity';
export interface KitEntry { dir: string; svg: string; manifest: string; hotspots: string; reference: string }
export interface KitsConfig { root: string; canvas: { width: number; height: number }; rooms: Record<RoomId, KitEntry> }
export interface RoomKit { room: RoomId; dir: string; svg: string; manifest: string; hotspots: string; reference: string }

export const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function loadKits(): KitsConfig {
  return JSON.parse(readFileSync(resolve(repoRoot, 'scenes/kits.config.json'), 'utf8')) as KitsConfig;
}

/** Absolute paths for one room's kit files. The kit directory is read-only input. */
export function resolveRoom(room: RoomId, kits: KitsConfig = loadKits()): RoomKit {
  const entry = kits.rooms[room];
  if (!entry) throw new Error(`Unknown room ${room}`);
  const dir = resolve(kits.root, entry.dir);
  return { room, dir, svg: resolve(dir, entry.svg), manifest: resolve(dir, entry.manifest), hotspots: resolve(dir, entry.hotspots), reference: resolve(dir, entry.reference) };
}
```

- [ ] **Step 5: Install and run the test**

Run: `npm install && npm test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .npmrc tsconfig.json .gitignore scenes/kits.config.json tools/kits.ts tests/unit/kits.test.ts
git commit -m "Toolchain, kit config and kit resolver"
```

---

### Task 2: Parse a kit SVG into a scene model

**Files:**
- Create: `tools/svg/model.ts`, `tools/svg/parse.ts`
- Test: `tests/unit/svg-parse.test.ts`, `tests/fixtures/mini-scene.svg`

**Interfaces:**
- Produces:
  ```ts
  export type Point = [number, number];
  export type Ring = Point[];                       // closed polygon; last point ≠ first
  export interface PathNode { kind: 'path'; id: string; fill: string; rings: Ring[] }
  export interface GroupNode { kind: 'group'; id: string; label?: string; children: SvgNode[] }
  export type SvgNode = PathNode | GroupNode;
  export interface SceneDoc { width: number; height: number; title: string; children: SvgNode[] }
  export function parseScene(svgText: string): SceneDoc;
  export function parsePathData(d: string): Ring[];   // M/m L/l H/h V/v Z/z only; throws on curves/arcs
  export function countRings(doc: SceneDoc): { paths: number; rings: number; vertices: number };
  ```

- [ ] **Step 1: Write the fixture and the failing test**

`tests/fixtures/mini-scene.svg`:
```xml
<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="50" viewBox="0 0 100 50" version="1.1"><title>mini</title><g id="cleanplates" inkscape:groupmode="layer" inkscape:label="00 — underlays"><path d="M0 0H100V50H0Z" fill="#f2eef8" id="cleanplate_paper"/></g><g id="door_it" inkscape:groupmode="layer" inkscape:label="10 — door"><g id="door_it_leaf"><path d="M10 10L30 10L30 40L10 40ZM12.7 12.7L12.7 13.3L13.3 13.3L13.3 12.7Z" fill="#3b2a6e" id="door_it_leaf__p00001"/><path d="M15 15h10v10h-10z" fill="#ffffff" id="door_it_leaf__p00002"/></g></g></svg>
```

`tests/unit/svg-parse.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScene, parsePathData, countRings } from '../../tools/svg/parse.ts';

const fixture = readFileSync(new URL('../fixtures/mini-scene.svg', import.meta.url), 'utf8');

test('parsePathData handles M/L/H/V/Z absolute and relative, multiple subpaths', () => {
  assert.deepEqual(parsePathData('M0 0H100V50H0Z'), [[[0, 0], [100, 0], [100, 50], [0, 50]]]);
  assert.deepEqual(parsePathData('M15 15h10v10h-10z'), [[[15, 15], [25, 15], [25, 25], [15, 25]]]);
  assert.equal(parsePathData('M10 10L30 10L30 40L10 40ZM12.7 12.7L12.7 13.3L13.3 13.3L13.3 12.7Z').length, 2);
  assert.throws(() => parsePathData('M0 0C1 1 2 2 3 3Z'), /unsupported/);
});

test('parseScene keeps the group tree, ids, labels and fills', () => {
  const doc = parseScene(fixture);
  assert.equal(doc.width, 100); assert.equal(doc.height, 50); assert.equal(doc.title, 'mini');
  assert.equal(doc.children.length, 2);
  const door = doc.children[1]!;
  assert.equal(door.kind, 'group'); assert.equal(door.id, 'door_it'); assert.equal((door as any).label, '10 — door');
  const leaf = (door as any).children[0];
  assert.equal(leaf.id, 'door_it_leaf');
  assert.equal(leaf.children[0].fill, '#3b2a6e');
  assert.equal(leaf.children[0].rings.length, 2);
  assert.deepEqual(countRings(doc), { paths: 3, rings: 4, vertices: 16 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/svg/parse.ts'`

- [ ] **Step 3: Write `tools/svg/model.ts` and `tools/svg/parse.ts`**

`tools/svg/model.ts`:
```ts
export type Point = [number, number];
export type Ring = Point[];
export interface PathNode { kind: 'path'; id: string; fill: string; rings: Ring[] }
export interface GroupNode { kind: 'group'; id: string; label?: string; children: SvgNode[] }
export type SvgNode = PathNode | GroupNode;
export interface SceneDoc { width: number; height: number; title: string; children: SvgNode[] }

export function* walkPaths(nodes: SvgNode[]): Generator<PathNode> {
  for (const node of nodes) {
    if (node.kind === 'path') yield node; else yield* walkPaths(node.children);
  }
}
export function findGroup(nodes: SvgNode[], id: string): GroupNode | null {
  for (const node of nodes) {
    if (node.kind !== 'group') continue;
    if (node.id === id) return node;
    const inner = findGroup(node.children, id);
    if (inner) return inner;
  }
  return null;
}
```

`tools/svg/parse.ts`:
```ts
import { DOMParser } from '@xmldom/xmldom';
import type { GroupNode, PathNode, Ring, SceneDoc, SvgNode } from './model.ts';
import { walkPaths } from './model.ts';

const INKSCAPE = 'http://www.inkscape.org/namespaces/inkscape';
const TOKEN = /([MmLlHhVvZzCcSsQqTtAa])|(-?\d*\.?\d+(?:e-?\d+)?)/g;

/** Kit path grammar is polygons only: M/L/H/V/Z. Anything else is a bug upstream, not something to guess at. */
export function parsePathData(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring = [];
  let cmd = ''; let x = 0; let y = 0; let startX = 0; let startY = 0;
  const numbers: number[] = [];
  const flush = () => { if (ring.length >= 3) rings.push(ring); ring = []; };
  const tokens = [...d.matchAll(TOKEN)];
  let i = 0;
  const num = () => { const t = tokens[i++]; if (!t || t[2] === undefined) throw new Error(`path data: expected number in "${d.slice(0, 40)}"`); return Number(t[2]); };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t[1]) { cmd = t[1]; i++; if (cmd === 'Z' || cmd === 'z') { flush(); x = startX; y = startY; continue; } if ('CcSsQqTtAa'.includes(cmd)) throw new Error(`path data: unsupported command ${cmd}`); }
    switch (cmd) {
      case 'M': flush(); x = num(); y = num(); startX = x; startY = y; ring.push([x, y]); cmd = 'L'; break;
      case 'm': flush(); x += num(); y += num(); startX = x; startY = y; ring.push([x, y]); cmd = 'l'; break;
      case 'L': x = num(); y = num(); ring.push([x, y]); break;
      case 'l': x += num(); y += num(); ring.push([x, y]); break;
      case 'H': x = num(); ring.push([x, y]); break;
      case 'h': x += num(); ring.push([x, y]); break;
      case 'V': y = num(); ring.push([x, y]); break;
      case 'v': y += num(); ring.push([x, y]); break;
      default: throw new Error(`path data: unexpected token near "${d.slice(0, 40)}"`);
    }
    numbers.length = 0;
  }
  flush();
  return rings;
}

function element(node: Element): SvgNode | null {
  if (node.localName === 'g') {
    const children: SvgNode[] = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child && child.nodeType === 1) { const parsed = element(child as Element); if (parsed) children.push(parsed); }
    }
    const group: GroupNode = { kind: 'group', id: node.getAttribute('id') ?? '', children };
    const label = node.getAttributeNS(INKSCAPE, 'label');
    if (label) group.label = label;
    return group;
  }
  if (node.localName === 'path') {
    const path: PathNode = { kind: 'path', id: node.getAttribute('id') ?? '', fill: (node.getAttribute('fill') ?? '#000000').toLowerCase(), rings: parsePathData(node.getAttribute('d') ?? '') };
    return path;
  }
  if (['image', 'text', 'filter', 'mask', 'use'].includes(node.localName ?? '')) throw new Error(`kit SVG contains <${node.localName}>; the pipeline only accepts groups and polygon paths`);
  return null;
}

export function parseScene(svgText: string): SceneDoc {
  const dom = new DOMParser({ onError: (level, message) => { if (level === 'fatalError') throw new Error(message); } }).parseFromString(svgText, 'image/svg+xml');
  const svg = dom.documentElement!;
  const children: SvgNode[] = [];
  let title = '';
  for (let i = 0; i < svg.childNodes.length; i++) {
    const child = svg.childNodes[i];
    if (!child || child.nodeType !== 1) continue;
    const el = child as Element;
    if (el.localName === 'title') { title = el.textContent ?? ''; continue; }
    if (el.localName === 'desc') continue;
    const parsed = element(el);
    if (parsed) children.push(parsed);
  }
  return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')), title, children };
}

export function countRings(doc: SceneDoc): { paths: number; rings: number; vertices: number } {
  let paths = 0, rings = 0, vertices = 0;
  for (const path of walkPaths(doc.children)) { paths++; for (const ring of path.rings) { rings++; vertices += ring.length; } }
  return { paths, rings, vertices };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests)

- [ ] **Step 5: Prove it on the real lobby file**

Run: `node --import tsx -e "import {readFileSync} from 'node:fs'; import {parseScene,countRings} from './tools/svg/parse.ts'; import {resolveRoom} from './tools/kits.ts'; const d=parseScene(readFileSync(resolveRoom('lobby').svg,'utf8')); console.log(countRings(d), d.children.map(c=>c.id));"`
Expected: `{ paths: 2789, rings: 60007, vertices: 390849 }` and the top-level layer ids (starting with `cleanplates`).

- [ ] **Step 6: Commit**

```bash
git add tools/svg/model.ts tools/svg/parse.ts tests/unit/svg-parse.test.ts tests/fixtures/mini-scene.svg
git commit -m "Parse kit SVGs into a typed scene model"
```

---

### Task 3: Geometry — speckle, union, curve fitting

**Files:**
- Create: `tools/svg/geometry.ts`
- Test: `tests/unit/svg-geometry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Cubic = { c1: Point; c2: Point; to: Point };
  export interface Contour { start: Point; segments: Cubic[] }      // closed: last `to` returns to start
  export function ringArea(ring: Ring): number;                        // signed
  export function unionRings(rings: Ring[]): Ring[];                   // outer rings CCW, holes CW (polygon-clipping orientation)
  export function cornerIndices(ring: Ring, minTurnDeg: number): number[];
  export function fitRing(ring: Ring, tolerance: number, minTurnDeg: number): Contour;
  export function contourVertexCount(c: Contour): number;             // 1 + segments.length
  ```

- [ ] **Step 1: Write the failing test**

`tests/unit/svg-geometry.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringArea, unionRings, cornerIndices, fitRing, contourVertexCount } from '../../tools/svg/geometry.ts';
import type { Ring } from '../../tools/svg/model.ts';

const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10]];

test('ringArea is signed and sized', () => {
  assert.equal(Math.abs(ringArea(square)), 100);
  assert.equal(Math.abs(ringArea([[0, 0], [0.6, 0], [0.6, 0.6], [0, 0.6]])), 0.36);
});

test('unionRings merges touching rectangles into one ring', () => {
  const merged = unionRings([square, [[10, 0], [20, 0], [20, 10], [10, 10]]]);
  assert.equal(merged.length, 1);
  assert.equal(Math.abs(ringArea(merged[0]!)), 200);
});

test('cornerIndices finds the four corners of a square and none on a dense circle', () => {
  assert.deepEqual(cornerIndices(square, 60), [0, 1, 2, 3]);
  const circle: Ring = Array.from({ length: 180 }, (_, i) => [50 + 40 * Math.cos(i * Math.PI / 90), 50 + 40 * Math.sin(i * Math.PI / 90)]);
  assert.deepEqual(cornerIndices(circle, 60), []);
});

test('fitRing keeps square corners exactly and fits a 180-point circle in few cubics', () => {
  const sq = fitRing(square, 0.75, 60);
  assert.deepEqual(sq.start, [0, 0]);
  assert.equal(sq.segments.length, 4);
  const circle: Ring = Array.from({ length: 180 }, (_, i) => [50 + 40 * Math.cos(i * Math.PI / 90), 50 + 40 * Math.sin(i * Math.PI / 90)]);
  const fitted = fitRing(circle, 0.75, 60);
  assert.ok(contourVertexCount(fitted) <= 12, `expected ≤ 12 vertices, got ${contourVertexCount(fitted)}`);
  for (const seg of fitted.segments) {
    const r = Math.hypot(seg.to[0] - 50, seg.to[1] - 50);
    assert.ok(Math.abs(r - 40) < 0.8, `endpoint drifted off the circle: ${r}`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/svg/geometry.ts'`

- [ ] **Step 3: Write `tools/svg/geometry.ts`**

```ts
import fitCurve from 'fit-curve';
import polygonClipping from 'polygon-clipping';
import type { Point, Ring } from './model.ts';

export type Cubic = { c1: Point; c2: Point; to: Point };
export interface Contour { start: Point; segments: Cubic[] }

export function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!; const [x2, y2] = ring[(i + 1) % ring.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/** Union of rings that share one paint. polygon-clipping returns exteriors and holes with opposite winding, which the nonzero fill rule renders correctly. */
export function unionRings(rings: Ring[]): Ring[] {
  if (rings.length <= 1) return rings;
  const result = polygonClipping.union(...rings.map(ring => [ring.map(p => [p[0], p[1]] as [number, number])]));
  const out: Ring[] = [];
  for (const polygon of result) for (const ring of polygon) {
    const pts = ring.map(p => [p[0], p[1]] as Point);
    if (pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts.pop();
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}

function turn(a: Point, b: Point, c: Point): number {
  const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const l1 = Math.hypot(v1[0]!, v1[1]!), l2 = Math.hypot(v2[0]!, v2[1]!);
  if (l1 === 0 || l2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (v1[0]! * v2[0]! + v1[1]! * v2[1]!) / (l1 * l2)));
  return Math.acos(cos) * 180 / Math.PI;
}

/** Indices where the polyline turns more than `minTurnDeg`; those stay sharp through fitting. */
export function cornerIndices(ring: Ring, minTurnDeg: number): number[] {
  const out: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n]!, b = ring[i]!, c = ring[(i + 1) % n]!;
    if (turn(a, b, c) >= minTurnDeg) out.push(i);
  }
  return out;
}

function fitOpen(points: Point[], tolerance: number): Cubic[] {
  if (points.length < 2) return [];
  if (points.length === 2) { const [a, b] = points as [Point, Point]; return [{ c1: a, c2: b, to: b }]; }
  const curves = fitCurve(points.map(p => [p[0], p[1]]), tolerance) as number[][][];
  return curves.map(c => ({ c1: [c[1]![0]!, c[1]![1]!], c2: [c[2]![0]!, c[2]![1]!], to: [c[3]![0]!, c[3]![1]!] }));
}

/** Schneider fitting per corner-to-corner run. A ring with no corners is fitted as one closed run starting at index 0. */
export function fitRing(ring: Ring, tolerance: number, minTurnDeg: number): Contour {
  const n = ring.length;
  const corners = cornerIndices(ring, minTurnDeg);
  const anchors = corners.length ? corners : [0];
  const start = ring[anchors[0]!]!;
  const segments: Cubic[] = [];
  for (let k = 0; k < anchors.length; k++) {
    const from = anchors[k]!, to = anchors[(k + 1) % anchors.length]!;
    const run: Point[] = [];
    let i = from;
    do { run.push(ring[i]!); i = (i + 1) % n; } while (i !== to);
    run.push(ring[to]!);
    if (anchors.length === 1) run[run.length - 1] = ring[from]!; // closed run back to its own start
    segments.push(...fitOpen(run, tolerance));
  }
  return { start, segments };
}

export function contourVertexCount(contour: Contour): number { return 1 + contour.segments.length; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS. If `fit-curve` has no types, add `tools/svg/fit-curve.d.ts` containing `declare module 'fit-curve' { const fitCurve: (points: number[][], maxError: number) => number[][][]; export default fitCurve; }` and re-run.

- [ ] **Step 5: Commit**

```bash
git add tools/svg/geometry.ts tools/svg/fit-curve.d.ts tests/unit/svg-geometry.test.ts
git commit -m "Ring geometry: area, union, corner-aware cubic fitting"
```

---

### Task 4: Refine a scene and serialize it back

**Files:**
- Create: `tools/svg/refine.ts`, `tools/svg/serialize.ts`
- Test: `tests/unit/svg-refine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RefineOptions { minArea: number; tolerance: number; minTurnDeg: number; union: boolean }
  export const DEFAULT_REFINE: RefineOptions;          // { minArea: 4, tolerance: 0.75, minTurnDeg: 60, union: true }
  export interface RefinedPath { kind: 'path'; id: string; fill: string; contours: Contour[] }
  export interface RefinedGroup { kind: 'group'; id: string; label?: string; children: RefinedNode[] }
  export type RefinedNode = RefinedPath | RefinedGroup;
  export interface RefinedDoc { width: number; height: number; title: string; children: RefinedNode[] }
  export interface RefineStats { before: { paths: number; rings: number; vertices: number }; after: { paths: number; contours: number; vertices: number }; dropped: { rings: number; paths: number } }
  export function refineScene(doc: SceneDoc, options?: RefineOptions): { doc: RefinedDoc; stats: RefineStats };
  export function serializeScene(doc: RefinedDoc): string;               // compact SVG, ids kept, fill-rule nonzero
  export function extractPart(doc: RefinedDoc, id: string): RefinedDoc;  // same canvas, only that group
  export function listGroupIds(doc: RefinedDoc): string[];
  ```

- [ ] **Step 1: Write the failing test**

`tests/unit/svg-refine.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScene } from '../../tools/svg/parse.ts';
import { refineScene, serializeScene, extractPart, listGroupIds } from '../../tools/svg/refine.ts';

const doc = parseScene(readFileSync(new URL('../fixtures/mini-scene.svg', import.meta.url), 'utf8'));

test('refineScene drops speckle, keeps ids and fills, reports stats', () => {
  const { doc: refined, stats } = refineScene(doc);
  assert.equal(stats.before.rings, 4);
  assert.equal(stats.dropped.rings, 1);                 // the 0.36 px² speck
  assert.equal(stats.after.paths, 3);
  assert.deepEqual(listGroupIds(refined), ['cleanplates', 'door_it', 'door_it_leaf']);
  const leaf = (refined.children[1] as any).children[0];
  assert.equal(leaf.children[0].id, 'door_it_leaf__p00001');
  assert.equal(leaf.children[0].fill, '#3b2a6e');
  assert.equal(leaf.children[0].contours.length, 1);
});

test('serializeScene writes cubic path data with ids and no raster/filter/text', () => {
  const svg = serializeScene(refineScene(doc).doc);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="50" viewBox="0 0 100 50">/);
  assert.match(svg, /<g id="door_it_leaf">/);
  assert.match(svg, /<path id="door_it_leaf__p00001" fill="#3b2a6e" d="M10 10C/);
  assert.doesNotMatch(svg, /<image|<filter|<text|inkscape/);
});

test('extractPart keeps only the named group on the same canvas', () => {
  const part = extractPart(refineScene(doc).doc, 'door_it_leaf');
  assert.equal(part.width, 100);
  assert.deepEqual(listGroupIds(part), ['door_it_leaf']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/svg/refine.ts'`

- [ ] **Step 3: Write `tools/svg/refine.ts`**

```ts
import type { GroupNode, PathNode, SceneDoc, SvgNode } from './model.ts';
import { countRings } from './parse.ts';
import { fitRing, ringArea, unionRings, type Contour } from './geometry.ts';
export { serializeScene, extractPart, listGroupIds } from './serialize.ts';

export interface RefineOptions { minArea: number; tolerance: number; minTurnDeg: number; union: boolean }
export const DEFAULT_REFINE: RefineOptions = { minArea: 4, tolerance: 0.75, minTurnDeg: 60, union: true };

export interface RefinedPath { kind: 'path'; id: string; fill: string; contours: Contour[] }
export interface RefinedGroup { kind: 'group'; id: string; label?: string; children: RefinedNode[] }
export type RefinedNode = RefinedPath | RefinedGroup;
export interface RefinedDoc { width: number; height: number; title: string; children: RefinedNode[] }
export interface RefineStats {
  before: { paths: number; rings: number; vertices: number };
  after: { paths: number; contours: number; vertices: number };
  dropped: { rings: number; paths: number };
}

function refinePath(path: PathNode, options: RefineOptions, stats: RefineStats): RefinedPath | null {
  const kept = path.rings.filter(ring => Math.abs(ringArea(ring)) >= options.minArea);
  stats.dropped.rings += path.rings.length - kept.length;
  if (kept.length === 0) { stats.dropped.paths++; return null; }
  const rings = options.union ? unionRings(kept) : kept;
  const contours = rings.map(ring => fitRing(ring, options.tolerance, options.minTurnDeg));
  stats.after.paths++;
  stats.after.contours += contours.length;
  for (const contour of contours) stats.after.vertices += 1 + contour.segments.length;
  return { kind: 'path', id: path.id, fill: path.fill, contours };
}

function refineNodes(nodes: SvgNode[], options: RefineOptions, stats: RefineStats): RefinedNode[] {
  const out: RefinedNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'path') { const refined = refinePath(node, options, stats); if (refined) out.push(refined); continue; }
    const group: RefinedGroup = { kind: 'group', id: node.id, children: refineNodes(node.children, options, stats) };
    if (node.label) group.label = node.label;
    out.push(group); // empty groups stay: the manifest names them and Rive nodes may need them as pivots
  }
  return out;
}

/** Speckle drop → same-paint union → corner-aware cubic fit. Ids, labels, fills and tree order are untouched. */
export function refineScene(doc: SceneDoc, options: RefineOptions = DEFAULT_REFINE): { doc: RefinedDoc; stats: RefineStats } {
  const stats: RefineStats = { before: countRings(doc), after: { paths: 0, contours: 0, vertices: 0 }, dropped: { rings: 0, paths: 0 } };
  const children = refineNodes(doc.children, options, stats);
  return { doc: { width: doc.width, height: doc.height, title: doc.title, children }, stats };
}
```

`tools/svg/serialize.ts`:
```ts
import type { Contour } from './geometry.ts';
import type { RefinedDoc, RefinedGroup, RefinedNode } from './refine.ts';

const fmt = (n: number) => { const r = Math.round(n * 10) / 10; return Object.is(r, -0) ? '0' : String(r); };

export function contourToPathData(contour: Contour): string {
  let d = `M${fmt(contour.start[0])} ${fmt(contour.start[1])}`;
  for (const s of contour.segments) d += `C${fmt(s.c1[0])} ${fmt(s.c1[1])} ${fmt(s.c2[0])} ${fmt(s.c2[1])} ${fmt(s.to[0])} ${fmt(s.to[1])}`;
  return d + 'Z';
}

function node(n: RefinedNode): string {
  if (n.kind === 'path') return `<path id="${n.id}" fill="${n.fill}" d="${n.contours.map(contourToPathData).join('')}"/>`;
  return `<g id="${n.id}">${n.children.map(node).join('')}</g>`;
}

/** Plain SVG 1.1, no namespaces beyond svg, no styles, nonzero fill rule (the default). */
export function serializeScene(doc: RefinedDoc): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${doc.title}</title>${doc.children.map(node).join('')}</svg>`;
}

function find(nodes: RefinedNode[], id: string): RefinedGroup | null {
  for (const n of nodes) {
    if (n.kind !== 'group') continue;
    if (n.id === id) return n;
    const inner = find(n.children, id); if (inner) return inner;
  }
  return null;
}

export function extractPart(doc: RefinedDoc, id: string): RefinedDoc {
  const group = find(doc.children, id);
  if (!group) throw new Error(`part ${id} not found`);
  return { width: doc.width, height: doc.height, title: `${doc.title} — ${id}`, children: [group] };
}

export function listGroupIds(doc: RefinedDoc): string[] {
  const out: string[] = [];
  const walk = (nodes: RefinedNode[]) => { for (const n of nodes) if (n.kind === 'group') { out.push(n.id); walk(n.children); } };
  walk(doc.children);
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all tests so far)

- [ ] **Step 5: Measure on the real lobby**

Run: `node --import tsx -e "import {readFileSync} from 'node:fs'; import {parseScene} from './tools/svg/parse.ts'; import {refineScene,serializeScene} from './tools/svg/refine.ts'; import {resolveRoom} from './tools/kits.ts'; const t=Date.now(); const r=refineScene(parseScene(readFileSync(resolveRoom('lobby').svg,'utf8'))); console.log(r.stats, 'svg bytes', serializeScene(r.doc).length, 'ms', Date.now()-t);"`
Expected: `before.vertices 390849`, `after.vertices` ≤ 78,000 (≥ 5× fewer), under 60 s. If `after.vertices` is above 78,000, raise `tolerance` to 1.0 in `DEFAULT_REFINE` and re-run; record the final numbers in the commit message.

- [ ] **Step 6: Commit**

```bash
git add tools/svg/refine.ts tools/svg/serialize.ts tests/unit/svg-refine.test.ts
git commit -m "Refine traced scenes: speckle drop, union, cubic fit; serialize and part extraction"
```

---

### Task 5: Reference diff and the `refine` CLI

**Files:**
- Create: `tools/svg/diff.ts`, `tools/refine-vectors.ts`
- Test: `tests/unit/refine-cli.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DiffResult { width: number; height: number; differentPixels: number; ratio: number }
  export function renderSvg(svg: string, width: number): Uint8Array;                 // PNG bytes (resvg)
  export function diffAgainstReference(svg: string, referencePng: string, outPng: string): DiffResult;
  export interface RefinedManifest {
    room: string; canvas: { width: number; height: number };
    source: { svg: string; sha256: string; manifest: string; hotspots: string };
    stats: RefineStats; options: RefineOptions;
    parts: Array<{ id: string; file: string; pivot: [number, number]; motion: string }>;
    hotspots: unknown;                       // the kit's hotspots.json verbatim
    diff: DiffResult;
  }
  export function refineRoom(room: RoomId, options?: RefineOptions): RefinedManifest;   // writes scenes/refined/<room>/
  ```
  Parts are: every `doors[].leafId` from the kit manifest plus every `layers[]` entry whose `motion` is not `static` and not `parallax_small`.

- [ ] **Step 1: Write the failing test**

`tests/unit/refine-cli.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffAgainstReference, renderSvg } from '../../tools/svg/diff.ts';
import { selectParts } from '../../tools/refine-vectors.ts';

test('renderSvg produces a PNG of the requested width', () => {
  const png = renderSvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><rect width="20" height="10" fill="#fff"/></svg>', 40);
  assert.equal(png[0], 0x89); assert.equal(png[1], 0x50);
});

test('diffAgainstReference reports zero difference for an identical render', () => {
  const dir = mmkd();
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><rect width="20" height="10" fill="#4a2f8a"/></svg>';
  const reference = join(dir, 'ref.png'); require('node:fs').writeFileSync(reference, renderSvg(svg, 20));
  const result = diffAgainstReference(svg, reference, join(dir, 'diff.png'));
  assert.equal(result.differentPixels, 0); assert.equal(result.ratio, 0);
  assert.ok(existsSync(join(dir, 'diff.png')));
});

test('selectParts picks door leaves and moving layers from a kit manifest', () => {
  const manifest = { doors: [{ id: 'it', leafId: 'door_it_leaf', pivot: [564, 529] }], layers: [
    { id: 'architecture_back_wall', pivot: [0, 0], motion: 'parallax_small' },
    { id: 'plant_left', pivot: [400, 500], motion: 'sway' },
    { id: 'door_it_frame', pivot: [0, 0], motion: 'static' },
  ] };
  assert.deepEqual(selectParts(manifest as any), [
    { id: 'door_it_leaf', pivot: [564, 529], motion: 'door' },
    { id: 'plant_left', pivot: [400, 500], motion: 'sway' },
  ]);
});

function mmkd() { return mkdtempSync(join(tmpdir(), 'tdg-refine-')); }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/svg/diff.ts'`

- [ ] **Step 3: Write `tools/svg/diff.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult { width: number; height: number; differentPixels: number; ratio: number }

export function renderSvg(svg: string, width: number): Uint8Array {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' }).render().asPng();
}

/** Renders the SVG at the reference's own size and counts pixels that differ by more than pixelmatch's 0.1 threshold. */
export function diffAgainstReference(svg: string, referencePng: string, outPng: string): DiffResult {
  const reference = PNG.sync.read(readFileSync(referencePng));
  const rendered = PNG.sync.read(Buffer.from(renderSvg(svg, reference.width)));
  if (rendered.height !== reference.height) throw new Error(`render is ${rendered.width}×${rendered.height}, reference is ${reference.width}×${reference.height}`);
  const diff = new PNG({ width: reference.width, height: reference.height });
  const differentPixels = pixelmatch(rendered.data, reference.data, diff.data, reference.width, reference.height, { threshold: 0.1, includeAA: false });
  writeFileSync(outPng, PNG.sync.write(diff));
  return { width: reference.width, height: reference.height, differentPixels, ratio: differentPixels / (reference.width * reference.height) };
}
```

- [ ] **Step 4: Write `tools/refine-vectors.ts`**

```ts
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKits, repoRoot, resolveRoom, type RoomId } from './kits.ts';
import { parseScene } from './svg/parse.ts';
import { DEFAULT_REFINE, extractPart, refineScene, serializeScene, type RefineOptions, type RefineStats } from './svg/refine.ts';
import { diffAgainstReference, type DiffResult } from './svg/diff.ts';

export interface KitManifest { doors?: Array<{ id: string; leafId: string; pivot: [number, number] }>; layers: Array<{ id: string; pivot: [number, number]; motion: string }> }
export interface PartSpec { id: string; pivot: [number, number]; motion: string }
export interface RefinedManifest {
  room: RoomId; canvas: { width: number; height: number };
  source: { svg: string; sha256: string; manifest: string; hotspots: string };
  stats: RefineStats; options: RefineOptions;
  parts: PartSpec[]; hotspots: unknown; diff: DiffResult;
}

const STATIC = new Set(['static', 'parallax_small']);

/** Door leaves first (motion "door"), then every layer the kit marks as moving. */
export function selectParts(manifest: KitManifest): PartSpec[] {
  const parts: PartSpec[] = (manifest.doors ?? []).map(door => ({ id: door.leafId, pivot: door.pivot, motion: 'door' }));
  const seen = new Set(parts.map(p => p.id));
  for (const layer of manifest.layers) if (!STATIC.has(layer.motion) && !seen.has(layer.id)) { parts.push({ id: layer.id, pivot: layer.pivot, motion: layer.motion }); seen.add(layer.id); }
  return parts;
}

export function refineRoom(room: RoomId, options: RefineOptions = DEFAULT_REFINE): RefinedManifest {
  const kits = loadKits();
  const kit = resolveRoom(room, kits);
  const out = resolve(repoRoot, 'scenes/refined', room);
  mkdirSync(join(out, 'parts'), { recursive: true });
  const svgText = readFileSync(kit.svg, 'utf8');
  const kitManifest = JSON.parse(readFileSync(kit.manifest, 'utf8')) as KitManifest;
  const hotspots = JSON.parse(readFileSync(kit.hotspots, 'utf8')) as unknown;
  const { doc, stats } = refineScene(parseScene(svgText), options);
  const scene = serializeScene(doc);
  writeFileSync(join(out, 'scene.svg'), scene);
  const parts = selectParts(kitManifest).filter(part => { try { extractPart(doc, part.id); return true; } catch { console.warn(`part ${part.id} not in SVG; skipped`); return false; } });
  for (const part of parts) writeFileSync(join(out, 'parts', `${part.id}.svg`), serializeScene(extractPart(doc, part.id)));
  const diff = diffAgainstReference(scene, kit.reference, join(out, 'diff.png'));
  const manifest: RefinedManifest = {
    room, canvas: kits.canvas,
    source: { svg: relative(kits.root, kit.svg), sha256: createHash('sha256').update(svgText).digest('hex'), manifest: relative(kits.root, kit.manifest), hotspots: relative(kits.root, kit.hotspots) },
    stats, options, parts, hotspots, diff,
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const room = (index > 0 ? process.argv[index + 1] : 'lobby') as RoomId;
  const t = Date.now();
  const m = refineRoom(room);
  console.log(`${room}: ${m.stats.before.vertices} → ${m.stats.after.vertices} vertices (${(m.stats.before.vertices / m.stats.after.vertices).toFixed(1)}×), ${m.stats.after.paths} paths, ${m.parts.length} parts, diff ${(m.diff.ratio * 100).toFixed(2)}% of pixels, ${Date.now() - t} ms`);
}
```

- [ ] **Step 5: Run the tests, then the CLI on the lobby**

Run: `npm test`
Expected: PASS

Run: `npm run refine -- --room lobby && ls -la scenes/refined/lobby scenes/refined/lobby/parts && open scenes/refined/lobby/diff.png`
Expected: `scene.svg` (well under 2 MB), `parts/door_it_leaf.svg`, `parts/door_government_leaf.svg`, `parts/door_cyber_leaf.svg` plus the moving layers, `manifest.json`, `diff.png`; printed diff ratio ≤ 6% (banding at gradient edges is expected; door outlines and lettering must not appear as solid red in `diff.png`). Look at `scene.svg` in Chrome (`open -a "Google Chrome" scenes/refined/lobby/scene.svg`) next to the reference PNG.

- [ ] **Step 6: Commit**

```bash
git add tools/svg/diff.ts tools/refine-vectors.ts tests/unit/refine-cli.test.ts scenes/refined/lobby
git commit -m "Refine CLI with reference diff; lobby refined"
```

---

### Task 6: Rive editor client

**Files:**
- Create: `tools/rive-mcp.ts`
- Test: `tests/unit/rive-mcp.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ToolResult { text?: unknown; images: Buffer[]; isError: boolean }
  export class RiveEditor {
    constructor(url?: string, log?: (entry: LogEntry) => void);      // default http://127.0.0.1:9791/mcp
    initialize(): Promise<{ name: string; version: string }>;
    call<T = any>(name: string, args?: Record<string, unknown>): Promise<T>;   // parsed JSON text content; throws on isError
    callRaw(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
    uploadSvg(filePath: string, name: string): Promise<string>;                // asset id (data-URI upload)
    capture(artboard: string, outPng: string, longEdge?: number): Promise<void>;
    exportRiv(outDir: string): Promise<{ path: string; bytes: number }>;      // inline_base64; writes <outDir>/<filename>
  }
  export interface LogEntry { at: string; tool: string; args: unknown; ok: boolean; ms: number; summary: string }
  ```

- [ ] **Step 1: Write the failing test (against a stub server)**

`tests/unit/rive-mcp.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RiveEditor } from '../../tools/rive-mcp.ts';

function stub(handler: (req: any) => any) {
  const server = createServer((req, res) => {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const rpc = JSON.parse(body);
      const result = handler(rpc);
      res.setHeader('content-type', 'text/event-stream');
      res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result })}\n\n`);
    });
  });
  return new Promise<{ url: string; close: () => void }>(resolve => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}/mcp`, close: () => server.close() })));
}

test('call parses SSE-framed JSON text content and throws on isError', async () => {
  const seen: any[] = [];
  const s = await stub(rpc => {
    seen.push(rpc);
    if (rpc.method === 'initialize') return { serverInfo: { name: 'rive', version: '0.6' } };
    if (rpc.params.name === 'bad') return { isError: true, content: [{ type: 'text', text: 'Error: nope' }] };
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, echo: rpc.params.arguments }) }] };
  });
  const editor = new RiveEditor(s.url);
  assert.deepEqual(await editor.initialize(), { name: 'rive', version: '0.6' });
  assert.deepEqual(await editor.call('list_artboards', { a: 1 }), { success: true, echo: { a: 1 } });
  await assert.rejects(editor.call('bad'), /nope/);
  assert.equal(seen[1].params.name, 'list_artboards');
  s.close();
});

test('uploadSvg sends a data URI and exportRiv writes decoded bytes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tdg-mcp-'));
  writeFileSync(join(dir, 'x.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  let uploaded = '';
  const s = await stub(rpc => {
    if (rpc.method === 'initialize') return { serverInfo: { name: 'rive', version: '0.6' } };
    if (rpc.params.name === 'upload_asset') { uploaded = rpc.params.arguments.file; return { content: [{ type: 'text', text: JSON.stringify({ success: true, asset: { id: '0-14' } }) }] }; }
    if (rpc.params.name === 'export_file') return { content: [{ type: 'text', text: JSON.stringify({ success: true, filename: 'x.riv', data: Buffer.from('RIVE').toString('base64') }) }] };
    throw new Error('unexpected');
  });
  const editor = new RiveEditor(s.url);
  assert.equal(await editor.uploadSvg(join(dir, 'x.svg'), 'x'), '0-14');
  assert.match(uploaded, /^data:image\/svg\+xml;name=x\.svg;base64,/);
  const out = await editor.exportRiv(dir);
  assert.equal(readFileSync(out.path, 'utf8'), 'RIVE'); assert.equal(out.bytes, 4);
  s.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/rive-mcp.ts'`

- [ ] **Step 3: Write `tools/rive-mcp.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface ToolResult { text?: unknown; images: Buffer[]; isError: boolean }
export interface LogEntry { at: string; tool: string; args: unknown; ok: boolean; ms: number; summary: string }

/** JSON-RPC client for the Rive Early Access editor MCP. The editor is sandboxed: files go in as data URIs and come out as inline base64. */
export class RiveEditor {
  private id = 0;
  private sessionId: string | null = null;
  constructor(private readonly url = 'http://127.0.0.1:9791/mcp', private readonly log: (entry: LogEntry) => void = () => {}) {}

  private async rpc(method: string, params: Record<string, unknown>): Promise<any> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId;
    const response = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }), signal: AbortSignal.timeout(180_000) });
    const session = response.headers.get('mcp-session-id'); if (session) this.sessionId = session;
    const raw = await response.text();
    const lines = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
    const body = JSON.parse(lines.length ? lines[lines.length - 1]! : raw);
    if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
    return body.result;
  }

  async initialize(): Promise<{ name: string; version: string }> {
    const result = await this.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'thatdeveloperguy-website', version: '0.1.0' } });
    return { name: result.serverInfo.name, version: result.serverInfo.version };
  }

  async callRaw(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const t = Date.now();
    const result = await this.rpc('tools/call', { name, arguments: args });
    const out: ToolResult = { images: [], isError: Boolean(result.isError) };
    for (const item of result.content ?? []) {
      if (item.type === 'image') out.images.push(Buffer.from(item.data, 'base64'));
      if (item.type === 'text') { try { out.text = JSON.parse(item.text); } catch { out.text = item.text; } }
    }
    const summary = typeof out.text === 'string' ? out.text.slice(0, 160) : JSON.stringify(out.text ?? '').slice(0, 160);
    this.log({ at: new Date().toISOString(), tool: name, args: name === 'upload_asset' ? { ...args, file: '<data-uri>' } : args, ok: !out.isError, ms: Date.now() - t, summary });
    return out;
  }

  async call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.callRaw(name, args);
    if (result.isError) throw new Error(`${name}: ${typeof result.text === 'string' ? result.text : JSON.stringify(result.text)}`);
    if (result.text && typeof result.text === 'object' && (result.text as any).success === false) throw new Error(`${name}: ${JSON.stringify(result.text)}`);
    return result.text as T;
  }

  async uploadSvg(filePath: string, name: string): Promise<string> {
    const data = readFileSync(filePath).toString('base64');
    const file = `data:image/svg+xml;name=${encodeURIComponent(name)}.svg;base64,${data}`;
    const result = await this.call<{ asset: { id: string } }>('upload_asset', { file, name });
    return result.asset.id;
  }

  async capture(artboard: string, outPng: string, longEdge = 1536): Promise<void> {
    const result = await this.callRaw('capture_artboard', { artboardId: artboard, longEdge, backgroundColor: '#ffffff' });
    if (result.isError || !result.images[0]) throw new Error(`capture_artboard: ${JSON.stringify(result.text)}`);
    writeFileSync(outPng, result.images[0]);
  }

  async exportRiv(outDir: string): Promise<{ path: string; bytes: number }> {
    const result = await this.call<{ filename: string; data?: string; path?: string }>('export_file', { format: 'riv', destination: outDir, inline_base64: true });
    if (!result.data) { const bytes = readFileSync(result.path!); const path = join(outDir, basename(result.path!)); writeFileSync(path, bytes); return { path, bytes: bytes.length }; }
    const bytes = Buffer.from(result.data, 'base64');
    const path = join(outDir, result.filename);
    writeFileSync(path, bytes);
    return { path, bytes: bytes.length };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Live smoke against the editor**

Run: `node --import tsx -e "import {RiveEditor} from './tools/rive-mcp.ts'; const e=new RiveEditor(); console.log(await e.initialize()); console.log(await e.call('session_info'));"`
Expected: `{ name: 'rive', version: '0.6' }` and the open file's name. If it fails, Rive Early Access is not running or the MCP is off — stop and say so.

- [ ] **Step 6: Commit**

```bash
git add tools/rive-mcp.ts tests/unit/rive-mcp.test.ts
git commit -m "Rive editor MCP client: data-URI upload, capture, inline export"
```

---

### Task 7: Lobby authoring plan (pure) and executor

**Files:**
- Create: `tools/rive-plan.ts`, `tools/rive-author.ts`
- Test: `tests/unit/rive-plan.test.ts`

**Interfaces:**
- Consumes: `RefinedManifest` from `scenes/refined/lobby/manifest.json`, `RiveEditor`.
- Produces:
  ```ts
  export interface LobbyPlan {
    artboard: 'Lobby'; width: 1648; height: 928;
    scene: { file: 'scene.svg'; nodeName: 'scene' };
    doors: Array<{ id: 'it' | 'government' | 'cyber'; leafId: string; hinge: [number, number]; hit: { x: number; y: number; width: number; height: number }; href: string; label: string }>;
    enum: { name: 'LobbyFocus'; values: ['none', 'it', 'government', 'cyber'] };
    viewModel: { name: 'Lobby'; properties: Array<{ name: string; type: 'enum' | 'trigger' | 'boolean' }> };
    animations: Array<{ name: string; durationFrames: number; loop: 'oneShot' | 'loop' | 'pingPong'; keys: Array<{ target: 'hinge' | 'light' | 'leaf'; door?: string; property: 'scaleX' | 'y' | 'opacity' | 'scaleY'; frame: number; value: number; interpolation: 'cubic' | 'linear' | 'hold' }> }>;
    layers: Array<{ name: string; states: Array<{ name: string; animation?: string }>; transitions: Array<{ from: string; to: string; when?: { property: string; equals?: string | boolean } }> }>;
  }
  export function planLobby(manifest: RefinedManifest): LobbyPlan;
  ```
  `rive-manifest.json` written by the executor:
  ```json
  { "room": "lobby", "file": "lobby.riv", "sha256": "…", "bytes": 0, "artboard": "Lobby", "stateMachine": "State Machine 1",
    "viewModel": "Lobby", "enum": { "LobbyFocus": ["none","it","government","cyber"] },
    "inputs": { "focus": "enum", "openIt": "trigger", "openGovernment": "trigger", "openCyber": "trigger", "reducedMotion": "boolean" },
    "animations": ["Ambient","DoorOpenIt","DoorOpenGovernment","DoorOpenCyber","FocusIt","FocusGovernment","FocusCyber"],
    "editor": { "fileId": 0, "url": "" }, "authoredAt": "" }
  ```

- [ ] **Step 1: Write the failing test**

`tests/unit/rive-plan.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLobby } from '../../tools/rive-plan.ts';

const manifest = JSON.parse(readFileSync(new URL('../../scenes/refined/lobby/manifest.json', import.meta.url), 'utf8'));

test('planLobby derives three doors with hinges, hits and routes from the kit hotspots', () => {
  const plan = planLobby(manifest);
  assert.equal(plan.artboard, 'Lobby');
  assert.deepEqual(plan.doors.map(d => d.id), ['it', 'government', 'cyber']);
  assert.deepEqual(plan.doors[0], { id: 'it', leafId: 'door_it_leaf', hinge: [564, 529], hit: { x: 542, y: 229, width: 176, height: 302 }, href: '/it-services/', label: 'IT SERVICES' });
});

test('planLobby names every animation, view-model property and state-machine layer the site relies on', () => {
  const plan = planLobby(manifest);
  assert.deepEqual(plan.animations.map(a => a.name), ['Ambient', 'DoorOpenIt', 'DoorOpenGovernment', 'DoorOpenCyber', 'FocusIt', 'FocusGovernment', 'FocusCyber']);
  assert.deepEqual(plan.viewModel.properties, [
    { name: 'focus', type: 'enum' }, { name: 'openIt', type: 'trigger' }, { name: 'openGovernment', type: 'trigger' }, { name: 'openCyber', type: 'trigger' }, { name: 'reducedMotion', type: 'boolean' },
  ]);
  assert.deepEqual(plan.layers.map(l => l.name), ['Ambient', 'DoorIt', 'DoorGovernment', 'DoorCyber', 'Focus']);
  const door = plan.layers[1]!;
  assert.deepEqual(door.transitions, [{ from: 'Closed', to: 'Open', when: { property: 'openIt' } }]);
  const open = plan.animations.find(a => a.name === 'DoorOpenIt')!;
  assert.equal(open.loop, 'oneShot');
  assert.deepEqual(open.keys[0], { target: 'hinge', door: 'it', property: 'scaleX', frame: 0, value: 100, interpolation: 'cubic' });
  assert.deepEqual(open.keys[1], { target: 'hinge', door: 'it', property: 'scaleX', frame: 26, value: 22, interpolation: 'cubic' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/rive-plan.ts'`

- [ ] **Step 3: Write `tools/rive-plan.ts`**

```ts
import type { RefinedManifest } from './refine-vectors.ts';

type DoorId = 'it' | 'government' | 'cyber';
const TITLE: Record<DoorId, string> = { it: 'It', government: 'Government', cyber: 'Cyber' };
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
  const animations: PlanAnimation[] = [
    { name: 'Ambient', durationFrames: 180, loop: 'pingPong', keys: doors.map(d => ({ target: 'light' as const, door: d.id, property: 'opacity' as const, frame: 0, value: 70, interpolation: 'cubic' as const })).concat(doors.map(d => ({ target: 'light' as const, door: d.id, property: 'opacity' as const, frame: 180, value: 100, interpolation: 'cubic' as const }))) },
    ...doors.map(d => ({ name: `DoorOpen${TITLE[d.id]}`, durationFrames: 26, loop: 'oneShot' as const, keys: [
      { target: 'hinge' as const, door: d.id, property: 'scaleX' as const, frame: 0, value: 100, interpolation: 'cubic' as const },
      { target: 'hinge' as const, door: d.id, property: 'scaleX' as const, frame: 26, value: 22, interpolation: 'cubic' as const },
      { target: 'leaf' as const, door: d.id, property: 'opacity' as const, frame: 0, value: 100, interpolation: 'linear' as const },
      { target: 'leaf' as const, door: d.id, property: 'opacity' as const, frame: 26, value: 82, interpolation: 'linear' as const },
    ] })),
    ...doors.map(d => ({ name: `Focus${TITLE[d.id]}`, durationFrames: 12, loop: 'oneShot' as const, keys: [
      { target: 'hinge' as const, door: d.id, property: 'y' as const, frame: 0, value: d.hinge[1], interpolation: 'cubic' as const },
      { target: 'hinge' as const, door: d.id, property: 'y' as const, frame: 12, value: d.hinge[1] - 4, interpolation: 'cubic' as const },
      { target: 'light' as const, door: d.id, property: 'scaleX' as const, frame: 0, value: 100, interpolation: 'cubic' as const },
      { target: 'light' as const, door: d.id, property: 'scaleX' as const, frame: 12, value: 130, interpolation: 'cubic' as const },
      { target: 'light' as const, door: d.id, property: 'scaleY' as const, frame: 0, value: 100, interpolation: 'cubic' as const },
      { target: 'light' as const, door: d.id, property: 'scaleY' as const, frame: 12, value: 130, interpolation: 'cubic' as const },
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Write `tools/rive-author.ts` (the executor)**

```ts
/**
 * Authors the lobby artboard in the open Rive Early Access file and exports it.
 *   npm run rive:author -- --room lobby [--replace]
 * Every editor call is appended to scenes/rive/lobby/authoring-log.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './kits.ts';
import { RiveEditor, type LogEntry } from './rive-mcp.ts';
import { planLobby, type LobbyPlan } from './rive-plan.ts';
import type { RefinedManifest } from './refine-vectors.ts';

const TITLE = { it: 'It', government: 'Government', cyber: 'Cyber' } as const;
const LIGHT_ID = { it: 'door_it_status_light', government: 'door_government_status_light', cyber: 'door_cyber_status_light' } as const;

interface Ctx { editor: RiveEditor; plan: LobbyPlan; artboardId: string; ids: Map<string, string>; keys: Map<string, Record<string, number>>; vm: { id: string; props: Record<string, string> }; animations: Record<string, string>; stateMachineId: string; stateMachineName: string }

async function propertyKey(ctx: Ctx, objectId: string, name: string): Promise<number> {
  if (!ctx.keys.has(objectId)) {
    const result = await ctx.editor.call<{ properties: Record<string, Record<string, number>> | Record<string, number> }>('query_property_keys', { objectIds: [objectId] });
    const table = (result.properties as any)[objectId] ?? result.properties;
    ctx.keys.set(objectId, table as Record<string, number>);
  }
  const table = ctx.keys.get(objectId)!;
  const wanted = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const [label, key] of Object.entries(table)) if (label.toLowerCase().replace(/[^a-z]/g, '') === wanted) return key;
  throw new Error(`property ${name} not found on ${objectId}: ${Object.keys(table).join(', ')}`);
}

async function findId(ctx: Ctx, name: string): Promise<string> {
  const result = await ctx.editor.call<{ objects: Array<{ id: string; name: string }> }>('find_objects', { name });
  const exact = result.objects.find(o => o.name === name);
  if (!exact) throw new Error(`object ${name} not found in artboard`);
  return exact.id;
}

/** Wrap a leaf in a hinge group at the kit pivot so scaleX compresses toward the hinge. */
async function hinge(ctx: Ctx, door: LobbyPlan['doors'][number]): Promise<void> {
  const leafId = await findId(ctx, door.leafId);
  const group = await ctx.editor.call<{ id?: string; nodeId?: string; group?: { id: string } }>('group_editor', { name: `hinge_${door.id}`, x: door.hinge[0], y: door.hinge[1] });
  const hingeId = group.id ?? group.nodeId ?? group.group!.id;
  await ctx.editor.call('reparent_objects', { operations: [{ objectId: leafId, newParentId: hingeId, position: 'start' }] });
  const xKey = await propertyKey(ctx, leafId, 'x'), yKey = await propertyKey(ctx, leafId, 'y');
  const current = await ctx.editor.call<{ values: Record<string, Record<string, number>> }>('query_property_values', { objectIds: [leafId], propertyKeys: [xKey, yKey] });
  const values = (current.values as any)[leafId] ?? current.values;
  await ctx.editor.call('set_property_values', { propertyValues: { [leafId]: { [xKey]: (values[xKey] ?? 0) - door.hinge[0], [yKey]: (values[yKey] ?? 0) - door.hinge[1] } } });
  ctx.ids.set(`hinge:${door.id}`, hingeId); ctx.ids.set(`leaf:${door.id}`, leafId); ctx.ids.set(`light:${door.id}`, await findId(ctx, LIGHT_ID[door.id]));
}

async function hitShapes(ctx: Ctx): Promise<void> {
  const shapes = ctx.plan.doors.map(door => ({ primitive: 'rectangle', name: `hit_${door.id}`, x: door.hit.x + door.hit.width / 2, y: door.hit.y + door.hit.height / 2, width: door.hit.width, height: door.hit.height, paints: [{ paintType: 'fill', color: '#00000000' }] }));
  const result = await ctx.editor.call<{ shapes?: Array<{ id: string; name: string }>; objects?: Array<{ id: string; name: string }> }>('path_editor', { command: 'createParametricShapes', data: { createParametricShapes: { shapes } } });
  for (const shape of result.shapes ?? result.objects ?? []) ctx.ids.set(`hit:${shape.name.replace('hit_', '')}`, shape.id);
  for (const door of ctx.plan.doors) if (!ctx.ids.has(`hit:${door.id}`)) ctx.ids.set(`hit:${door.id}`, await findId(ctx, `hit_${door.id}`));
}

async function viewModel(ctx: Ctx): Promise<void> {
  await ctx.editor.call('viewmodel_editor', { command: 'createDataEnums', data: { createDataEnums: { dataEnums: [{ name: ctx.plan.enum.name, values: [...ctx.plan.enum.values] }] } } });
  const created = await ctx.editor.call<{ viewModels: Array<{ id: string; name: string; properties?: Array<{ id: string; name: string }>; viewModelProperties?: Array<{ id: string; name: string }> }> }>('viewmodel_editor', { command: 'createViewModels', data: { createViewModels: { viewModels: [{ name: ctx.plan.viewModel.name, viewModelProperties: ctx.plan.viewModel.properties.map(p => p.type === 'enum' ? { name: p.name, propertyType: 'enum', enumName: ctx.plan.enum.name } : { name: p.name, propertyType: p.type }) }] } } });
  const vm = created.viewModels[0]!;
  const props: Record<string, string> = {};
  for (const p of vm.properties ?? vm.viewModelProperties ?? []) props[p.name] = p.id;
  if (Object.keys(props).length === 0) {
    const listed = await ctx.editor.call<{ viewModels: Array<{ id: string; name: string; properties: Array<{ id: string; name: string }> }> }>('viewmodel_editor', { command: 'listViewModels', data: { listViewModels: {} } });
    for (const p of listed.viewModels.find(v => v.id === vm.id)!.properties) props[p.name] = p.id;
  }
  ctx.vm = { id: vm.id, props };
  await ctx.editor.call('viewmodel_editor', { command: 'bindViewModelToArtboard', data: { bindViewModelToArtboard: { artboardId: ctx.artboardId, viewModelId: vm.id } } });
}

async function animations(ctx: Ctx): Promise<void> {
  const existing = await ctx.editor.call<{ animations?: Array<{ id: string; name: string }>; linearAnimations?: Array<{ id: string; name: string }> }>('animation_editor', { command: 'listLinearAnimations', data: { listLinearAnimations: {} } });
  const list = existing.animations ?? existing.linearAnimations ?? [];
  const [first, ...rest] = ctx.plan.animations;
  const pristine = list.find(a => a.name === 'Timeline');
  if (pristine) { await ctx.editor.call('animation_editor', { command: 'renameAnimations', data: { renameAnimations: { animations: [{ animationId: pristine.id, name: first!.name }] } } }); ctx.animations[first!.name] = pristine.id; }
  const toCreate = pristine ? rest : ctx.plan.animations;
  const created = await ctx.editor.call<{ animations?: Array<{ id: string; name: string }>; linearAnimations?: Array<{ id: string; name: string }> }>('animation_editor', { command: 'createLinearAnimations', data: { createLinearAnimations: { linearAnimations: toCreate.map(a => ({ name: a.name, duration: a.durationFrames })) } } });
  for (const a of created.animations ?? created.linearAnimations ?? []) ctx.animations[a.name] = a.id;
  for (const a of ctx.plan.animations) if (!ctx.animations[a.name]) throw new Error(`animation ${a.name} was not created`);
  for (const a of ctx.plan.animations) {
    const loopKey = await propertyKey(ctx, ctx.animations[a.name]!, 'loop').catch(() => null);
    if (loopKey !== null) await ctx.editor.call('set_property_values', { propertyValues: { [ctx.animations[a.name]!]: { [loopKey]: a.loop === 'oneShot' ? 0 : a.loop === 'loop' ? 1 : 2 } } });
    const add = [];
    for (const key of a.keys) {
      const objectId = ctx.ids.get(`${key.target}:${key.door}`)!;
      add.push({ objectId, propertyKey: await propertyKey(ctx, objectId, key.property), frame: key.frame, value: key.value, interpolationType: key.interpolation, ...(key.interpolation === 'cubic' ? { cubicParams: { x1: 0.42, y1: 0, x2: 0.2, y2: 1 } } : {}) });
    }
    await ctx.editor.call('animation_editor', { command: 'modifyKeyFrames', data: { modifyKeyFrames: { animationId: ctx.animations[a.name], add } } });
  }
}

async function stateMachine(ctx: Ctx): Promise<void> {
  const machines = await ctx.editor.call<{ stateMachines: Array<{ id: string; name: string; layers?: Array<{ id: string; name: string }> }> }>('animation_editor', { command: 'listStateMachines', data: { listStateMachines: {} } });
  const machine = machines.stateMachines[0] ?? (await ctx.editor.call<{ stateMachine: { id: string; name: string } }>('animation_editor', { command: 'createStateMachine', data: { createStateMachine: { name: 'Lobby Machine' } } })).stateMachine;
  ctx.stateMachineId = machine.id; ctx.stateMachineName = machine.name;
  const created = await ctx.editor.call<{ layers: Array<{ id: string; name: string; states?: Array<{ id: string; name: string }> }> }>('animation_editor', { command: 'createStateMachineLayers', data: { createStateMachineLayers: { stateMachineId: machine.id, layers: ctx.plan.layers.map(layer => ({ name: layer.name, states: layer.states.map((s, i) => ({ name: s.name, x: 120 + i * 220, y: 120, ...(s.animation ? { linearAnimationName: s.animation } : {}) })), otherTransitions: layer.transitions.map(t => ({ from: t.from, to: t.to })) })) } } });
  const full = await ctx.editor.call<any>('animation_editor', { command: 'queryStateMachine', data: { queryStateMachine: { stateMachineId: machine.id } } });
  const conditions: Array<{ id: string; conditions: any[] }> = [];
  for (const layer of ctx.plan.layers) {
    const live = (full.layers as any[]).find(l => l.name === layer.name);
    for (const t of layer.transitions) {
      if (!t.when) continue;
      const from = t.from === '{Any State}' ? 'Any State' : t.from;
      const liveT = (live.transitions ?? []).find((x: any) => (x.fromStateName ?? x.from) .replace(/[{}]/g, '') === from && (x.toStateName ?? x.to) === t.to) ?? (live.states ?? []).flatMap((s: any) => (s.transitions ?? []).map((x: any) => ({ ...x, fromStateName: s.name }))).find((x: any) => x.fromStateName.replace(/[{}]/g, '') === from && (x.toStateName ?? x.to) === t.to);
      if (!liveT) throw new Error(`transition ${t.from} → ${t.to} missing in layer ${layer.name}`);
      const propertyId = ctx.vm.props[t.when.property]!;
      conditions.push({ id: liveT.id, conditions: [t.when.equals === undefined ? { leftComparator: { viewModelPropertyId: propertyId } } : { leftComparator: { viewModelPropertyId: propertyId }, comparationOperation: 'equal', rightComparator: { valueType: 'constantValueType', value: t.when.equals } }] });
    }
  }
  await ctx.editor.call('animation_editor', { command: 'createConditions', data: { createConditions: { transitions: conditions } } });
  await ctx.editor.call('create_listeners', { stateMachineId: machine.id, listeners: ctx.plan.doors.flatMap(door => [
    { name: `hover_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['enter'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: door.id }] },
    { name: `leave_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['exit'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props.focus, value: 'none' }] },
    { name: `click_${door.id}`, targetId: ctx.ids.get(`hit:${door.id}`), listenerTypes: ['click'], actions: [{ type: 'viewModelChange', viewModelPropertyId: ctx.vm.props[`open${TITLE[door.id]}`] }] },
  ]) });
}

export async function authorLobby(replace = false): Promise<void> {
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
  if (existing && !replace) throw new Error(`Artboard ${plan.artboard} already exists; pass --replace to delete and rebuild it`);
  if (existing) await editor.call('delete_objects', { objectIds: [existing.id] });
  const created = await editor.call<{ artboards: Array<{ id: string; name: string }> }>('open_file_editor', { command: 'createArtboard', data: { createArtboard: [{ name: plan.artboard, width: plan.width, height: plan.height }] } });
  const artboardId = created.artboards[0]!.id;
  await editor.call('open_file_editor', { command: 'focusArtboard', data: { focusArtboard: { artboardId, fitToViewport: true } } });
  const ctx: Ctx = { editor, plan, artboardId, ids: new Map(), keys: new Map(), vm: { id: '', props: {} }, animations: {}, stateMachineId: '', stateMachineName: '' };
  const sceneAsset = await editor.uploadSvg(join(refinedDir, plan.scene.file), 'lobby-scene');
  await editor.call('assets_tool', { command: 'addSvgInstance', data: { addSvgInstance: { assetId: sceneAsset, name: plan.scene.nodeName, parentId: artboardId, x: 0, y: 0 } } });
  for (const door of plan.doors) await hinge(ctx, door);
  await hitShapes(ctx);
  await viewModel(ctx);
  await animations(ctx);
  await stateMachine(ctx);
  await editor.capture(plan.artboard, join(outDir, 'capture.png'));
  const exported = await editor.exportRiv(outDir);
  const finalPath = join(outDir, 'lobby.riv');
  if (exported.path !== finalPath) { if (existsSync(finalPath)) renameSync(finalPath, join(outDir, `lobby.previous.riv`)); renameSync(exported.path, finalPath); }
  const bytes = readFileSync(finalPath);
  writeFileSync(join(outDir, 'rive-manifest.json'), JSON.stringify({
    room: 'lobby', file: 'lobby.riv', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    artboard: plan.artboard, stateMachine: ctx.stateMachineName, viewModel: plan.viewModel.name, enum: { [plan.enum.name]: plan.enum.values },
    inputs: Object.fromEntries(plan.viewModel.properties.map(p => [p.name, p.type])), animations: plan.animations.map(a => a.name),
    doors: plan.doors, editor: { fileId: session.activeFileId, url: session.openTabs.find(t => t.isActive)?.url ?? '' }, authoredAt: new Date().toISOString(),
  }, null, 2) + '\n');
  console.log(`exported ${finalPath} (${bytes.length} bytes), state machine "${ctx.stateMachineName}", ${log.length} editor calls`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await authorLobby(process.argv.includes('--replace'));
}
```

- [ ] **Step 6: Run it against the editor (the target file must be active)**

Run: `npm run rive:author -- --room lobby`
Expected: prints the editor/file, then `exported …/scenes/rive/lobby/lobby.riv (N bytes)` with N well above 13; `capture.png` shows the lobby. Open `capture.png`. If any tool result's shape differs from what the code expects (ids under a different key), fix the accessor in `rive-author.ts`, run again with `--replace`, and do not hand-edit anything in the editor.

- [ ] **Step 7: Commit**

```bash
git add tools/rive-plan.ts tools/rive-author.ts tests/unit/rive-plan.test.ts scenes/rive/lobby
git commit -m "Author the lobby artboard through the editor MCP and export lobby.riv"
```

---

### Task 8: Verify the export headlessly

**Files:**
- Create: `tools/verify-riv.ts`
- Test: `tests/unit/verify-riv.test.ts`

**Interfaces:**
- Produces: `verifyRiv(room: RoomId): Promise<{ ok: true; artboard: string; animations: string[]; stateMachines: string[]; viewModelProperties: string[] }>`; throws with a precise message when the file disagrees with `rive-manifest.json`.

- [ ] **Step 1: Write the failing test**

`tests/unit/verify-riv.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { verifyRiv } from '../../tools/verify-riv.ts';

test('the exported lobby.riv matches its rive-manifest', { skip: !existsSync(new URL('../../scenes/rive/lobby/lobby.riv', import.meta.url)) }, async () => {
  const result = await verifyRiv('lobby');
  assert.equal(result.artboard, 'Lobby');
  for (const name of ['Ambient', 'DoorOpenIt', 'DoorOpenGovernment', 'DoorOpenCyber', 'FocusIt', 'FocusGovernment', 'FocusCyber']) assert.ok(result.animations.includes(name), `missing animation ${name}`);
  assert.equal(result.stateMachines.length, 1);
  for (const name of ['focus', 'openIt', 'openGovernment', 'openCyber', 'reducedMotion']) assert.ok(result.viewModelProperties.includes(name), `missing view-model property ${name}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/verify-riv.ts'`

- [ ] **Step 3: Write `tools/verify-riv.ts`**

```ts
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, type RoomId } from './kits.ts';

const require = createRequire(import.meta.url);

/** Loads the runtime file with the low-level Canvas WASM in Node (no DOM) and reads back what the editor exported. */
export async function verifyRiv(room: RoomId) {
  const dir = resolve(repoRoot, 'scenes/rive', room);
  const manifest = JSON.parse(readFileSync(resolve(dir, 'rive-manifest.json'), 'utf8'));
  const bytes = readFileSync(resolve(dir, manifest.file));
  if (bytes.subarray(0, 4).toString() !== 'RIVE') throw new Error('not a RIVE file');
  const RiveCanvas = (await import('@rive-app/canvas-advanced')).default as (options: { locateFile: (file: string) => string }) => Promise<any>;
  const rive = await RiveCanvas({ locateFile: file => require.resolve(`@rive-app/canvas-advanced/${file}`) });
  const file = await rive.load(new Uint8Array(bytes));
  const artboard = file.artboardByName(manifest.artboard);
  if (!artboard) throw new Error(`artboard ${manifest.artboard} not in ${manifest.file}`);
  const animations: string[] = []; for (let i = 0; i < artboard.animationCount(); i++) animations.push(artboard.animationByIndex(i).name);
  const stateMachines: string[] = []; for (let i = 0; i < artboard.stateMachineCount(); i++) stateMachines.push(artboard.stateMachineByIndex(i).name);
  const viewModel = file.viewModelByName ? file.viewModelByName(manifest.viewModel) : null;
  const viewModelProperties: string[] = viewModel ? (viewModel.getProperties?.() ?? viewModel.properties ?? []).map((p: any) => p.name) : [];
  for (const name of manifest.animations) if (!animations.includes(name)) throw new Error(`animation ${name} missing; file has ${animations.join(', ')}`);
  if (!stateMachines.includes(manifest.stateMachine)) throw new Error(`state machine ${manifest.stateMachine} missing; file has ${stateMachines.join(', ')}`);
  for (const name of Object.keys(manifest.inputs)) if (!viewModelProperties.includes(name)) throw new Error(`view-model property ${name} missing; file has ${viewModelProperties.join(', ')}`);
  file.delete?.(); rive.cleanup?.();
  return { ok: true as const, artboard: manifest.artboard, animations, stateMachines, viewModelProperties };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const result = await verifyRiv((index > 0 ? process.argv[index + 1] : 'lobby') as RoomId);
  console.log(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS. If `@rive-app/canvas-advanced` refuses to initialize in Node (`window is not defined`), shim before import — `Object.assign(globalThis, { window: globalThis, self: globalThis })` — and re-run. If `viewModelByName` is absent in 2.42.1, read `file.viewModelCount()` / `file.viewModelByIndex(i)` instead and adapt; the assertion on property names stays.

- [ ] **Step 5: Commit**

```bash
git add tools/verify-riv.ts tests/unit/verify-riv.test.ts
git commit -m "Verify exported .riv files headlessly against their manifest"
```

---

### Task 9: Truth projection and web app shell

**Files:**
- Create: `tools/import-truth.ts`, `apps/web/src/truth/projection.json` (generated), `apps/web/src/truth/index.ts`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/components/Footer.tsx`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/styles/layout.css`, `apps/web/src/rooms/{it-services,government-solutions,cybersecurity}/Room.tsx`, `apps/web/src/rooms/contact/Contact.tsx`
- Test: `tests/unit/truth.test.ts`

**Interfaces:**
- Produces `projection.json`:
  ```json
  { "schema": "tdg-site-truth/v1", "sourceCommit": "<git sha of ~/Code/thatdeveloperguy-truth>", "importedAt": "",
    "org": { "id": "https://thatdeveloperguy.com/#organization", "name": "ThatDeveloperGuy", "legalName": "THATDEVELOPERGUY LLC", "telephone": "+14176712606", "telephoneDisplay": "", "email": "admin@thatdeveloperguy.com", "foundingDate": "2017", "address": {}, "sameAs": [] },
    "person": { "id": "https://thatdeveloperguy.com/#person", "name": "Joseph W. Anady", "jobTitle": "Founder and Principal Engineer", "url": "https://feedthejoe.com/joseph/" },
    "host": { "host": "thatdeveloperguy.com", "role": "<properties.hosts[].role verbatim>" },
    "ownerToSupply": ["CAGE code", "SAM.gov Active date", "SBA VetCert status", "NAICS approval", "PSC codes", "Named past-performance clients"] }
  ```
  and `export const truth: Projection` from `apps/web/src/truth/index.ts`.

- [ ] **Step 1: Write the failing test**

`tests/unit/truth.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../../tools/import-truth.ts';

test('project copies node wording verbatim and lists what only the owner can supply', () => {
  const node = { canonicalHost: 'https://thatdeveloperguy.com/', org: { '@id': 'https://thatdeveloperguy.com/#organization', name: 'ThatDeveloperGuy', legalName: 'THATDEVELOPERGUY LLC', telephone: '+14176712606', telephoneDisplay: '417 671 2606', email: 'admin@thatdeveloperguy.com', foundingDate: '2017', address: { addressLocality: 'Cassville', addressRegion: 'MO' }, sameAs: ['https://www.wikidata.org/wiki/Q139709771'] }, person: { '@id': 'https://thatdeveloperguy.com/#person', name: 'Joseph W. Anady', jobTitle: 'Founder and Principal Engineer', url: 'https://feedthejoe.com/joseph/' }, properties: { hosts: [{ host: 'thatdeveloperguy.com', role: 'the main face' }] } };
  const p = project(node as any, 'abc123');
  assert.equal(p.schema, 'tdg-site-truth/v1'); assert.equal(p.sourceCommit, 'abc123');
  assert.equal(p.org.legalName, 'THATDEVELOPERGUY LLC'); assert.equal(p.org.telephoneDisplay, '417 671 2606');
  assert.equal(p.person.jobTitle, 'Founder and Principal Engineer');
  assert.equal(p.host.role, 'the main face');
  assert.ok(p.ownerToSupply.includes('CAGE code'));
  assert.equal(JSON.stringify(p).includes('SDVOSB'), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../tools/import-truth.ts'`

- [ ] **Step 3: Write `tools/import-truth.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './kits.ts';

export const NODE_ROOT = '/Users/josephanady/Code/thatdeveloperguy-truth';
export const OWNER_TO_SUPPLY = ['CAGE code', 'SAM.gov Active date', 'SBA VetCert status', 'NAICS approval', 'PSC codes', 'Named past-performance clients'] as const;

export interface Projection {
  schema: 'tdg-site-truth/v1'; sourceCommit: string; importedAt: string;
  org: { id: string; name: string; legalName: string; telephone: string; telephoneDisplay: string; email: string; foundingDate: string; address: Record<string, string>; sameAs: string[] };
  person: { id: string; name: string; jobTitle: string; url: string };
  host: { host: string; role: string };
  ownerToSupply: string[];
}

/** Copies fields verbatim; never derives, rewrites or "improves" wording. */
export function project(node: any, sourceCommit: string): Projection {
  const host = (node.properties?.hosts ?? []).find((h: any) => h.host === 'thatdeveloperguy.com') ?? { host: 'thatdeveloperguy.com', role: '' };
  return {
    schema: 'tdg-site-truth/v1', sourceCommit, importedAt: new Date().toISOString(),
    org: { id: node.org['@id'], name: node.org.name, legalName: node.org.legalName, telephone: node.org.telephone, telephoneDisplay: node.org.telephoneDisplay ?? '', email: node.org.email, foundingDate: String(node.org.foundingDate ?? ''), address: node.org.address ?? {}, sameAs: node.org.sameAs ?? [] },
    person: { id: node.person['@id'], name: node.person.name, jobTitle: node.person.jobTitle, url: node.person.url },
    host: { host: host.host, role: host.role },
    ownerToSupply: [...OWNER_TO_SUPPLY],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const node = JSON.parse(readFileSync(resolve(NODE_ROOT, 'organization.json'), 'utf8'));
  const commit = execFileSync('git', ['-C', NODE_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const out = resolve(repoRoot, 'apps/web/src/truth'); mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'projection.json'), JSON.stringify(project(node, commit), null, 2) + '\n');
  console.log(`truth projected from ${NODE_ROOT}@${commit.slice(0, 8)}`);
}
```

- [ ] **Step 4: Run the test and the import**

Run: `npm test && npm run truth && cat apps/web/src/truth/projection.json`
Expected: PASS; the JSON shows the org/person fields above with the node's wording.

- [ ] **Step 5: Write the app shell**

`apps/web/src/truth/index.ts`:
```ts
import projection from './projection.json';
export type Projection = typeof projection;
export const truth: Projection = projection;
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ThatDeveloperGuy — Government IT. Security. Real solutions.</title>
    <meta name="description" content="ThatDeveloperGuy LLC — IT services, government solutions and cybersecurity from Cassville, Missouri." />
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&family=Archivo+Black&display=swap" />
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import './styles/tokens.css'; import './styles/base.css'; import './styles/layout.css';
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
```

`apps/web/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Lobby } from './rooms/lobby/Lobby';
import { Room as ITServices } from './rooms/it-services/Room';
import { Room as GovernmentSolutions } from './rooms/government-solutions/Room';
import { Room as Cybersecurity } from './rooms/cybersecurity/Room';
import { Contact } from './rooms/contact/Contact';

export function App() {
  return (
    <>
      <Header />
      <main id="content">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/it-services/" element={<ITServices />} />
          <Route path="/government-solutions/" element={<GovernmentSolutions />} />
          <Route path="/cybersecurity/" element={<Cybersecurity />} />
          <Route path="/contact/" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
```

`apps/web/src/components/Header.tsx`:
```tsx
import { Link } from 'react-router';
import { truth } from '../truth';
export function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="site-brand" aria-label={`${truth.org.name} — lobby`}>thatdeveloper<span>guy</span>.com</Link>
      <nav aria-label="Rooms" className="site-nav">
        <Link to="/it-services/">IT Services</Link><Link to="/government-solutions/">Government Solutions</Link><Link to="/cybersecurity/">Cybersecurity</Link><Link to="/contact/" className="site-nav-cta">Request a briefing</Link>
      </nav>
    </header>
  );
}
```

`apps/web/src/components/Footer.tsx`:
```tsx
import { truth } from '../truth';
export function Footer() {
  const a = truth.org.address;
  return (
    <footer className="site-footer">
      <p><strong>{truth.org.legalName}</strong> · {a.addressLocality}, {a.addressRegion} · <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> · <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a></p>
      <p className="site-footer-note">Founded {truth.org.foundingDate}. Registry identifiers the owner still has to supply are marked on the pages that need them.</p>
    </footer>
  );
}
```

`apps/web/src/styles/tokens.css`:
```css
:root {
  --paper: #f4f1fa; --lavender: #d9d1ea; --purple: #4a2f8a; --purple-deep: #2f1f5e; --ink: #2a1f4a; --status: #33c26b;
  --font-body: 'Public Sans', system-ui, sans-serif; --font-display: 'Archivo Black', 'Public Sans', sans-serif;
  --header-h: 64px; --room-w: 1648; --room-h: 928;
}
```

`apps/web/src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: light; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-body); line-height: 1.5; }
a { color: var(--purple); }
h1, h2, h3 { font-family: var(--font-display); font-weight: 400; letter-spacing: -0.01em; line-height: 1.1; margin: 0 0 .5em; }
:focus-visible { outline: 3px dashed var(--purple); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

`apps/web/src/styles/layout.css`:
```css
.site-header { position: sticky; top: 0; z-index: 10; height: var(--header-h); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: rgba(244, 241, 250, .92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--lavender); }
.site-brand { font-family: var(--font-display); font-size: 1.15rem; color: var(--ink); text-decoration: none; } .site-brand span { color: var(--purple); }
.site-nav { display: flex; gap: 20px; } .site-nav a { text-decoration: none; font-weight: 600; } .site-nav-cta { padding: 8px 14px; border-radius: 999px; background: var(--purple); color: #fff !important; }
.room-overview { max-width: 1100px; margin: 0 auto; padding: 56px 24px; display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.owner-to-supply { border: 2px dashed var(--purple); border-radius: 8px; padding: 12px 16px; background: #fff; }
.site-footer { padding: 32px 24px; border-top: 1px solid var(--lavender); font-size: .95rem; } .site-footer-note { color: #5c4d85; }
@media (max-width: 767px) { .site-nav { display: none; } }
```

Placeholder rooms — `apps/web/src/rooms/it-services/Room.tsx` (and the same file body with the title changed for `government-solutions` → "Government Solutions", `cybersecurity` → "Cybersecurity"):
```tsx
import { Link } from 'react-router';
export function Room() {
  return (
    <section className="room-overview" aria-labelledby="room-title">
      <div><h1 id="room-title">IT Services</h1><p>This room is built in the next plan. <Link to="/">Return to the lobby</Link>.</p></div>
    </section>
  );
}
```

`apps/web/src/rooms/contact/Contact.tsx`:
```tsx
import { useSearchParams } from 'react-router';
import { truth } from '../../truth';
export function Contact() {
  const [params] = useSearchParams();
  const project = params.get('project') ?? 'general';
  return (
    <section className="room-overview" aria-labelledby="contact-title">
      <div>
        <h1 id="contact-title">Request a briefing</h1>
        <p>Intent: <code>{project}</code>. The mail service is wired in the next plan; until then call <a href={`tel:${truth.org.telephone}`}>{truth.org.telephoneDisplay || truth.org.telephone}</a> or write to <a href={`mailto:${truth.org.email}`}>{truth.org.email}</a>.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Typecheck and start the dev server once**

Run: `npm run typecheck && (npm run dev & sleep 4; curl -s http://127.0.0.1:4410/ | head -5; kill %1)`
Expected: no type errors (the lobby import will fail until Task 10 — create `apps/web/src/rooms/lobby/Lobby.tsx` exporting `export function Lobby() { return <p>lobby</p>; }` for now); the HTML shell is served.

- [ ] **Step 7: Commit**

```bash
git add tools/import-truth.ts tests/unit/truth.test.ts apps/web
git commit -m "Truth projection from the node; React app shell, routes and tokens"
```

---

### Task 10: The stage — poster, Rive, hit shapes, caption

**Files:**
- Create: `scripts/sync-rive-wasm.mjs`, `scripts/sync-scenes.mjs`, `apps/web/src/animation/rive/RiveScene.tsx`, `apps/web/src/animation/stage/SceneStage.tsx`, `apps/web/src/styles/stage.css`, `apps/web/src/rooms/lobby/hotspots.ts`, `apps/web/src/rooms/lobby/content.ts`, `apps/web/src/rooms/lobby/Lobby.tsx`
- Test: `tests/unit/hotspots.test.ts`

**Interfaces:**
- `RiveScene` props: `{ src: string; artboard: string; stateMachine: string; viewModel: string; focus: string; reducedMotion: boolean; fire: { name: string; nonce: number } | null; onReady(): void; onError(error: unknown): void }` — writes `focus` to the enum property whenever it changes, sets `reducedMotion`, fires the trigger named `fire.name` each time `fire.nonce` changes.
- `SceneStage` props: `{ poster: string; rive: { src: string; artboard: string; stateMachine: string; viewModel: string } | null; hotspots: Hotspot[]; caption: (id: string | null) => string; onActivate(h: Hotspot): Promise<void> | void; label: string }` where `interface Hotspot { id: string; label: string; href: string; hit: { x: number; y: number; width: number; height: number }; focusValue: string; trigger: string }`.
- `hotspots.ts`: `export const LOBBY_HOTSPOTS: Hotspot[]` derived from `scenes/rive/lobby/rive-manifest.json` `doors[]` at import time.
- `sync-scenes.mjs` copies `scenes/refined/lobby/scene.svg` → `apps/web/public/scenes/lobby/scene.svg` and `scenes/rive/lobby/lobby.riv` + `rive-manifest.json` → `apps/web/public/scenes/lobby/`; `sync-rive-wasm.mjs` copies the version-matched `@rive-app/webgl2` `rive.wasm` to `apps/web/public/animation/runtime/rive.wasm` (the TSC script, path adjusted).

- [ ] **Step 1: Write the failing test**

`tests/unit/hotspots.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotspotsFromManifest } from '../../apps/web/src/rooms/lobby/hotspots.ts';

test('lobby hotspots come from the rive manifest doors, with focus values and triggers', () => {
  const list = hotspotsFromManifest({ doors: [{ id: 'it', leafId: 'door_it_leaf', hinge: [564, 529], hit: { x: 542, y: 229, width: 176, height: 302 }, href: '/it-services/', label: 'IT SERVICES' }] } as any);
  assert.deepEqual(list, [{ id: 'it', label: 'IT SERVICES', href: '/it-services/', hit: { x: 542, y: 229, width: 176, height: 302 }, focusValue: 'it', trigger: 'openIt' }]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../apps/web/src/rooms/lobby/hotspots.ts'`

- [ ] **Step 3: Write the sync scripts and run them**

`scripts/sync-rive-wasm.mjs`:
```js
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const reactEntry = require.resolve('@rive-app/react-webgl2');
const runtimeEntry = createRequire(reactEntry).resolve('@rive-app/webgl2');
let dir = dirname(runtimeEntry);
while (!existsSync(join(dir, 'package.json'))) { const parent = dirname(dir); if (parent === dir) throw new Error('runtime package root not found'); dir = parent; }
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
if (pkg.name !== '@rive-app/webgl2') throw new Error('unexpected runtime package');
const out = 'apps/web/public/animation/runtime'; mkdirSync(out, { recursive: true });
copyFileSync(join(dir, 'rive.wasm'), join(out, 'rive.wasm'));
writeFileSync(join(out, 'version.json'), JSON.stringify({ name: pkg.name, version: pkg.version, wasmSHA256: createHash('sha256').update(readFileSync(join(dir, 'rive.wasm'))).digest('hex') }, null, 2));
console.log(`self-hosted Rive WebGL2 runtime ${pkg.version}`);
```

`scripts/sync-scenes.mjs`:
```js
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
for (const room of ['lobby']) {
  const out = `apps/web/public/scenes/${room}`; mkdirSync(out, { recursive: true });
  copyFileSync(`scenes/refined/${room}/scene.svg`, `${out}/scene.svg`);
  for (const file of [`${room}.riv`, 'rive-manifest.json']) if (existsSync(`scenes/rive/${room}/${file}`)) copyFileSync(`scenes/rive/${room}/${file}`, `${out}/${file}`);
  console.log(`synced ${room}`);
}
```

Run: `npm run sync`
Expected: both scripts print; `apps/web/public/scenes/lobby/{scene.svg,lobby.riv,rive-manifest.json}` and `apps/web/public/animation/runtime/rive.wasm` exist.

- [ ] **Step 4: Write `hotspots.ts`, `content.ts`, `RiveScene.tsx`, `SceneStage.tsx`, `stage.css`, `Lobby.tsx`**

`apps/web/src/rooms/lobby/hotspots.ts`:
```ts
import manifest from '../../../../../scenes/rive/lobby/rive-manifest.json';

export interface Hotspot { id: string; label: string; href: string; hit: { x: number; y: number; width: number; height: number }; focusValue: string; trigger: string }
interface DoorRecord { id: string; leafId: string; hinge: [number, number]; hit: Hotspot['hit']; href: string; label: string }
const TITLE: Record<string, string> = { it: 'It', government: 'Government', cyber: 'Cyber' };

export function hotspotsFromManifest(m: { doors: DoorRecord[] }): Hotspot[] {
  return m.doors.map(door => ({ id: door.id, label: door.label, href: door.href, hit: door.hit, focusValue: door.id, trigger: `open${TITLE[door.id] ?? door.id}` }));
}
export const LOBBY_HOTSPOTS = hotspotsFromManifest(manifest as any);
export const LOBBY_RIVE = { src: `/scenes/lobby/${(manifest as any).file}`, artboard: (manifest as any).artboard as string, stateMachine: (manifest as any).stateMachine as string, viewModel: (manifest as any).viewModel as string };
```

`apps/web/src/rooms/lobby/content.ts`:
```ts
/** Lobby copy. Wording that describes the organization comes from the node projection; these are room captions only. */
export const LOBBY_CAPTIONS: Record<string, string> = {
  it: 'IT Services — support, endpoints, infrastructure and deployment.',
  government: 'Government Solutions — planning, requirements, contracting and delivery.',
  cyber: 'Cyber Security — monitoring, review, response and infrastructure protection.',
};
export const LOBBY_REST_CAPTION = 'Three doors. Pick the room you need.';
```

`apps/web/src/animation/rive/RiveScene.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { useRive, Layout, Fit, Alignment, RuntimeLoader, useViewModel, useViewModelInstance, useViewModelInstanceEnum, useViewModelInstanceBoolean, useViewModelInstanceTrigger } from '@rive-app/react-webgl2';

if (typeof window !== 'undefined') { RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm'); RuntimeLoader.setWasmFallbackUrl(null); }

export interface RiveSceneProps { src: string; artboard: string; stateMachine: string; viewModel: string; focus: string; reducedMotion: boolean; fire: { name: string; nonce: number } | null; onReady: () => void; onError: (error: unknown) => void }

/** Plays a room's state machine and mirrors page state into its view model. Pointer events never reach this canvas; the HTML overlay owns them. */
export function RiveScene({ src, artboard, stateMachine, viewModel, focus, reducedMotion, fire, onReady, onError }: RiveSceneProps) {
  const callbacks = useRef({ onReady, onError }); callbacks.current = { onReady, onError };
  const { rive, RiveComponent } = useRive({ src, artboard, stateMachines: stateMachine, autoplay: true, autoBind: true, enableRiveAssetCDN: false, shouldDisableRiveListeners: true, layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }), onLoad: () => callbacks.current.onReady(), onLoadError: e => callbacks.current.onError(e) }, { shouldResizeCanvasToContainer: true, useDevicePixelRatio: true });
  const model = useViewModel(rive, { name: viewModel });
  const instance = useViewModelInstance(model, { rive });
  const focusProperty = useViewModelInstanceEnum('focus', instance);
  const reduced = useViewModelInstanceBoolean('reducedMotion', instance);
  const trigger = useViewModelInstanceTrigger(fire?.name ?? 'openIt', instance);
  useEffect(() => { focusProperty.setValue(focus); }, [focus, focusProperty.setValue]);
  useEffect(() => { reduced.setValue(reducedMotion); }, [reducedMotion, reduced.setValue]);
  useEffect(() => { if (fire) trigger.trigger(); }, [fire?.nonce]);
  return <div className="stage-rive" aria-hidden="true"><RiveComponent /></div>;
}
```
Before relying on the hook names, run `grep -o "export declare function useViewModel[A-Za-z]*" node_modules/@rive-app/react-webgl2/dist/types/index.d.ts` (or the package README) and match exactly; if `useViewModelInstanceTrigger` needs `{ onTrigger }`, keep the call shape it documents.

`apps/web/src/animation/stage/SceneStage.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { RiveScene } from '../rive/RiveScene';
import type { Hotspot } from '../../rooms/lobby/hotspots';
import '../../styles/stage.css';

export interface SceneStageProps { poster: string; rive: { src: string; artboard: string; stateMachine: string; viewModel: string } | null; hotspots: Hotspot[]; caption: (id: string | null) => string; onActivate: (h: Hotspot) => Promise<void> | void; label: string; focus: string | null; onFocus: (id: string | null) => void; fire: { name: string; nonce: number } | null }

/** 1648×928 room coordinates mapped to the stage; poster underneath, Rive on top, real links on top of that. */
export function SceneStage({ poster, rive, hotspots, caption, onActivate, label, focus, onFocus, fire }: SceneStageProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const u = () => setReducedMotion(m.matches); u(); m.addEventListener('change', u); return () => m.removeEventListener('change', u); }, []);
  const activate = useCallback((event: React.MouseEvent, h: Hotspot) => { event.preventDefault(); void onActivate(h); }, [onActivate]);
  return (
    <section className={`stage${ready ? ' stage-live' : ''}`} aria-label={label} data-focus={focus ?? ''}>
      <div className="stage-frame">
        <img className="stage-poster" src={poster} alt="" width={1648} height={928} decoding="async" />
        {rive && !failed && !reducedMotion && <RiveScene {...rive} focus={focus ?? 'none'} reducedMotion={reducedMotion} fire={fire} onReady={() => setReady(true)} onError={() => setFailed(true)} />}
        <svg className="stage-hits" viewBox="0 0 1648 928" role="navigation" aria-label={`${label} destinations`}>
          {hotspots.map(h => (
            <Link key={h.id} to={h.href} aria-label={h.label} className="stage-hit" data-hit={h.id} onMouseEnter={() => onFocus(h.id)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(h.id)} onBlur={() => onFocus(null)} onClick={e => activate(e, h)}>
              <rect x={h.hit.x} y={h.hit.y} width={h.hit.width} height={h.hit.height} rx={6} />
            </Link>
          ))}
        </svg>
      </div>
      <p className="stage-caption" aria-live="polite">{caption(focus)}</p>
    </section>
  );
}
```
`react-router`'s `Link` renders an `<a>`; inside an SVG it must be an SVG anchor. If React warns about `<a>` inside `<svg>`, replace `Link` with a plain `<a href={h.href} …>` and call `navigate(h.href)` from `onActivate`.

`apps/web/src/styles/stage.css`:
```css
.stage { position: relative; min-height: calc(100svh - var(--header-h)); display: grid; grid-template-rows: 1fr auto; background: var(--lavender); }
.stage-frame { position: relative; aspect-ratio: 1648 / 928; max-height: calc(100svh - var(--header-h) - 48px); margin: 0 auto; width: min(100%, calc((100svh - var(--header-h) - 48px) * 1648 / 928)); overflow: hidden; }
.stage-poster, .stage-rive, .stage-hits { position: absolute; inset: 0; width: 100%; height: 100%; }
.stage-poster { display: block; object-fit: cover; }
.stage-rive { opacity: 0; transition: opacity .4s ease; pointer-events: none; } .stage-live .stage-rive { opacity: 1; }
.stage-rive canvas { width: 100% !important; height: 100% !important; display: block; }
.stage-hits { z-index: 2; } .stage-hit { cursor: pointer; } .stage-hit rect { fill: transparent; stroke: transparent; stroke-width: 3; stroke-dasharray: 8 6; }
.stage-hit:focus-visible { outline: none; } .stage-hit:focus-visible rect { stroke: var(--purple); }
.stage-caption { margin: 0; padding: 12px 24px; text-align: center; font-weight: 600; color: var(--purple-deep); min-height: 48px; }
@media (max-width: 767px) { .stage-frame { max-height: none; width: 100%; } .stage-rive { display: none; } }
```

`apps/web/src/rooms/lobby/Lobby.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { SceneStage } from '../../animation/stage/SceneStage';
import { LOBBY_HOTSPOTS, LOBBY_RIVE, type Hotspot } from './hotspots';
import { LOBBY_CAPTIONS, LOBBY_REST_CAPTION } from './content';
import { truth } from '../../truth';

const DOOR_OPEN_MS = 26 / 60 * 1000 + 120;

export function Lobby() {
  const navigate = useNavigate();
  const [focus, setFocus] = useState<string | null>(null);
  const [fire, setFire] = useState<{ name: string; nonce: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const activate = useCallback(async (h: Hotspot) => {
    if (leaving) return; setLeaving(true);
    setFocus(h.id); setFire({ name: h.trigger, nonce: Date.now() });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(r => setTimeout(r, reduced ? 0 : DOOR_OPEN_MS));
    navigate(h.href);
  }, [leaving, navigate]);
  return (
    <>
      <h1 className="sr-only">{truth.org.name} — {truth.host.role}</h1>
      <SceneStage poster="/scenes/lobby/scene.svg" rive={LOBBY_RIVE} hotspots={LOBBY_HOTSPOTS} label="Lobby" focus={focus} onFocus={id => { if (!leaving) setFocus(id); }} fire={fire} onActivate={activate} caption={id => (id ? LOBBY_CAPTIONS[id] ?? '' : LOBBY_REST_CAPTION)} />
      <section className="room-overview" aria-label="About this organization">
        <div><h2>{truth.org.name}</h2><p>{truth.org.legalName}, founded {truth.org.foundingDate}, {truth.org.address.addressLocality}, {truth.org.address.addressRegion}.</p><p>{truth.person.name}, {truth.person.jobTitle}.</p></div>
        <div className="owner-to-supply"><h2>Registry facts to be supplied by the owner</h2><ul>{truth.ownerToSupply.map(item => <li key={item}>{item}</li>)}</ul></div>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Run the unit tests, typecheck, and look at it**

Run: `npm test && npm run typecheck && npm run dev`
Then open `http://127.0.0.1:4410/` in Chrome. Expected: header, the refined lobby as poster, then the Rive canvas fading in over it (same geometry — no jump), the caption changing on hover over each door, dashed focus ring on Tab, and a click on a door opening it and landing on the placeholder room. Check the console for Rive load errors; if `useViewModelInstanceEnum` rejects the value, confirm the enum value keys in `rive-manifest.json` (`none`, `it`, `government`, `cyber`).

- [ ] **Step 6: Commit**

```bash
git add scripts apps/web/src tests/unit/hotspots.test.ts
git commit -m "Scene stage: poster, Rive view-model bridge, hit-shape links, caption; lobby route"
```

---

### Task 11: Browser tests and fps measurement

**Files:**
- Create: `playwright.config.ts`, `tests/browser/lobby.spec.ts`, `tools/shots.ts`

- [ ] **Step 1: Write the Playwright config and the failing spec**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser', timeout: 30_000, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4410', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4410', reuseExistingServer: true, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }, { name: 'mobile', use: { ...devices['iPhone 14'] } }],
});
```

`tests/browser/lobby.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the lobby shows the poster and three real door links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-poster')).toBeVisible();
  const doors = page.locator('.stage-hit');
  await expect(doors).toHaveCount(3);
  await expect(doors.nth(0)).toHaveAttribute('href', '/it-services/');
  await expect(doors.nth(1)).toHaveAttribute('href', '/government-solutions/');
  await expect(doors.nth(2)).toHaveAttribute('href', '/cybersecurity/');
});

test('hovering a door names it in the caption; keyboard reaches every door', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is desktop-only');
  await page.goto('/');
  await page.locator('.stage-hit[data-hit="government"]').hover();
  await expect(page.locator('.stage-caption')).toContainText('Government Solutions');
  await page.keyboard.press('Tab'); // brand
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); if (await page.locator('.stage-hit:focus').count()) break; }
  await expect(page.locator('.stage-hit:focus')).toHaveCount(1);
});

test('clicking the IT door opens it and navigates', async ({ page }) => {
  await page.goto('/');
  await page.locator('.stage-hit[data-hit="it"]').click();
  await expect(page).toHaveURL(/\/it-services\/$/, { timeout: 5000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('IT Services');
});

test('the lobby has no axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
});
```

- [ ] **Step 2: Install browsers and run the spec**

Run: `npx playwright install chromium webkit && npm run test:browser`
Expected: all four tests pass on chromium and webkit, the first/third/fourth on mobile. Fix real failures in the app, not the tests; an axe "region" complaint on the stage means the `<section aria-label>` is missing.

- [ ] **Step 3: Write `tools/shots.ts`**

```ts
/** Frames and fps of `/` in headless Chrome with the real GPU:  node --import tsx tools/shots.ts [--cpu 4] */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1]! : d; };
const BASE = arg('--base', 'http://127.0.0.1:4410'), CPU = Number(arg('--cpu', '1')), OUT = arg('--out', 'shots/lobby'), W = 1440, H = 900;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) throw new Error('Google Chrome not found');
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'tdg-shots-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', `--window-size=${W},${H}`, '--hide-scrollbars', '--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'], { stdio: 'ignore' });
const portFile = join(profile, 'DevToolsActivePort');
for (let i = 0; i < 100 && !existsSync(portFile); i++) await new Promise(r => setTimeout(r, 100));
const port = readFileSync(portFile, 'utf8').split('\n')[0]!.trim();
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json() as { webSocketDebuggerUrl: string };
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', rej); });
let id = 0; const waits = new Map<number, (v: any) => void>();
ws.addEventListener('message', e => { const m = JSON.parse(String(e.data)); if (m.id && waits.has(m.id)) { waits.get(m.id)!(m); waits.delete(m.id); } });
const send = (method: string, params: Record<string, unknown> = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise<any>(r => waits.set(n, r)); };
const ev = async (expr: string) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name: string) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(OUT, `${name}.jpg`), Buffer.from(r.result.data, 'base64')); };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: CPU });
await send('Page.navigate', { url: `${BASE}/` });
await wait(1500); await shot('00-arrive'); await wait(1500); await shot('01-live');
const renderer = await ev(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl2'; })()`);
const live = await ev(`document.querySelector('.stage-live') !== null`);
await ev(`document.querySelector('.stage-hit[data-hit="government"]').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))`); await wait(400); await shot('02-focus-government');
const fps = await ev(`(async () => { const t0 = performance.now(); let f = 0; await new Promise(r => { const tick = () => { f++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else r(); }; requestAnimationFrame(tick); }); return Math.round(f / ((performance.now() - t0) / 1000)); })()`);
const result = { renderer, riveLive: live, cpu: CPU, fpsIdle: fps, at: new Date().toISOString() };
writeFileSync(join(OUT, `fps-${CPU}x.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
ws.close(); chrome.kill(); await new Promise(r => chrome.once('exit', r)); rmSync(profile, { recursive: true, force: true });
if (!live) { console.error('Rive did not go live in headless Chrome'); process.exit(1); }
if (fps < (CPU >= 4 ? 30 : 55)) { console.error(`fps ${fps} below the bar`); process.exit(1); }
```

- [ ] **Step 4: Measure at 1× and 4×**

Run: `npm run dev & sleep 4; npm run shots; npm run shots -- --cpu 4; kill %1`
Expected: `riveLive: true`, `fpsIdle ≥ 55` at 1× and `≥ 30` at 4×; three JPEGs in `shots/lobby/`. If fps is below the bar, the refined scene is too heavy for the runtime: raise `DEFAULT_REFINE.tolerance` to 1.0 and `minArea` to 6, re-run `npm run refine -- --room lobby`, `npm run rive:author -- --room lobby --replace`, `npm run rive:verify`, `npm run sync`, and measure again. Record the final numbers in the commit message.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/browser/lobby.spec.ts tools/shots.ts
git commit -m "Browser tests (nav, keyboard, axe) and headless fps measurement for the lobby"
```

---

### Task 12: Hand-off for the owner's verdict

- [ ] **Step 1: Run the full verification in order**

Run: `npm test && npm run typecheck && npm run rive:verify && npm run test:browser`
Expected: all green.

- [ ] **Step 2: Start the dev server for Joseph and report**

Run: `npm run dev`
Report in chat (no report file): the URL `http://127.0.0.1:4410/`, before→after vertex counts and diff ratio from `scenes/refined/lobby/manifest.json`, `lobby.riv` size, state-machine/input names from `rive-manifest.json`, fps at 1× and 4×, the editor URL of the file, and what Plan 2 covers (three rooms, mascot rig, walk-through, contact API, prerender, release). Do not start Plan 2 until Joseph has judged the lobby in Chrome.

---

## Self-review

- Spec coverage: repo layout (T1, T9), vector pipeline steps 1–6 (T3–T5), Rive authoring steps 1–7 for the lobby (T7), headless verification (T8), truth projection + owner placeholders (T9), stage with poster/Rive/hit shapes/caption, door click → trigger → navigate, reduced motion, mobile poster (T10), browser gates + fps (T11). Mascot rig, rooms 2–4, contact API, prerender, release: Plan 2 by design.
- Type consistency: `RefinedManifest` (T5) is consumed by `planLobby` (T7); `Hotspot` (T10) is produced by `hotspotsFromManifest` and consumed by `SceneStage`; `rive-manifest.json` fields written in T7 are read in T8 and T10 with the same names (`file`, `artboard`, `stateMachine`, `viewModel`, `inputs`, `animations`, `doors`).
- Known editor-shape uncertainty is isolated in `rive-author.ts` accessors (ids under `id`/`nodeId`/`group.id`, `properties`/`viewModelProperties`, `animations`/`linearAnimations`) and in the `@rive-app/react-webgl2` view-model hook names; both tasks say to confirm against the live tool result / package types before trusting the code.

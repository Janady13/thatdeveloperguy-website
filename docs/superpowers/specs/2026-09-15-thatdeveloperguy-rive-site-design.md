# thatdeveloperguy.com — illustrated Rive site (design, 2026-09-15)

Owner decision (Joseph, 2026-09-15): thatdeveloperguy.com is rebuilt the way thatstupidcomputer.com was —
the room IS the page, the objects ARE the navigation — and **every room is an all-vector Rive artboard**
authored through the Rive Early Access editor MCP, played in a React 19 site. This document is the
agreed design; the implementation plan derives from it.

## Inputs that already exist

| Source (read-only, stays on the Desktop) | What it is |
| --- | --- |
| `~/Desktop/ThatDeveloperGuy/TDG_LOBBY_ANIMATION_KIT` | Lobby, 1648×928: layered traced SVGs (master 64-colour, `rive-import` 48-colour, 2,804 paths), 33 assembly SVGs, `web/hotspots.json` (three doors → routes), `docs/scene-manifest.json`, reference PNG |
| `…/TDG_IT_SERVICES_ANIMATION_KIT` | Page 02, same layout; 61 assemblies; hotspots → `#monitoring #support #workstations #infrastructure #deployment #process` + contact |
| `…/TDG_GOVERNMENT_SOLUTIONS_ANIMATION_KIT` | Page 03; 81 assemblies; hotspots → `#solutions #planning #requirements #contracting #process #delivery` + briefing + return-to-lobby |
| `…/TDG_CYBERSECURITY_ANIMATION_KIT` | Page 04; 104 assemblies; hotspots → `#monitoring #security-review #response #infrastructure #process` + briefing + return-to-lobby |
| `…/TDG_MASCOT_IT_SERVICES_SPECIALIST` | Laptop-headed IT specialist: master SVG (515×805, 1,571 paths, whole body), `rive/tdg-it-services-specialist.riv` with Idle/Walk/Wave/Work/Enter/Exit timelines (whole-body motion only) |
| Rive Early Access editor | MCP at `http://127.0.0.1:9791/mcp` (registered as `rive`, 40 tools). Open file: **ThatDeveloperguy Website**, fileId 2583640, `https://editor.rive.app/file/thatdeveloperguy-website/2583640`, currently empty |
| `~/Code/thatstupidcomputer-website` | The reference build: React 19 + Vite prerender + Fastify mail, `@rive-app/react-webgl2`, Playwright, release-to-Bubbles flow |

Kit facts that constrain the design (from the kits' own status files): the traced SVGs are polygonal
reconstructions of AI-generated PNGs, colour-quantized, 5–8 MB and 2,800–8,200 paths per room; none
was ever imported into Rive; the `rive/*.build-spec.json` files are notes, not `.riv`; hidden surfaces
behind doors/drawers are approximated, so motions must stay small.

## Decisions

1. **All-vector rooms in Rive.** No raster plates. The traces are refined into clean vector (curve-fitted,
   merged) before upload, so what goes into Rive is a proper flat illustration, not a polygon soup.
2. **Content and navigation live in HTML.** The `.riv` is motion only. Links are real `<a>` hit shapes,
   copy is real text, sections are in flow. Search engines, keyboards and screen readers never depend on
   the canvas.
3. **Facts come from the node** (`~/Code/thatdeveloperguy-truth`), wording unchanged. Government-contracting
   facts the node does not hold (CAGE, SAM Active date, VetCert, NAICS approval, PSC, past-performance
   naming) are rendered as visibly-marked owner placeholders and never invented.
4. **One hero first.** The lobby is built to full fidelity and judged in Chrome before the three rooms.
5. **Nothing new on Bubbles until release.** Development is local (`npm run dev`); release follows the
   TSC release contract later.

## Repository layout

```
thatdeveloperguy-website/
├─ apps/web/                     React 19 + Vite 8 + TypeScript, prerendered routes
│  ├─ src/animation/rive/        RiveScene.tsx · viewmodel bridge · playback gate (visibility, reduced motion)
│  ├─ src/animation/stage/       SceneStage.tsx — 1648×928 stage, hit-shape overlay, caption, poster fallback
│  ├─ src/rooms/<room>/          Room.tsx · hotspots.ts · content.ts · sections.tsx   (lobby, it-services, government-solutions, cybersecurity)
│  ├─ src/components/            Header · Footer · ContactForm · MobileRoomLinks · Seo
│  ├─ src/truth/                 node projection (organization, person, services wording) + owner placeholders
│  └─ src/styles/                tokens.css · base.css · layout.css · responsive.css
├─ apps/api/                     Fastify contact-mail service (TSC pattern; wired after the demo)
├─ scenes/                       artwork pipeline outputs — never hand-edited
│  ├─ kits.config.json           absolute paths of the Desktop kits + expected checksums
│  ├─ refined/<room>/            scene.svg · parts/<assembly>.svg · manifest.json (ids, pivots, hitboxes, counts before→after)
│  └─ rive/<room>/               <room>.riv (editor export) · rive-manifest.json (artboard, state machine, inputs, sha256)
├─ tools/                        import-kits.ts · refine-vectors.ts · rive-mcp.ts · rive-author.ts · verify-riv.ts · shots.ts
├─ scripts/                      dev.mjs · build.ts · prerender.ts · test.mjs · install-rive-cli.mjs
├─ tests/                        unit/ (refine, manifests, truth) · browser/ (Playwright: nav, keyboard, axe, fps)
├─ .tools/rive/                  official Rive CLI (git-ignored)
└─ docs/superpowers/specs|plans/
```

## Vector pipeline (`tools/refine-vectors.ts`)

Input: a kit's `svg/<room>.rive-import.svg` and `docs/scene-manifest.json`. Output:
`scenes/refined/<room>/scene.svg`, `parts/*.svg`, `manifest.json`.

Per room, preserving the group tree and every named id:
1. Drop paths with area < 2 px² (speckle from tracing).
2. Merge adjacent polygons with identical fill inside the same group when their union is simple.
3. Fit each polygon to cubic Béziers (Schneider curve fitting, tolerance 0.75 px; corners preserved where
   the turning angle exceeds 60°).
4. Round to 0.1 px, emit compact path data, no transforms, no filters, no text, no raster.
5. Split out every moving assembly named in the manifest (door leaves, drawers, screens, chairs, plants,
   lights) into `parts/<id>.svg` on the full 1648×928 artboard, and record its pivot (from the manifest)
   in `manifest.json`.
6. Render `scene.svg` to PNG and diff against the kit's reference PNG; write mean/95th-percentile pixel
   error and before→after path/vertex counts into `manifest.json`. Target: ≥ 5× fewer vertices,
   no visible change at 1×.

## Rive authoring (`tools/rive-author.ts` over `tools/rive-mcp.ts`)

The bridge speaks JSON-RPC to `http://127.0.0.1:9791/mcp`. Every editor operation is a named step
with its arguments logged to `scenes/rive/<room>/authoring-log.json` so a room can be rebuilt from
scratch in a new file.

Per room artboard (1648×928, named `Lobby`, `ITServices`, `GovernmentSolutions`, `Cybersecurity`):
1. `upload_asset` scene.svg + each part; `assets_tool.addSvgInstance` each into named Nodes.
2. Group moving parts with pivots at the manifest values (door hinge, drawer runners, chair base).
3. Timelines (linear animations): `Ambient` (ceiling lights breathe, plant sway, steam, status LEDs),
   per door `DoorOpen`/`DoorClose` (2-D hinge compression, ≤ 26° apparent swing), `Drawer<n>`,
   `ScreenSweep`, `Focus<object>` (lift 6 px + glow).
4. View model `Room { focus: enum(none|…object ids), doorOpen: trigger per door, reducedMotion: bool }`.
5. State machine layers: `Ambient` (loops unless `reducedMotion`), one `Door` layer per door
   (Closed → Opening → Open → Closing, driven by the trigger), `Focus` (blend by `focus`).
6. Listeners on invisible hit shapes matching `hotspots.json` (hover enter/exit → `focus`, click → `doorOpen`).
7. `capture_artboard` for review; `export_file` → `scenes/rive/<room>/<room>.riv`; record sha256 +
   input names in `rive-manifest.json`.

Mascot artboard `ITSpecialist` (515×805): upload the master SVG, `mesh_rigging_tool` bones — pelvis, spine,
head, upper/lower arm ×2, upper/lower leg ×2 — auto-weighted; timelines `Idle`, `Walk`, `Wave`, `Work`,
`Enter`, `Exit` with the timings of the existing `.riv` (`walk 0.9 s loop`, `wave 1.2 s`, `enter/exit 0.8 s`);
used as a component in each room artboard with a `travel` node the room's `Door` layer moves to the threshold.

`tools/verify-riv.ts` loads each export in `@rive-app/canvas` (Node, headless), asserts artboard name,
animation names, state-machine name and inputs against `rive-manifest.json`, and fails the build otherwise.

## The site

- Routes: `/` (lobby), `/it-services/`, `/government-solutions/`, `/cybersecurity/`, `/contact/`,
  `/privacy/`. Prerendered; React Router 8; Lenis smooth scroll; view-transition slide between rooms.
- `SceneStage`: 100svh stage below the header, room coordinates 1648×928 mapped to the stage; layers —
  poster `scene.svg` (inline, SSR) → Rive canvas (fades in when loaded, same geometry) → hit-shape SVG
  overlay (`<a>` per hotspot, tabbable, `aria-label`, dashed focus ring) → caption line naming the
  focused object (no floating labels, no cards).
- Door click: set `doorOpen`, mascot `Walk` to threshold, on Rive state `Open` → navigate; the target
  room enters with its own `Enter` beat. Reduced motion: instant navigation, no ambient loops.
- Rooms: objects link to in-flow sections under the stage (`.room-overview`), "return to the lobby" is a
  real door. `/contact/?project=<itsupport|govweb|security>&from=<room>` pre-selects the intent.
- Mobile (< 768 px): poster + link grid under it; Rive off until measured on a real phone.
- Type: Public Sans (body, USWDS) + Archivo Black (display headings); palette sampled from the reference art —
  paper `#f4f1fa`, lavender `#d9d1ea`, purple `#4a2f8a`, ink `#2a1f4a`, status green `#33c26b`; never
  brown/orange.
- Measurement: GA4 consent-gated as on TSC (stream created at release time, not now).
- Gates: ≥ 55 fps at 1× and 4× DPR in headless Chrome (`--use-angle=metal`), axe clean on every route,
  every hotspot reachable by keyboard, Lighthouse performance ≥ 90 on `/`.

## Testing

- Unit (`node --test`): refine step (counts, ids preserved, no raster/filter/text), manifests validate
  against kits, truth projection has no unapproved wording, hotspot routes exist.
- `verify-riv`: every export matches its manifest.
- Browser (Playwright, Chromium/WebKit/Firefox): lobby loads, three doors navigate by mouse and keyboard,
  caption names hovered object, reduced-motion path, mobile link grid, axe, fps capture via `shots.ts`.

## Build order

1. Scaffold repo, tooling, Rive CLI install, `kits.config.json`, `refine-vectors` on the lobby.
2. Lobby authored in the editor via the bridge → export → `verify-riv`.
3. Lobby route in `npm run dev` with the full stage; Joseph judges it in Chrome.
4. IT Services, Government Solutions, Cybersecurity rooms (pipeline repeats).
5. Mascot rig + door walk-through + room transitions.
6. Contact API, prerender, browser tests, release script (TSC contract), node registration.

## Out of scope for this pass

Live deployment to Bubbles; GA4 stream; Bing/GSC; the capability-statement PDF; redrawing artwork by
hand; independent facial animation on the mascot (needs a manual limb separation the kit does not have).

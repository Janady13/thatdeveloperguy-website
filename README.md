# thatdeveloperguy.com

Illustrated, animated website for ThatDeveloperGuy — government IT, security and real solutions. A lobby with three doors leads into
fully animated rooms (IT Services, Government Solutions, Cybersecurity), each built as a Rive scene over crisp plates and driven by a
data-bound view model.

## Layout

| Path | What |
| --- | --- |
| `app/` | React Router 8 site (SSR off, prerendered). `app/experience/` hosts the room shells and Rive canvases. |
| `content/` | Page content (`page.json` + `body.md`) compiled by `scripts/compile-content.ts`. |
| `creative-source/plates/` | Clean-plate pipeline per room: `make-plates.py` (masks, removals, 4x upscale, WebP sets), `make-vectors.py` (Adobe vectorize prep/consume), configs per room. |
| `rive/<room>/` | Rive CLI projects. `build-scene.py` generates `scene.rml` from the plates, fixtures and the room's animation-kit contract; `rive . --verify`, `rive inspect .`, `rive . --screenshot` verify it. |
| `tools/svg2rml.py` | Adobe Illustrator trace SVG → native Rive paths. |
| `.claude/skills/rive-expert/`, `.agents/skills/rive-expert/` | The Rive engineering skill (same content) used by coding agents in this repo. |
| `deploy/` | Publish scripts for the demo host (credentials come from the git-ignored `private/`). |

## Build

```sh
npm ci
npm run build:demo        # content → stage assets → react-router build → dist/site
```

Rive rooms: `cd rive/lobby && python3 build-scene.py && rive . --verify && rive . --once` (Rive CLI 1.0.4+). Plates and vectors are
produced by the scripts in `creative-source/plates/` and need Cloudinary / Adobe access.

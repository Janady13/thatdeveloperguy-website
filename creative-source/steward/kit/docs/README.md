# Digital Steward character kit

THATDEVELOPERGUY / Character system 01. Revision 1.2.0, 16 September 2026.

Open `START_HERE.html` in any browser. It works offline. Everything it shows is also in the folders below as real files.

## What's inside

| Folder | Contents |
|---|---|
| `START_HERE.html` | Animation workbench: both rigs, 41 clips, faces, gloves, visemes, layer inspector |
| `svg/` | The vector kit: every body part, both layered master files, gloves, faces, props, costume, brand icons, references. See `docs/SVG_KIT.md` |
| `embed/` | `<digital-steward>` web component for live sites, plus a demo page. See `embed/README.md` |
| `renders/` | Transparent animated WebP and WebM of 14 key clips per rig, with poster frames |
| `psd/` | Layered PSDs (hero 30 layers, front 25 layers), `psd_layout.json`, and `Build_And_Verify_PSDs.jsx` for Photoshop |
| `brand/` | Palette as SVG, JSON, CSS tokens and an Adobe swatch file (`.ase`) |
| `art/` | PNG sources: rig parts (trimmed and aligned), gloves, turnarounds, expression heads, sheet elements |
| `rigs/` | `hero.json`, `performer.json`, `animation-clips.json`, `library.json` |
| `references/` | The Digital Steward source sheet and the two alternate concept sheets |
| `docs/` | `NATIVE_RIVE_BUILD.md`, `SVG_KIT.md`, `REPAIR_LOG.md`, `qa/` proof sheets |

## Status

1. Artwork, rigs, faces, gloves, vectors and motion studies are complete and verified.
2. The PSDs are verified layer by layer. Run the Photoshop script for a native check.
3. A compiled `.riv` is the remaining step and is authored in the Rive editor using `docs/NATIVE_RIVE_BUILD.md`. The layered master SVGs are the fastest import for it.

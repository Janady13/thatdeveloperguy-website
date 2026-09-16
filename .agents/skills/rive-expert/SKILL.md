---
name: rive-expert
description: Expert workflow for creating, editing, inspecting, debugging, testing, optimizing, and integrating Rive projects using RML, the Rive CLI, Rive Editor MCP, State Machines, Data Binding, View Models, Luau scripting, WGSL shaders, .riv/.rev files, and Rive runtimes. Use for any task involving Rive authoring or runtime integration.
---

# Rive Expert

## Mission

Operate as a production Rive engineer, technical animator, interaction engineer, and runtime integration specialist. Do not merely produce code that appears plausible. Create Rive work that is structurally correct, visually correct, interactively correct, testable, maintainable, performant, and appropriate for the target runtime.

Rive is an authoritative external system. Do not rely on memory when the installed Rive CLI, Rive schema, project files, or current Rive documentation can answer a question more reliably.

## Source-of-truth hierarchy

1. Existing project requirements and repository architecture.
2. Existing Rive-generated AGENTS.md instructions (inside each Rive project directory).
3. Installed Rive CLI behavior and `rive --help`.
4. `rive schema` for RML types, properties, defaults, enum values, property keys, animatable (`--animatable`) and bindable (`--bindable`) properties.
5. `rive docs` for installed Rive concepts, syntax, patterns, gotchas. **Run it from inside a Rive project directory** — see `references/local-facts.md` for the shadowing trap and the bundled path.
6. The current Rive documentation index: https://rive.app/docs/llms.txt (map in `references/docs-map.md`).
7. The specific current documentation page discovered through that index.
8. Existing working examples (`rive samples`) or this repo's own projects.
9. General model knowledge only when none of the above can answer.

Never invent a Rive type, property, property key, enum member, CLI option, binding path, runtime method, or undocumented feature when it can be verified. `file=` on assets is the one authoring attribute `rive schema` never lists; it is valid on every asset.

## Documentation discovery

Progressive disclosure: identify the part of Rive involved in the task and load only the relevant topic. Locally: `rive docs --list`, `rive docs <topic>`, `rive docs --search <term>`, `rive docs gotchas`. Schema: `rive schema <Type>`, `rive schema --search <term>`, `rive schema <Type> --animatable|--bindable`, `--json` for machine-readable. Online: start at llms.txt, never guess URLs.

## Environment discovery

For a substantial task establish first: CLI version (`rive --version`, `rive doctor`), project root and `rive.yaml`, the project's AGENTS.md, RML/Luau/WGSL files, assets, existing `.riv`/`.rev`, artboards, state machines, view models, target runtime and framework, required device/browser support. Do not destructively recreate an existing project because a clean one would be easier.

## Choose the correct interface

- **CLI / RML** for reproducible source, version control, deterministic builds, agent-generated scenes, tests, CI, schema inspection, headless screenshots, runtime deliverables. This is the primary path in this repo.
- **Rive Editor MCP** (`http://127.0.0.1:9791/mcp`, editor running with a file open) for inspecting or modifying a live editor document, editor-native scenes, diagnostics. Complementary, never exclusive. `rive create <dir> --from-rev=<file>` moves editor work into CLI source; `rive push` sends CLI source back.
- **Runtime APIs** per the exact target runtime's current docs; check Feature Support before relying on a feature.

## Understand before authoring

Establish the scene contract: visual objective, artboards, coordinate system, responsive behavior, hierarchy, reusable components, animation vs state machine vs view model responsibilities, interactions, pointer regions, runtime-controlled values, assets, scripting/shader needs, performance target, reduced-motion needs. Keep the five responsibilities distinct: visual structure, animation, interaction/state, application data, runtime integration.

## Build in stages

Structure → layout → components → visual content → animation → state machine → data binding → runtime integration → polish. Verify after each meaningful stage before compounding complexity.

## RML discipline

Valid `<Rive version="1" kind="fragment">` root. Ids are `client:object` pairs, unique across ALL `.rml` files in the project (they compile as one document), only needed where referenced; the CLI writes ids back into your files on export. Verify keyed objects and `propertyKey`s through `rive schema <Type> --animatable` — never guess numeric keys. Confirm bindability before binding. Value formats: ARGB hex colors without `#`, `"true"/"false"`, enums by name, rotation in radians (full turn 6.2831855), animation timing in frames at the animation fps (default 60), transition durations in ms. Project configuration lives in `rive.yaml`, not in fragment RML. Read `rive docs gotchas` — several failures are silent (a missing asset `file` builds clean and renders nothing).

## Components, animation, state machines, data

Reusable components for repeated or independently controlled systems; boundaries follow behavior, not arbitrary fragmentation. Decide per behavior whether it belongs in a linear animation, nested animation, state machine, transition, data binding, view model, script, or host code. State machines are product interfaces: semantic names for machines, states, transitions, listeners, view model properties. View models are the contract between animation and application; prefer them over deprecated inputs. Bound changes apply on the next advance.

## Scripts and shaders

Luau in Rive's documented environment only (no browser/Node/OS APIs); WGSL in Rive's supported form. Compile with the tooling. Files with scripts destined for the web must be built with `--publish` (signed) or the CDN/web runtime rejects them.

## Required verification model — none of these replaces the others

1. **Compile**: `rive <dir> --verify` (RML, Luau, shaders).
2. **Structure**: `rive inspect <dir> --summary` / `--json` — read `problems`, confirm artboards, machines, view models, animations, references. `--verify` and `inspect` cover different ground; run both.
3. **Visual**: `rive <dir> --screenshot=out.png [--advance=N|Ns]` — advance far enough to show the intended state; compare against the reference. Render representative viewport sizes for responsive work.
4. **Behavior**: drive pointer and data (`--pointer=click@x,y`, `--advance`, data flags per `rive --help`), then render/inspect the result.
5. **Tests**: `rive <dir> --test` when Tests scripts exist; prefer adding a focused regression test for recurring behavior.
6. **Performance**: benchmark when performance is an acceptance criterion; judge on the target device, not the dev machine.

Loop: implement → verify → inspect → render → exercise → compare → fix → repeat. A command exiting 0 is evidence, not proof.

## Runtime integration

Consult the exact runtime docs (web `@rive-app/canvas` vs `@rive-app/webgl2`, React, etc.). Initialize only when the DOM/runtime exists; handle load/failure; dispose properly (no leaked loops, observers, canvases). Treat the view model as the app contract; keep business state separate from presentational state unless the architecture says otherwise. Verify resize, DPR, canvas sizing, pointer mapping, cleanup. Large raster assets: embed at display size, or ship contentless assets and supply them at runtime through the asset loader (`rive docs assets`, runtime "Loading Assets").

## Existing `.rev` projects and reference artwork

`.rev` files are editable sources: never overwrite; convert with `--from-rev` into a NEW directory and inspect before restructuring. With reference art, first decide what is baked, what moves independently, what deforms, what is interactive, and what text stays native outside Rive. Placing a raster on an artboard is not production animation; recover the independent structure first (see `references/local-facts.md` → plates pipeline).

## Definition of done and final report

Done means evidence: compiles, inspection clean or understood, render matches, major states rendered, interactions exercised, bindings work, runtime loads it, responsive states work, tests pass, performance acceptable, outputs exist. Report concisely: changes, architecture decisions, files, artboards/machines/view models affected, verification commands actually executed with results, runtime changes, remaining limitations. Never claim a check passed unless it ran and its output was read.

## Prime directive

When uncertain about Rive, query Rive. When uncertain about the project, inspect it. When uncertain about appearance, render it. When uncertain about interaction, exercise it. When uncertain about runtime compatibility, read the current runtime and feature-support docs. Build from evidence.

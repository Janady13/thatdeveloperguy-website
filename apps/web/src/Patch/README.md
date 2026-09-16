# Patch React Integration

This folder contains the complete Patch mascot system for the React website.
Keep Patch-specific runtime code, animation assets, fallback artwork, and
controller logic inside this folder.

## Folder architecture

```text
Patch/
├── controller/
│   └── PatchController.ts       # Typed animation state and runtime control
├── react/
│   ├── PatchMascotRive.tsx      # Rive-backed production component
│   ├── ITServicesMascot.tsx     # SVG/CSS fallback component
│   └── *.css                    # Component styles
├── rive/
│   ├── tdg-patch.riv            # Runtime asset loaded by Vite
│   └── tdg-patch.rev            # Editable Rive backup
├── svg/                         # Fallback artwork and overlays
├── source/                      # Visual proofs and source references
├── scripts/                     # Patch asset validation
├── index.ts                     # Public imports for the website
└── README.md                    # This integration guide
```

## Install requirements

The website already provides the required dependencies:

```bash
npm install
```

The runtime dependencies are:

- `react`
- `react-dom`
- `@rive-app/react-webgl2`

## Import Patch

Use the folder entry point rather than importing internal files from a page:

```tsx
import {
  PatchMascotRive,
  type PatchController,
} from '@/Patch';
```

If the project does not define the `@` alias, use the relative path:

```tsx
import { PatchMascotRive } from '../../Patch';
```

## Render the Rive mascot

```tsx
import { useRef } from 'react';
import {
  PatchMascotRive,
  type PatchController,
} from '@/Patch';

export function SupportPage() {
  const patch = useRef<PatchController | null>(null);

  return (
    <section>
      <PatchMascotRive
        motion="idle"
        expression="happy"
        gesture="none"
        onReady={(controller) => {
          patch.current = controller;
        }}
        onLoadError={(error) => {
          console.error('Patch animation unavailable', error);
        }}
      />

      <button
        type="button"
        onClick={() => {
          patch.current?.setState({
            motion: 'wave',
            expression: 'happy',
            gesture: 'wave',
          });
        }}
      >
        Say hello
      </button>
    </section>
  );
}
```

The component automatically loads `rive/tdg-patch.riv` through the Vite asset
pipeline. Do not hard-code a path into `public` unless the asset delivery
strategy changes intentionally.

## Controller API

`PatchController` is the single runtime owner for Patch animation state.
Page components should request state changes through this controller rather
than calling Rive directly.

```tsx
patch.current?.setState({
  motion: 'work',
  expression: 'focused',
  gesture: 'none',
});

patch.current?.blink();
patch.current?.pause();
patch.current?.resume();
patch.current?.dispose();
```

Supported values:

```text
motion:     idle | walk | wave | work | enter | exit
expression: neutral | happy | focused | talking
gesture:    none | wave | thumbs-up
```

The controller validates the `PatchMachine` state machine and required
animation names. Missing runtime assets are reported through `onLoadError`;
they are not silently replaced with a success-shaped fallback.

## SVG/CSS fallback

Use the fallback when WebGL/Rive is unavailable or when a page intentionally
needs the dependency-light renderer:

```tsx
import { ITServicesMascot } from '@/Patch';

<ITServicesMascot
  motion="wave"
  expression="happy"
  gesture="wave"
  label="Patch, the TDG IT services mascot"
/>
```

The SVG artwork and face/gesture overlays are imported from `Patch/svg`, so
Vite fingerprints and bundles them with the website.

## Accessibility and reduced motion

- Normal mode exposes Patch as an image with an accessible label.
- Set `decorative` when Patch is visual decoration only.
- The components honor `prefers-reduced-motion`.
- Pass `reducedMotion` when the page has its own motion preference.
- Use `paused` when the page is hidden or the animation should stop.
- Keep interactive controls outside the canvas and provide keyboard-accessible
  buttons or links for actions that trigger Patch behavior.

```tsx
<PatchMascotRive
  decorative
  reducedMotion={userPrefersReducedMotion}
  paused={!isPageVisible}
/>
```

## Production checks

From the repository root:

```bash
npm run typecheck
npm run build
npm test
```

Patch-specific asset validation can be run with:

```bash
node apps/web/src/Patch/scripts/validate-assets.mjs
```

The current Rive file uses coordinated named timelines and layers. The
React-facing controller API is stable and intentionally isolates this detail.
If authored Rive view-model inputs are added later, the internal controller
implementation can migrate without changing page-level integrations.

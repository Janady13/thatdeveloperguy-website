# Digital Steward: native Rive build

This kit is a verified source package. It contains every painted part, the registered vector faces, the glove library, the rig hierarchy with pivots, and 41 keyframed motion studies. It does not contain a compiled `.riv`. That file has to be authored in the Rive editor, and this document is the build sheet for doing it without guesswork.

Coordinates everywhere in the kit are artboard pixels with the origin at top left and y pointing down, the same convention Rive uses. Rotations are in degrees. Clip times are normalized from 0 to 1, so multiply by the clip's `duration` to get seconds.

## 1. Files you need

| Purpose | Hero rig (three quarter) | Front rig |
|---|---|---|
| Artboard size | 640 x 960 | 360 x 440 |
| Registered layers, one PNG per part, full artboard size | `art/hero/aligned/` (30) | `art/performer/aligned/` (25) |
| Trimmed tiles, if you prefer to place by rect | `art/hero/parts/` | `art/performer/parts/` |
| Layered Photoshop source | `psd/Digital_Steward_HERO_640x960.psd` | `psd/Digital_Steward_FRONT_360x440.psd` |
| Hierarchy, pivots, rects, z order | `rigs/hero.json` | `rigs/performer.json` |
| Vector faces, already registered to the visor | `art/vectors/registered-hero/*.svg` | `art/vectors/registered-performer/*.svg` |

Shared by both rigs: `rigs/animation-clips.json` (motion), `rigs/library.json` (gloves, views, face bank, visemes), `art/hands/` (9 glove poses plus mirrors), `art/vectors/props/` (8 icons), and `art/vectors/FACE_EXPRESSION_LIBRARY.svg` (every expression as named, editable eye and mouth groups).

The aligned PNGs are the fastest route. Every one is the full artboard size, so dropping them onto a matching artboard at 0,0 lands each part in exactly the right place with no nudging.

## 2. Artboards

1. Create an artboard named `Hero` at 640 x 960 and another named `Front` at 360 x 440.
2. Import the aligned PNGs for each rig and position every image at 0,0.
3. Stack them in `z` order from the rig JSON: `z` 0 at the bottom, highest `z` on top. The PSDs use the same order and group the layers the same way, so the Photoshop layer panel is a visual reference for the stack.

## 3. Hierarchy and pivots

Build the tree exactly as the `parent` fields describe. Each part becomes a group (or node) whose origin sits on the part's `pivot`, with the image inside it. Two extra nodes sit above the parts:

| Node | Hero pivot | Front pivot | Parent |
|---|---|---|---|
| `root` | 336, 885 | 185, 377 | none |
| `body` | 336, 492 | 186, 258 | `root` |

Hero chain summary: `root > body > torso > neck > head > (ear_L, ear_R, crown, visor_painted)`, `torso > arm_L_upper > arm_L_fore > cuff_L > hand_L_thumb` (gesture arm), `torso > arm_R_upper > arm_R_fore > (tablet > tablet_finger, hand_R_hold)`, and `root > hips > thighs > shins > shoes`, with the pockets riding on the thighs.

Front chain summary: the same layout, with `arm_R_upper > arm_R_fore > cuff_R > hand_R` as the gesture arm.

Set each group's origin to the pivot before you animate anything. A rotation keyframe only matches the preview when the origin is on the pivot.

These are raster parts with a few pixels of seam bleed, so rigid rotation about the pivots is the intended technique. If you later want bending sleeves, convert `arm_*_upper` and `arm_*_fore` to image meshes and bind them to bones placed on the same pivots.

## 4. Face

1. Keep `visor_painted` for the original painted face, but hide it by default.
2. Import one registered expression SVG per rig (start with `neutral.svg`) and parent it to `head`. The SVGs have the head transform baked in, so they land correctly at 0,0.
3. Every expression uses the same group names (`eye_L`, `eye_R`, pupils, `mouth`), which makes them easy to blend with a state machine or to reduce to a single face with animated shapes.
4. Blink is a vertical scale of each eye group to 4 percent around the eye's centre line, held briefly. Pupil gaze in the preview moves the pupils up to 3.3 by 2.5 px on the hero and 1.5 by 1.1 px on the front rig.
5. The 11 viseme mouth shapes are in `rigs/library.json` under `faceBank.visemePaths`. No audio or lip sync ships with the kit.

## 5. Glove swaps (important)

The gesture hand is swapped for a glove pose in the middle of a clip. The preview now does this in a specific way, and the native build should match it, because it's what keeps the wrist joint sealed.

1. Show the swap glove only while normalized time is between 0.17 and 0.82. Outside that window the painted hand shows.
2. Hide only the painted hand (`hand_L_thumb` on the hero, `hand_R` on the front rig). Keep the cuff visible.
3. Put the glove **directly beneath the cuff** in draw order, so the painted cuff covers the glove's own wristband.
4. Parent the glove to the painted hand's node and place the glove's `pivot` (from `rigs/library.json`) on the painted hand's pivot. Scale the glove images by **1.68** on the hero and **0.57** on the front rig.
5. The hero forearm now contains a baked dark sleeve interior. It is invisible at rest and is what you see around a swapped glove, so do not erase it.
6. The hero keeps its painted thumbs up for `ThumbsUp`, `Success` and `Delight`. It is the better drawing, so no swap happens there.
7. On the front rig, the glove gets a base rotation of 90 degrees for `point`, `open_palm`, `present` and `fist`, and 180 degrees for the upright poses. It is then leveled so that, at the clip's held pose (time 0.5), the glove leans no more than 12 degrees from upright. `PointLeft` uses the mirrored glove image and mirrored pivot.

## 6. Props

Props show between times 0.20 and 0.82, fading over 0.12 at each end, with a gentle 4 px rise at mid clip. Placement:

| Hand in the clip | Hero position and scale | Front position and scale |
|---|---|---|
| Upright glove (thumbs up, wave, ok, peace, focus) | 34, 198 at 0.49 | 298, 118 at 0.32 |
| Anything else, or no glove | 105, 190 at 0.49 | 257, 154 at 0.32 |

Each prop is a 160 by 160 SVG, so its top left corner sits at the listed position.

## 7. Timeline animations

Create one timeline per clip in `rigs/animation-clips.json`, named with the clip `id`, and use the clip's `duration` and `loop` flag. For every track, key the named node's `rotation`, `x` or `y` at `time x duration`, using the listed values. `x` and `y` are offsets from the rest position. The preview interpolates with smoothstep, which is close to Rive's default cubic ease in and out.

Clips authored for one rig only: `PointLeft`, `TabletPresent` and `TabletReview` (hero) and `StepInPlace` (front). Every other clip exists on both rigs.

The `expression`, `hand` and `prop` fields on each clip tell you which face, glove and prop that timeline should show.

## 8. State machine

A practical layout:

1. **Idle layer.** `Idle` loops by default. `Breathe` and `Attentive` are alternative idles.
2. **Gesture layer.** A number input `gesture` or one trigger per clip (`Wave`, `ThumbsUp`, `Explain` and so on) plays the one shot and returns to idle.
3. **Face layer.** A number input `expression` selects the face, plus a `blink` trigger on a timer.
4. **Gaze.** Two number inputs, `lookX` and `lookY` from minus 1 to 1, blended into pupil offsets.
5. **Entrances.** `SlideInLeft`, `SlideOutLeft`, `SlideInRight` and `SlideOutRight` move `root` across the artboard edge.

## 9. Done means

1. Every aligned PNG sits at 0,0 and the rest pose matches `START_HERE.html` with "Original painted face" on.
2. Showing the pivots overlay in the workbench and the origins in Rive gives the same points.
3. Each timeline matches the workbench at times 0.3, 0.5 and 0.75. The contact sheets in `docs/qa/` are the reference frames.
4. Glove swaps show no gap, no floating glove and no cuff crescent at any frame.
5. The exported `.riv` loads in the Rive web runtime and the state machine inputs respond.

Only after all five are true should the kit be marked native compatible. Until then, the manifests keep `nativeRiveStatus: "not-compiled"`.

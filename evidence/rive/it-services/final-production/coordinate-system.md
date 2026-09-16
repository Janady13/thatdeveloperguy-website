# IT Services coordinate system

Canonical runtime coordinate space: `1648 x 928`.

The supplied original PNG is `1672 x 941`. The production SVG kit, web preview, Rive-import candidate and current React hotspot system are `1648 x 928`. This build keeps that kit coordinate system so poster, overlay SVG layers, hotspots, debug bounds, pointer mapping and future Rive artboard inputs share one transform.

Scale from original PNG to kit canvas: x = 0.98564593, y = 0.98618491.

The scene plane uses one CSS aspect-ratio transform. Individual layers are positioned in source coordinates and must not use viewport-relative offsets.

# Virtual sets

One folder per window. Every set is a 12 km × 12 km square.

- `terrain.glb` — textured mesh in metres (x east, y up, z south), 60 m vertex spacing, lowest point at y = 0. Opens in Blender, Unreal, Unity, three.js.
- `height_16bit.png` — 400 × 400 heightmap at the elevation model's native 30 m. 0 = `min_m`, 65535 = `max_m` from `sets.json`.
- `texture_after_rains.jpg`, `texture_dry.jpg` — 1200 × 1200 Sentinel-2 natural colour at 10 m.

Limits: the terrain is Copernicus GLO-30, a 30 m surface model, so cliffs are smoothed and trees and roofs are included in the height.
A camera closer than a few hundred metres will see blur. Built by `src/sets.py`.

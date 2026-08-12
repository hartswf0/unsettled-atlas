# PERSPECTIVAL GROUND — build contract

Read this before touching anything. It is short on purpose.

## The law

1. **The map is the game.** No planning screen, no GIS toolbar, no mode picker.
   Finger touches Atlanta, a road exists.
2. **Moving is effortless.** Tap a destination, see the route, go. Google Maps
   grammar. If moving is fiddly the game is dead.
3. **Atlanta stays recognisable.** The game layer never buries the basemap. The
   city is fibre *in* the cloth, not a print under a drawing.
4. **No legend. No God's-eye view. No explanation of what a mark means to whom.**
   Perspective is discovered by traversal. If you are tempted to add a key, a
   tooltip that names an affordance, or a tutorial line that explains RAIN —
   don't. Show it happening to a traveller instead.
5. **Nothing accumulates silently.** Every passage leaves a trace, and over time
   the used world must become *more visible* than the planned world. That
   transformation is the most beautiful thing in the game.
6. **30 seconds, alone, on a phone.** If nobody else is on the ground the game
   supplies travellers.

## The spine — do not change these without saying so loudly

| file | what it owns |
|---|---|
| `pg/ground.data.js` | real Atlanta polylines (OSM-derived). Read-only. |
| `pg/graph.data.js` | compiled graph. Regenerate with `node pg/tools/build-graph.mjs`. |
| `pg/geo.js` | mercator, the camera (`View`), screen transforms, polyline helpers |
| `pg/graph.js` | nodes/edges, spatial index, `route()`, `addWay()`, `wear()` |
| `pg/beings.js` | the beings and their `cost()` — the perspective mechanic itself |
| `pg/state.js` | marks, journeys, pressure, persistence, events, multiplayer |

Everything is web mercator on the unit square. **No module stores pixels.**

### Coordinates

```js
import { View, sx, sy, wx, wy, worldSize, pxPerM } from "./geo.js";
sx(mercX) -> screen px    wx(screenPx) -> merc
```

### Asking the ground a question

```js
import { G, route, nearestNodeFor, addWay, CLS_MARK } from "./graph.js";
const r = route(fromNode, toNode, being);
// r = { nodes, edges, dist, cost, balk }
// r.balk is NOT an error. It is where the ground stopped offering this being
// anything, and it is the invitation to draw.
```

### What a being makes of a piece of ground

```js
being.read(edgeIndex, forward) // -> { live, kind: "ladder"|"chute"|"plain"|"none", ratio }
```

`kind` is a *consequence of cost*, never a stored label. Do not add tags to
edges. If you want a new affordance, express it as a cost in `beings.js`.

### Talking between modules

```js
import { on, emit, S } from "./state.js";
```

Events: `loaded` `mark` `journey` `balk` `ghost` `become` `witness` `peer`.
**Modules must not import each other** — only the spine and `state.js`. That is
what lets any one of them be rebuilt without breaking the others.

## The organs — one owner each

| file | owns | judged against |
|---|---|---|
| `pg/cloth.js` | drawing the city: paper, fibre, ink, water, the woven look | Living Mapmaker, Google Maps legibility |
| `pg/move.js` | tap → route → go. camera follow. the travel itself | Google Maps |
| `pg/draw.js` | finger draws infrastructure; it becomes ground | Living Mapmaker, Death Stranding |
| `pg/become.js` | the turn: becoming, and the board reorganising | Everything's BECOME, Gyan Chauper |
| `pg/travellers.js` | the others, and being differently affected by your mark | Ingress, Mini Motorways |
| `pg/traces.js` | wear, desire lines, ghost roads, used-over-planned | Strava heatmaps |
| `pg/hud.js` | the almost-nothing that is on screen | — |

Each organ exports `init(ctx)` and optionally `draw(ctx, now)` and
`input(e)`. `main.js` owns the loop, the canvas and the order of drawing.

## Running it

```
node pg/tools/build-graph.mjs      # only if ground data changes
node pg/tools/serve.mjs 8080       # then open /perspectival-ground.html
node pg/tools/shot.mjs <url> out.png --phone
```

## Rendering budget

One canvas, one RAF loop. Target 60fps on a 2020 phone; **hard floor 30fps** on
a 390×844 viewport with 400 marks and 2000 journeys on the cloth. Cache to an
offscreen layer anything that does not change every frame. `main.js` exposes
`ctx.quality` (0..1) which drops when frames get long — respect it.

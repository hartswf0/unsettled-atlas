# Ahiya real-ground wiring: validation ledger

Scope of this wave: one crucible step, the Ahiya Highlands circuit of make-photo (`night-post/`) on measured ground.
The 14 x 14 km compressed transect in the DEMIURGE payload is not built.

## MEASURED
- Ground source: Copernicus GLO-30, Simien window, pump at 13.22461 N, 38.10454 E, 3,397 m. Layout 1:1, rotated 10 degrees.
- Fit of real relative heights to the game's sculpted ones at the four set centres: 1.2 m RMS.
- In-game probe (`window.__nightPost.groundAt`, 0.5 m steps), real vs sculpted:
  steepest grade on each leg 30.6 / 30.5, 7.7 / 18.6, 22.8 / 27.2, 12.7 / 28.5 degrees; climb on the loop 55 m / 85 m.
- Largest height step across the blend edge into the surrounding terrain: 1.04 m per 0.5 m in both builds, at
  (-1248, 538), outside the Ahiya mask. It predates this change.
- Page errors on load in either build: none.

## STRUCTURAL
- Single wiring point: `ahiyaGroundY` in `night-post/night-post.js`. `?ground=sculpted` restores the old ridge; a missing
  data file falls back to it.
- The pump keeps its sculpted height, so every set that samples `groundAt` stays seated.
- Level terraces (flat to 20 m, eased by 52 m) at the four sets are COMPOSED, stored apart from the raw heights.

## JUDGED
- Independent critic, eight frames, builds labelled A/B without saying which was which: the real-ground build was
  cleaner at the pump and compound; one exposed floor edge at the Hill Archive (terraces widened afterwards, not
  re-judged). Stills only, 820 x 480, one angle per set.

## ACTIVE-GHOST
- [[GHOST::FRAME_TIME]] no frame-time or draw-call measurement; the only renderer available here is software.
- [[GHOST::TRAVERSAL]] no played traversal on foot or by donkey; the probe samples ground, it does not walk it.
- [[GHOST::FIT_UNIQUENESS]] an equally close fit exists in the Ada'a window; Simien was chosen for altitude belt.
- [[GHOST::SUB_30M]] terrain detail under 30 m is not in the data; bare-earth (FABDEM) host is unreachable here.
- [[GHOST::HABITUS_SOURCES]] coffee rounds, queue rules and signage remain COMPOSED from the brief.

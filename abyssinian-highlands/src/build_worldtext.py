"""Write web/worldtext.json (and a copy in worldtext/) from the fit in worldtext/ahiya_fit.json."""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(f"{R}/worldtext/ahiya_fit.json")); sim = [x for x in json.load(open(f"{R}/web/sites.json"))["sites"] if x["key"] == "simien"][0]
names = dict(basalt="Basalt Pump", beacon="Cross-Beacon Watch", hill="Hill Archive", compound="Daylight Compound")
m = {"worldtext": "Ahiya on real ground",
 "edit_me": "Change any value below and press Recompile. Positions are metres east and south of the window's north-west corner.",
 "model_of": {"label": "MEASURED", "terrain": "Copernicus GLO-30, Simien window, 12 km square", "image": "Sentinel-2, 2025-12-28", "min_elev_m": sim["elev"][0],
   "fit": "the game's four Ahiya sets, kept at 1:1 plan scale, rotated %d degrees; real relative heights match the game's sculpted ones to %.1f m RMS" % (f["rotation_deg"], f["fit_rms_m"])},
 "stops": [{"id": x["id"], "name": names[x["id"]], "x_m": x["win_xy_m"][0], "y_m": x["win_xy_m"][1], "game_rel_m": x["game_rel_m"]} for x in f["stops"]],
 "route": ["basalt", "beacon", "hill", "compound"], "beacon": {"mast_m": f["mast_m"], "label": "FICTION"},
 "model_for": {"label": "COMPOSED from the brief, not field-checked", "circuits": [
   {"id": "water_queue", "at": "basalt", "jerrycans": 9, "spacing_m": 0.6, "rule": "cans stand in arrival order within 3 m of the standpipe"},
   {"id": "threshold_coffee", "at": "compound", "state": "abol", "cups": 6, "mat_radius_m": 1.2, "rule": "mat within 1.5 m of the doorway; host stool, brazier and door make a triangle"}]},
 "common_sense_defaults": ["the pump sits at the lowest stop", "the beacon sits at the highest stop", "the queue keeps its order"],
 "ideological_friction": [{"id": "cooling_conduit", "from": "beacon", "to": "basalt", "on": True, "label": "FICTION", "note": "the archive's cooling water runs past the public tap"}]}
for p in ("web", "worldtext"): json.dump(m, open(f"{R}/{p}/worldtext.json", "w"), indent=1)
print(f["fit_rms_m"], f["route_m"], f["route_up_m"], f["visible_share_of_window"], f["stops"][0]["lat"], f["stops"][0]["lon"])

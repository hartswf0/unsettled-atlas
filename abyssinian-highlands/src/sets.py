"""Virtual-set export and web 3D pack: per site a height PNG for the page, a 16-bit heightmap, and a textured GLB mesh in metres."""
import sys, os, json, struct, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import *; from render import *
W = os.path.join(ROOT, "web"); S = os.path.join(ROOT, "sets"); os.makedirs(S, exist_ok=True); info = {}
def glb(path, z, tex_bytes, n):
    step = KM*1000/(n-1); ys, xs = np.mgrid[0:n, 0:n]
    pos = np.stack([xs*step - KM*500, z - z.min(), ys*step - KM*500], -1).reshape(-1, 3).astype("<f4")   # x east, y up, z south, metres
    uv = np.stack([xs/(n-1), ys/(n-1)], -1).reshape(-1, 2).astype("<f4")
    i = (ys[:-1, :-1]*n + xs[:-1, :-1]).ravel(); idx = np.stack([i, i+n, i+1, i+1, i+n, i+n+1], -1).ravel().astype("<u4")
    bufs = [pos.tobytes(), uv.tobytes(), idx.tobytes(), tex_bytes]; off = [0]
    for b in bufs: off.append(off[-1] + (len(b) + 3)//4*4)
    blob = b"".join(b + b"\0"*((4 - len(b) % 4) % 4) for b in bufs)
    j = dict(asset=dict(version="2.0"), scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0)],
        meshes=[dict(primitives=[dict(attributes=dict(POSITION=0, TEXCOORD_0=1), indices=2, material=0)])],
        materials=[dict(pbrMetallicRoughness=dict(baseColorTexture=dict(index=0), metallicFactor=0, roughnessFactor=1))],
        textures=[dict(source=0)], images=[dict(bufferView=3, mimeType="image/jpeg")],
        buffers=[dict(byteLength=len(blob))],
        bufferViews=[dict(buffer=0, byteOffset=off[k], byteLength=len(bufs[k])) for k in range(4)],
        accessors=[dict(bufferView=0, componentType=5126, count=len(pos), type="VEC3", min=pos.min(0).tolist(), max=pos.max(0).tolist()),
                   dict(bufferView=1, componentType=5126, count=len(uv), type="VEC2"), dict(bufferView=2, componentType=5125, count=len(idx), type="SCALAR")])
    js = json.dumps(j, separators=(",", ":")).encode(); js += b" "*((4 - len(js) % 4) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 28 + len(js) + len(blob))); f.write(struct.pack("<I4s", len(js), b"JSON")); f.write(js)
        f.write(struct.pack("<I4s", len(blob), b"BIN\0")); f.write(blob)
for key, name, *_ in SITES:
    dem = np.load(f"{RAW}/{key}_dem.npy"); lo, hi = float(np.nanmin(dem)), float(np.nanmax(dem))
    d30 = dem.reshape(400, 3, 400, 3).mean((1, 3))                      # back to the DEM's native 30 m
    q = np.round((d30 - lo) * 10).astype("uint16")                      # decimetres above the window minimum
    Image.fromarray(np.stack([q >> 8, q & 255, np.zeros_like(q)], -1).astype("uint8")).save(f"{W}/img/{key}_dem.png", optimize=True)
    o = f"{S}/{key}"; os.makedirs(o, exist_ok=True)
    Image.fromarray(np.round((d30 - lo) / (hi - lo) * 65535).astype("uint16")).save(f"{o}/height_16bit.png")
    Image.fromarray(rgb(key, "after_rains")).save(f"{o}/texture_after_rains.jpg", quality=90); Image.fromarray(rgb(key, "dry")).save(f"{o}/texture_dry.jpg", quality=90)
    n = 201; z = dem[::6, ::6]; z = np.pad(z, ((0, 1), (0, 1)), mode="edge")[:n, :n]
    glb(f"{o}/terrain.glb", z, open(f"{o}/texture_after_rains.jpg", "rb").read(), n)
    info[key] = dict(name=name, size_m=KM*1000, min_m=round(lo, 1), max_m=round(hi, 1), height_px=400, texture_px=PX, mesh_spacing_m=60)
    print(key, info[key], os.path.getsize(f"{o}/terrain.glb")//1024, "KB")
json.dump(info, open(f"{S}/sets.json", "w"), indent=1)

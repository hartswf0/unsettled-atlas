import sys, json, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
stack, src, meta = load(sys.argv[1]); det = json.load(open(sys.argv[2])); out = sys.argv[3]
x0, y0, w = map(int, sys.argv[4:7]); sc = 900 / w
R = rgb(stack)[y0:y0+w, x0:x0+w]
im = Image.fromarray(R).resize((900,900), Image.LANCZOS); d = ImageDraw.Draw(im)
for c in det["accepted"]:
    if not (x0 <= c["px"] < x0+w and y0 <= c["py"] < y0+w): continue
    X, Y, r = (c["px"]+0.5-x0)*sc, (c["py"]+0.5-y0)*sc, c["pr"]*sc   # pixel-centre -> image coords
    col = (0,255,255) if c in det["accepted"] else None
    if col: d.ellipse([X-r,Y-r,X+r,Y+r], outline=col, width=2)
im.save(out)

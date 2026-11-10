"""Score a detection file against sealed independent labels.
Match rule: greedy by distance, center error < 0.5*r_gt. Circles (GT or detected) whose centers lie
within EDGE px (20 m) of a chip border are don't-care (labeler flagged edge centers as ±10 display px)."""
import sys, json, numpy as np
gt = json.load(open(sys.argv[1])); idx = json.load(open(sys.argv[2])); det = json.load(open(sys.argv[3]))
EDGE = 4; C = 300
D = np.array([[d["px"], d["py"], d["pr"]] for d in det["accepted"]])
tot = dict(tp=0, fp=0, fn=0); per = []; rad_err = []; cen_err = []; bycls = {}
for ch in idx["chips"]:
    L = gt["chips"][ch["chip"]]["circles"]; x0, y0 = ch["x0"], ch["y0"]
    G = [(c["x"]/3+x0-0.5, c["y"]/3+y0-0.5, c["r"]/3, c["class"]) for c in L]   # display (corner) -> pixel-centre
    inside = lambda x,y,m: x0+m <= x < x0+C-m and y0+m <= y < y0+C-m
    Gi = [g for g in G if inside(g[0],g[1],EDGE)]
    Dc = [d for d in D if inside(d[0],d[1],0)]
    used = set(); tp = 0; fn_list = []
    for g in Gi:
        best, bj = 1e9, None
        for j,d in enumerate(Dc):
            if j in used: continue
            e = np.hypot(d[0]-g[0], d[1]-g[1])
            if e < 0.5*g[2] and e < best: best, bj = e, j
        b = bycls.setdefault(g[3], [0,0])
        b[1] += 1
        if bj is None: fn_list.append(g); continue
        used.add(bj); tp += 1; b[0] += 1; cen_err.append(best*20); rad_err.append((Dc[bj][2]-g[2])/g[2])
    fp = [d for j,d in enumerate(Dc) if j not in used and inside(d[0],d[1],EDGE)]
    per.append((ch["chip"], ch["stratum"], len(Gi), tp, len(fp), len(fn_list)))
    tot["tp"] += tp; tot["fp"] += len(fp); tot["fn"] += len(fn_list)
def wilson(k, n, z=1.96):
    if n == 0: return (float('nan'),)*2
    p = k/n; d = 1+z*z/n; c = p+z*z/(2*n); h = z*np.sqrt(p*(1-p)/n + z*z/(4*n*n)); return ((c-h)/d, (c+h)/d)
P = tot["tp"]/(tot["tp"]+tot["fp"]); R = tot["tp"]/(tot["tp"]+tot["fn"])
res = dict(detector=sys.argv[3], **tot, precision=P, precision_ci95=wilson(tot["tp"], tot["tp"]+tot["fp"]),
           recall=R, recall_ci95=wilson(tot["tp"], tot["tp"]+tot["fn"]),
           recall_by_class={k: dict(hit=v[0], n=v[1], recall=v[0]/v[1]) for k,v in bycls.items()},
           center_err_m_median=float(np.median(cen_err)), radius_rel_err_median=float(np.median(rad_err)),
           radius_abs_rel_err_p90=float(np.percentile(np.abs(rad_err),90)),
           per_chip=[dict(chip=a, stratum=b, gt=c, tp=d, fp=e, fn=f) for a,b,c,d,e,f in per])
print(json.dumps({k:v for k,v in res.items() if k!='per_chip'}, indent=1))
for r in res["per_chip"]: print(r)
if len(sys.argv) > 4: json.dump(res, open(sys.argv[4],"w"), indent=1)

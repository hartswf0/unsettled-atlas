import json, os, sys, shutil
R = os.path.dirname(os.path.abspath(__file__))
for c in sys.argv[1:]:
    d = f"{R}/_stage/{c}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    for k, v in json.load(open(f"{R}/{c}/files.json")).items(): os.symlink(v, f"{d}/{k}")
    os.symlink(f"{R}/{c}/index.html", f"{d}/index.html")

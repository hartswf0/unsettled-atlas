"""Build the SCION Family page from scion/SCION_FAMILY.md. Each adapter gets 'Copy full instruction' =
KERNEL + GRAMMAR + ADAPTER, so it can be pasted into an agent as one system prompt."""
import re, html, json
src = open("scion/SCION_FAMILY.md").read()
blocks = re.split(r"(```[\s\S]*?```)", src)
kernel = re.search(r"```\n(SCION — CIRCLE WORKS[\s\S]*?)```", src).group(1)
grammar = re.search(r"```\n(THE CIRCLE GRAMMAR[\s\S]*?)```", src).group(1)
inline = lambda s: re.sub(r"\*([^*]+)\*", r"<em>\1</em>", re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", html.escape(s)))
out, nav, n = [], [], 0; cur_h4 = None
for b in blocks:
    if b.startswith("```"):
        code = b.strip("`").lstrip("\n")
        if code.startswith("ADAPTER") or code.startswith("SCION FORGE"):
            n += 1; full = kernel + "\n\n" + grammar + "\n\n" + code
            out.append(f'<div class="code"><div class="codebar"><span>{html.escape(code.splitlines()[0])}</span>'
                       f'<button class="copy" data-k="{n}">Copy full instruction</button></div><pre>{html.escape(code)}</pre>'
                       f'<script type="application/json" id="p{n}">{json.dumps(full)}</script></div>')
        else:
            n += 1
            out.append(f'<div class="code"><div class="codebar"><span>{html.escape(code.splitlines()[0])}</span>'
                       f'<button class="copy" data-k="{n}">Copy</button></div><pre>{html.escape(code)}</pre>'
                       f'<script type="application/json" id="p{n}">{json.dumps(code)}</script></div>')
        continue
    para = []
    def flush():
        if para: out.append("<p>" + inline(" ".join(para)) + "</p>"); para.clear()
    lst = []
    for line in b.splitlines():
        if line.startswith("#"):
            flush(); lvl = len(line) - len(line.lstrip("#")); t = line.strip("# ").strip()
            if lvl == 1: continue
            sid = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60]
            out.append(f'<h{lvl} id="{sid}">{inline(t)}</h{lvl}>')
            if lvl in (2, 4): nav.append((lvl, sid, t))
        elif re.match(r"^\d+\. ", line):
            flush(); out.append(f'<p class="li">{inline(line)}</p>')
        elif line.strip() == "---": flush()
        elif line.strip() == "": flush()
        else: para.append(line.strip())
    flush()
def lab(l, t):
    if l != 4: return t.split("(")[0].strip()
    code, _, rest = t.partition("·"); name = rest.split("(")[0].strip().capitalize()
    return f"{code.strip()} · {name}"
navhtml = "".join(f'<a class="n{l}" href="#{s}">{html.escape(lab(l, t))}</a>' for l, s, t in nav)
page = open("scion/page_template.html").read().replace("%%NAV%%", navhtml).replace("%%BODY%%", "\n".join(out))
open("scion/index.html", "w").write(page); print("adapters/blocks", n, "nav", len(nav))

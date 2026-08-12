/* Fold the whole game into one file you can just open.

   The modules stay real ES modules — they are rebuilt as blob URLs in
   dependency order at boot and their relative imports are rewritten to point
   at each other. So the single file behaves exactly like the served build,
   including from file:// and inside a sandboxed page.

   node pg/tools/bundle.mjs  ->  perspectival-ground.build.html
*/
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PG = join(HERE, "..");
const ROOT = join(PG, "..");
const ENTRY = "main.js";

const SRC = {};
for (const f of readdirSync(PG)) {
  if (f.endsWith(".js")) SRC[f] = readFileSync(join(PG, f), "utf8");
}

/* who needs whom */
const DEP = /from\s*["']\.\/([\w.\-]+\.js)["']/g;
function depsOf(code) {
  const out = new Set();
  let m;
  DEP.lastIndex = 0;
  while ((m = DEP.exec(code))) out.add(m[1]);
  return [...out];
}

/* dependency order, so a module is never built before what it imports */
const order = [];
const mark = new Map();
(function visit(name, trail = []) {
  if (mark.get(name) === 2) return;
  if (mark.get(name) === 1) throw new Error("import cycle: " + trail.concat(name).join(" -> "));
  if (!SRC[name]) throw new Error("missing module " + name);
  mark.set(name, 1);
  for (const d of depsOf(SRC[name])) visit(d, trail.concat(name));
  mark.set(name, 2);
  order.push(name);
})(ENTRY);

const used = {};
for (const n of order) used[n] = SRC[n];

const shell = readFileSync(join(ROOT, "perspectival-ground.html"), "utf8");

const loader = `
<script>
/* the game, folded into one file — see pg/tools/bundle.mjs */
(function () {
  var SRC = ${JSON.stringify(used)};
  var ORDER = ${JSON.stringify(order)};
  var urls = Object.create(null);
  for (var i = 0; i < ORDER.length; i++) {
    var name = ORDER[i];
    var code = SRC[name].replace(/(["'])\\.\\/([\\w.\\-]+\\.js)\\1/g, function (m, q, dep) {
      return urls[dep] ? JSON.stringify(urls[dep]) : m;
    });
    urls[name] = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  }
  var s = document.createElement("script");
  s.type = "module";
  s.src = urls[${JSON.stringify(ENTRY)}];
  document.body.appendChild(s);
})();
</script>`;

const out = shell.replace(/<script type="module"[^>]*><\/script>/, loader);
if (out === shell) throw new Error("could not find the module tag in the shell");

const dest = join(ROOT, "perspectival-ground.build.html");
writeFileSync(dest, out);
console.log("bundled", order.length, "modules ->", dest,
  (Buffer.byteLength(out) / 1024).toFixed(0) + " KB");
console.log("order:", order.join(" "));

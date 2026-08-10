/* WORLDTEXT · the language
 *
 * Everything reduces to two shapes:
 *
 *     @THING relation @THING
 *     operation @THING
 *
 * Addresses are not names looked up in a table. @F/09/3 is a path down the
 * subdivision, @V/07/3.2.3 is an integer barycentric position, and
 * @X/a|b is its two endpoints in canonical order — so the address computes
 * its own ancestry, its own depth and its own identity. Nothing has to be
 * registered before it can be spoken about.
 */

export function worldtext(K) {
  const world = { F: {}, X: {}, V: {}, P: {}, flows: [], causes: [], log: [] };

  const ref = (addr) => {
    const a = String(addr).trim();
    if (/^@?E$/.test(a)) return { kind: 'E', addr: '@E' };
    if (/^@?F\//.test(a)) { const f = K.parseF(a); return f && { kind: 'F', addr: K.fmtF(f.f, f.path), f }; }
    if (/^@?V\//.test(a)) { const v = K.parseV(a); return v && { kind: 'V', addr: K.fmtV(K.canonVertex(...v)) }; }
    if (/^@?X\//.test(a)) { const x = K.parseX(a); return x && { kind: 'X', addr: K.fmtX(x[0], x[1]) }; }
    if (/^@?P\//.test(a)) return { kind: 'P', addr: '@P/' + a.replace(/^@?P\//, '').toLowerCase() };
    return null;
  };
  const slot = (r) => (world[r.kind] || (world[r.kind] = {}))[r.addr] ||
    ((world[r.kind][r.addr] = { addr: r.addr }), world[r.kind][r.addr]);

  // a face's local aliases: @F/09:v0 and @F/09:e2 resolve to canonical ids,
  // so a person can speak locally while the world stays single-named
  function alias(a) {
    const m = /^(@?F\/[\d/]+):([ve])([012])$/.exec(String(a).trim());
    if (!m) return a;
    const f = K.parseF(m[1]);
    if (!f) return a;
    return m[2] === 'v' ? K.cellVertices(f.f, f.path)[+m[3]] : K.cellEdges(f.f, f.path)[+m[3]];
  }

  const tok = (line) => {
    const out = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(line))) out.push(m[1] !== undefined ? { str: m[1] } : { w: m[2] });
    return out;
  };

  const VERBS = ['place', 'issue', 'has', 'needs', 'carries', 'from', 'to', 'asks',
                 'joins', 'occupies', 'produces', 'risks'];
  const TETRAD = ['enhances', 'obsolesces', 'retrieves', 'reverses'];
  const OPS = ['open', 'split', 'follow', 'meet', 'trace', 'inspect'];

  function run(src) {
    const out = [];
    for (const raw of String(src).split('\n')) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      try { out.push({ line, result: statement(line) }); }
      catch (e) { out.push({ line, error: String(e.message || e) }); }
    }
    return out;
  }

  function statement(line) {
    if (line.startsWith('?')) return query(line.slice(1).trim());

    // @A -thing-> @B
    let m = /^(\S+)\s+-([^->\s]+)->\s+(\S+)$/.exec(line);
    if (m) {
      const a = ref(alias(m[1])), b = ref(alias(m[3]));
      if (!a || !b) throw new Error('unknown address');
      world.flows.push({ from: a.addr, to: b.addr, what: m[2] });
      return `${a.addr} -${m[2]}-> ${b.addr}`;
    }
    // cause => effect
    m = /^(.+?)\s*=>\s*(.+)$/.exec(line);
    if (m && !/^@/.test(m[1].trim())) {
      world.causes.push({ cause: m[1].trim(), effect: m[2].trim() });
      return `${m[1].trim()} => ${m[2].trim()}`;
    }
    // @A.prop := value
    m = /^(@?\S+?)\.(\w+)\s*:=\s*(.+)$/.exec(line);
    if (m) {
      const r = ref(alias(m[1]));
      if (!r) throw new Error('unknown address');
      const val = m[3].trim().replace(/^"|"$/g, '');
      slot(r)[m[2]] = val;
      return `${r.addr}.${m[2]} = ${val}`;
    }
    // @P/name -> @X/...
    m = /^(@?P\/\S+)\s*->\s*(\S+)$/.exec(line);
    if (m) return statement(`${m[1]} occupies ${m[2]}`);

    const t = tok(line);
    // operation @THING
    if (t.length === 2 && t[0].w && OPS.includes(t[0].w)) return operation(t[0].w, alias(t[1].w));
    // @THING verb value…
    if (t.length >= 2 && t[0].w && /^@/.test(t[0].w)) {
      const r = ref(alias(t[0].w));
      if (!r) throw new Error('unknown address ' + t[0].w);
      const verb = t[1].w;
      const rest = t.slice(2).map((x) => (x.str !== undefined ? x.str : x.w)).join(' ');
      if (TETRAD.includes(verb)) {
        const s = slot(r);
        (s.tetrad || (s.tetrad = {}))[verb] = rest;
        return `${r.addr} ${verb} ${rest}`;
      }
      if (!VERBS.includes(verb)) throw new Error('unknown verb ' + verb);
      const s = slot(r);
      if (verb === 'occupies' || verb === 'joins' || verb === 'from' || verb === 'to') {
        const target = ref(alias(rest));
        if (!target) throw new Error('unknown address ' + rest);
        (s[verb] || (s[verb] = [])).push(target.addr);
        if (verb === 'occupies') {
          const ts = slot(target);
          (ts.players || (ts.players = [])).push(r.addr);
        }
        return `${r.addr} ${verb} ${target.addr}`;
      }
      if (['needs', 'carries', 'produces', 'risks', 'has'].includes(verb)) {
        (s[verb] || (s[verb] = [])).push(rest);
      } else s[verb] = rest;
      return `${r.addr} ${verb} ${rest}`;
    }
    throw new Error('not a sentence');
  }

  function operation(op, addr) {
    const r = ref(addr);
    if (!r) throw new Error('unknown address ' + addr);
    if (op === 'split') {
      if (r.kind !== 'F') throw new Error('only a face splits');
      return [0, 1, 2, 3].map((i) => K.fmtF(r.f.f, r.f.path.concat([i])));
    }
    if (op === 'open' || op === 'inspect') return inspect(r);
    if (op === 'follow') {
      if (r.kind !== 'X') throw new Error('only an edge is followed');
      return inspect(r);
    }
    if (op === 'meet') {
      if (r.kind !== 'V') throw new Error('only a vertex is met');
      return inspect(r);
    }
    if (op === 'trace') return world.flows.filter((f) => f.what === addr);
    throw new Error('unknown operation');
  }

  // every element answers the same eight questions
  function inspect(r) {
    const s = (world[r.kind] && world[r.kind][r.addr]) || {};
    const o = { is: r.kind, addr: r.addr, ...s };
    if (r.kind === 'F') {
      const { f, path } = r.f;
      o.contains = [0, 1, 2, 3].map((i) => K.fmtF(f, path.concat([i])));
      o.inside = path.length ? K.fmtF(f, path.slice(0, -1)) : '@E';
      o.corners = K.cellVertices(f, path);
      o.edges = K.cellEdges(f, path);
      o.depth = path.length;
    }
    if (r.kind === 'X') {
      const x = K.parseX(r.addr);
      o.between = [K.fmtV(x[0]), K.fmtV(x[1])];
      o.borders = facesOnEdge(r.addr);
      o.carries = s.carries || [];
      o.players = s.players || [];
    }
    if (r.kind === 'V') {
      o.depth = K.depthOfV(K.parseV(r.addr));
      o.joins = edgesAtVertex(r.addr);
      o.faces = facesAtVertex(r.addr);
    }
    if (r.kind === 'P') {
      o.occupies = s.occupies || [];
      const situ = [];
      for (const x of o.occupies) {
        const i = inspect({ kind: 'X', addr: x });
        situ.push({ edge: x, between: i.between, borders: i.borders, carries: i.carries });
      }
      o.situation = situ;
    }
    o.flowsOut = world.flows.filter((f) => f.from === r.addr);
    o.flowsIn = world.flows.filter((f) => f.to === r.addr);
    return o;
  }

  // which faces carry this edge: step off either side of its midpoint and
  // ask the sphere. Two, always — the addressing test proves it.
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function facesOnEdge(xaddr) {
    const x = K.parseX(xaddr);
    const n = Math.max(K.depthOfV(x[0]), K.depthOfV(x[1]));
    const A = K.point(x[0][0], x[0][1], x[0][2], x[0][3]);
    const B = K.point(x[1][0], x[1][1], x[1][2], x[1][3]);
    const mid = nrm([A[0] + B[0], A[1] + B[1], A[2] + B[2]]);
    const along = nrm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]);
    const side = nrm([mid[1] * along[2] - mid[2] * along[1],
                      mid[2] * along[0] - mid[0] * along[2],
                      mid[0] * along[1] - mid[1] * along[0]]);
    const step = 0.18 * Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const out = [];
    for (const s of [step, -step]) {
      const c = K.cellAt(nrm([mid[0] + side[0] * s, mid[1] + side[1] * s, mid[2] + side[2] * s]), n);
      if (c) { const a = K.fmtF(c.f, c.path); if (!out.includes(a)) out.push(a); }
    }
    return out;
  }
  // the faces around a vertex, by walking a small ring about it
  function facesAtVertex(vaddr) {
    const v = K.parseV(vaddr), n = K.depthOfV(v);
    const P = K.point(v[0], v[1], v[2], v[3]);
    const ref1 = Math.abs(P[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = nrm([P[1] * ref1[2] - P[2] * ref1[1], P[2] * ref1[0] - P[0] * ref1[2], P[0] * ref1[1] - P[1] * ref1[0]]);
    const e2 = nrm([P[1] * e1[2] - P[2] * e1[1], P[2] * e1[0] - P[0] * e1[2], P[0] * e1[1] - P[1] * e1[0]]);
    const r = 0.12 / Math.pow(2, n);
    const out = [];
    for (let a = 0; a < 24; a++) {
      const th = (a / 24) * Math.PI * 2;
      const q = nrm([P[0] + (e1[0] * Math.cos(th) + e2[0] * Math.sin(th)) * r,
                     P[1] + (e1[1] * Math.cos(th) + e2[1] * Math.sin(th)) * r,
                     P[2] + (e1[2] * Math.cos(th) + e2[2] * Math.sin(th)) * r]);
      const c = K.cellAt(q, n);
      if (!c) continue;
      const addr = K.fmtF(c.f, c.path);
      if (!out.includes(addr) && K.cellVertices(c.f, c.path).includes(vaddr)) out.push(addr);
    }
    return out;
  }
  function edgesAtVertex(vaddr) {
    const out = [];
    for (const fa of facesAtVertex(vaddr)) {
      const f = K.parseF(fa);
      for (const e of K.cellEdges(f.f, f.path)) {
        if (e.indexOf(vaddr.slice(3)) >= 0 && !out.includes(e)) out.push(e);
      }
    }
    return out;
  }
  // a face touches the faces on the far side of its three edges
  function touches(r) {
    if (r.kind !== 'F') return [];
    const me = r.addr;
    const out = [];
    for (const e of K.cellEdges(r.f.f, r.f.path)) {
      for (const fa of facesOnEdge(e)) if (fa !== me && !out.includes(fa)) out.push(fa);
    }
    return out;
  }

  function query(q) {
    let m = /^children\s+(\S+)$/.exec(q);
    if (m) return operation('split', alias(m[1]));
    m = /^(edges|corners|touches|inside|contains)\s+(\S+)$/.exec(q);
    if (m) {
      const i = inspect(ref(alias(m[2])));
      return m[1] === 'edges' ? i.edges
        : m[1] === 'corners' ? i.corners
        : m[1] === 'inside' ? i.inside
        : m[1] === 'touches' ? touches(ref(alias(m[2])))
        : i.contains;
    }
    m = /^carries\s+(\S+)$/.exec(q);
    if (m) return Object.values(world.X).filter((x) => (x.carries || []).includes(m[1])).map((x) => x.addr);
    m = /^tetrad\s+(\S+)$/.exec(q);
    if (m) {
      const r = ref(alias(m[1]));
      const s = (world[r.kind] || {})[r.addr] || {};
      return s.tetrad || {};
    }
    const r = ref(alias(q));
    if (r) return inspect(r);
    throw new Error('cannot answer');
  }

  return { world, run, statement, query, inspect, ref, alias };
}

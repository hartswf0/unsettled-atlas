/* PERSPECTIVAL GROUND — other people, actually.

   No server. A ground names a room, the room is a topic on a public MQTT
   broker, and everybody holding the same link is on the same cloth. Marks
   arrive as they are drawn. Bodies show where they are. The retained message
   is where the cloth rests between visits, so a ground you made last week is
   still there when somebody opens the link today.

   Share the link, share the ground. That is the whole model, and it is the
   same one the Living Mapmaker uses, because it is the one that works with
   nothing behind it.

   If the brokers are unreachable — offline, a locked-down network, a sandboxed
   page that forbids sockets — nothing breaks. The ground goes local, the game
   is exactly as playable, and travellers.js keeps the city populated. */

import { S, ME, apply, on, emit } from "./state.js";

/* a ground can name its own meeting point; otherwise it asks the public ones */
const BROKERS = (() => {
  const q = new URLSearchParams(location.search).get("broker");
  if (q && /^wss?:\/\//.test(q)) return [q];
  /* Port 443 first: it is the one port that is open on hotel wifi, on phone
     networks and behind office firewalls, and a meeting place nobody can
     reach is not a meeting place. The rest are tried in turn after it. */
  return [
    "wss://mqtt.eclipseprojects.io/mqtt",
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt",
  ];
})();

/* ---------- which ground are we on ---------- */
export const GID = (() => {
  const h = (location.hash || "").replace(/^#/, "");
  const m = /(?:^|&)g=([A-Za-z0-9_-]{3,24})/.exec(h);
  if (m) return m[1];
  let g = "";
  try { g = localStorage.getItem("pg.gid") || ""; } catch {}
  if (!g) {
    g = Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem("pg.gid", g); } catch {}
  }
  return g;
})();

export function groundLink() {
  /* whatever meeting place this ground is using travels with the link */
  const q = new URLSearchParams(location.search).get("broker");
  const search = q ? "?broker=" + encodeURIComponent(q) : "";
  return location.origin + location.pathname + search + "#g=" + GID;
}

const SITE = ME + Math.random().toString(36).slice(2, 6);
const TOPIC = "unsettled-atlas/perspectival/" + GID;
const SNAP = TOPIC + "/cloth";

export const net = { state: "connecting", tried: 0, peers: new Map(), gotCloth: false };

/* The crossing belongs to the ground, not to whoever opened it first. The
   first person here publishes it; everybody after inherits it, so a link is a
   link to one game rather than to three separate ones that happen to share
   drawings. */
export let groundCrossing = null;
let crossingFromNet = false;

export function shareCrossing(home) {
  /* a crossing we were handed is not ours to overwrite */
  if (crossingFromNet) return;
  groundCrossing = home;
  if (!mqtt || !mqtt.ready) return;
  try {
    mqtt.publishRetained(JSON.stringify({ g: GID, from: SITE, cloth: 1, home, ops: cloakOps() }));
  } catch {}
}

/* ============================================================
   MQTT over a websocket, by hand
   ============================================================ */
function MqttClient(url, topic, snapTopic, onMsg, onOpen, onFail) {
  let ws, ready = false, ping = 0, closedOut = false, failed = false;
  const self = this;
  const cid = "pg" + SITE;
  const enc = (s) => new TextEncoder().encode(s);
  const rem = (len) => {
    const out = [];
    do { let d = len % 128; len = Math.floor(len / 128); if (len > 0) d |= 128; out.push(d); } while (len > 0);
    return out;
  };
  const pack = (type, flags, payload) => {
    const head = [(type << 4) | flags].concat(rem(payload.length));
    const buf = new Uint8Array(head.length + payload.length);
    buf.set(head, 0); buf.set(payload, head.length);
    return buf;
  };
  const strBuf = (s) => {
    const b = enc(s), o = new Uint8Array(b.length + 2);
    o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2);
    return o;
  };
  const cat = (...parts) => {
    const n = parts.reduce((a, p) => a + p.length, 0);
    const o = new Uint8Array(n);
    let off = 0;
    for (const p of parts) { o.set(p, off); off += p.length; }
    return o;
  };

  try { ws = new WebSocket(url, ["mqtt"]); } catch { onFail && onFail(); return; }
  ws.binaryType = "arraybuffer";
  const guard = setTimeout(() => {
    if (!ready) { failed = true; try { ws.close(); } catch {} onFail && onFail(); }
  }, 7000);

  ws.onopen = () => {
    const vh = cat(strBuf("MQTT"), new Uint8Array([4, 0x02, 0, 30]));
    ws.send(pack(1, 0, cat(vh, strBuf(cid))));
  };
  const die = () => {
    ready = false; self.ready = false;
    if (!failed) { failed = true; clearTimeout(guard); onFail && onFail(); }
  };
  ws.onerror = die;
  ws.onclose = die;

  /* a websocket frame is not an mqtt packet: brokers split and coalesce
     freely, so everything arriving is one continuous stream */
  let inbuf = new Uint8Array(0);
  function feed(chunk) {
    if (inbuf.length) {
      const merged = new Uint8Array(inbuf.length + chunk.length);
      merged.set(inbuf, 0); merged.set(chunk, inbuf.length);
      inbuf = merged;
    } else inbuf = chunk;
    let off = 0;
    for (;;) {
      if (inbuf.length - off < 2) break;
      const type = inbuf[off] >> 4;
      let mult = 1, len = 0, j = off + 1, byte, bytes = 0, complete = false;
      do {
        if (j >= inbuf.length) break;
        byte = inbuf[j++]; len += (byte & 127) * mult; mult *= 128; bytes++;
        if (!(byte & 128)) { complete = true; break; }
      } while (bytes < 4);
      if (!complete) break;
      if (inbuf.length - j < len) break;
      handle(type, inbuf.subarray(j, j + len));
      off = j + len;
      if (closedOut) return;
    }
    inbuf = off ? inbuf.subarray(off) : inbuf;
  }
  function handle(type, body) {
    if (type === 2) {
      if (body.length >= 2 && body[1] === 0) {
        ready = true; self.ready = true;
        clearTimeout(guard);
        ws.send(pack(8, 2, cat(new Uint8Array([0, 1]),
          strBuf(topic), new Uint8Array([0]),
          strBuf(snapTopic), new Uint8Array([0]))));
        ping = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch {} }, 20000);
        onOpen && onOpen();
      } else {
        closedOut = true; failed = true; clearTimeout(guard);
        try { ws.close(); } catch {}
        onFail && onFail();
      }
    } else if (type === 3) {
      if (body.length < 2) return;
      const tl = (body[0] << 8) | body[1];
      try { onMsg(new TextDecoder().decode(body.subarray(2 + tl))); } catch {}
    }
  }
  ws.onmessage = (ev) => {
    try {
      const d = typeof ev.data === "string" ? new TextEncoder().encode(ev.data) : new Uint8Array(ev.data);
      feed(d);
    } catch {}
  };
  this.ready = false;
  this.publish = (str) => {
    if (!ready) return;
    try { ws.send(pack(3, 0, cat(strBuf(topic), enc(str)))); } catch {}
  };
  /* the only thing on a public broker that outlives the people holding it:
     where the cloth rests between visits */
  this.publishRetained = (str) => {
    if (!ready) return;
    try { ws.send(pack(3, 1, cat(strBuf(snapTopic), enc(str)))); } catch {}
  };
  this.close = () => { clearInterval(ping); try { ws.close(); } catch {} };
}

/* ============================================================
   the ground's conversation
   ============================================================ */
let mqtt = null;

function send(obj) {
  if (!mqtt || !mqtt.ready) return;
  try { mqtt.publish(JSON.stringify(obj)); } catch {}
}

function onMessage(str) {
  let m;
  try { m = JSON.parse(str); } catch { return; }
  if (!m || m.g !== GID || m.from === SITE) return;

  /* Whoever was here first named the crossing, and the retained message is
     the record of it. Anyone arriving adopts it — including someone who has
     already guessed at one of their own, because a shared link has to be a
     shared game and not three games with the same drawings in them. */
  if (m.home != null && !crossingFromNet && m.home !== groundCrossing) {
    crossingFromNet = true;
    groundCrossing = m.home;
    emit("ground", { home: m.home });
  }
  if (m.ops) {
    for (const op of m.ops) apply(op, { local: false });
    if (m.cloth) net.gotCloth = true;
  }
  if (m.pres) {
    net.peers.set(m.pres.a, { ...m.pres, at: Date.now() });
    emit("peer", m.pres);
  }
  if (m.hello) {
    /* somebody just arrived: hand them the ground as it stands */
    setTimeout(() => publishCloth(), 200 + Math.random() * 500);
  }
}

function cloakOps() {
  const ops = [];
  for (const mk of S.marks.slice(-160)) {
    ops.push({ k: "mark", id: mk.id, pts: mk.pts, w: mk.width, by: mk.by, b: mk.being, t: mk.t });
  }
  for (const j of S.journeys) {
    if (j.ghost) ops.push({ k: "ghost", id: j.id, pts: j.pts, t: j.t });
  }
  return ops;
}

export function publishCloth() {
  if (!mqtt || !mqtt.ready) return;
  const ops = cloakOps();
  if (!ops.length && groundCrossing == null) return;
  try {
    mqtt.publishRetained(JSON.stringify({
      g: GID, from: SITE, cloth: 1, home: groundCrossing, ops,
    }));
  } catch {}
}

/* everything a person does to the ground goes out as it happens */
export function connect() {
  on("mark", (mk) => {
    if (mk.by !== ME) return;
    send({ g: GID, from: SITE, ops: [{ k: "mark", id: mk.id, pts: mk.pts, w: mk.width, by: mk.by, b: mk.being, t: mk.t }] });
    publishCloth();
  });
  on("ghost", (gh) => {
    send({ g: GID, from: SITE, ops: [{ k: "ghost", id: gh.id, pts: gh.pts, t: gh.t }] });
  });
  dial();
  setInterval(presence, 2600);
}

function presence() {
  const me = S.you;
  if (!me) return;
  send({ g: GID, from: SITE, pres: { a: ME, x: me.x, y: me.y, b: S.being.id } });
  /* forget anybody who has not spoken in half a minute */
  const now = Date.now();
  for (const [k, v] of net.peers) if (now - v.at > 30000) net.peers.delete(k);
}

function dial() {
  if (net.tried >= BROKERS.length || net.state === "open") return;
  const url = BROKERS[net.tried++];
  mqtt = new MqttClient(url, TOPIC, SNAP, onMessage,
    () => {
      net.state = "open";
      emit("net", net);
      send({ g: GID, from: SITE, hello: 1 });
      presence();
      if (groundCrossing != null) shareCrossing(groundCrossing);
      setTimeout(() => { if (!net.gotCloth) publishCloth(); }, 3200);
    },
    () => {
      mqtt = null;
      net.state = net.tried >= BROKERS.length ? "local" : "connecting";
      emit("net", net);
      setTimeout(dial, 700);
    });
}

export const peers = () => [...net.peers.values()];

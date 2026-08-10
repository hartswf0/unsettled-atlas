# WORLDTEXT

*An address-first world language, not a command vocabulary glued onto a map.*

```
@F/09 place "Nile Basin"
split @F/09
@F/09/0 -water-> @F/09/3
@P/watson -> @F/09:e2
? @P/watson
```

Every face, edge and vertex of a recursively subdivided Earth has **one
canonical address**, derived rather than assigned. There is no registry, no
id counter, nothing to keep in sync. A sentence is either

```
@THING relation @THING
operation @THING
```

and that is the whole grammar.

---

## Why the addressing had to come first

Faces are easy: `@F/09/3/2` is a path down the four-way subdivision, so the
address carries its own ancestry and depth. No lookup is needed to know
where it belongs.

Edges are the trap. Two faces share an edge, so naming it `F09.e2` from one
side and `F05.e0` from the other invents two names for one thing — and every
claim, every participant and every dependency attached to it silently splits
in half. Vertices are worse: five faces meet at each of the twelve original
ones, six at every vertex generated afterwards.

So a vertex is addressed by integer barycentric position inside a base face,

```
@V/07/3.2.3          i + j + k = 2^depth, so the depth needs no writing down
```

and made canonical by two rules:

- **Reduce.** `(6,4,6)` and `(3,2,3)` are the same point met at different
  depths, so divide through while every coordinate is even. A vertex has one
  address no matter how deep you were when you found it.
- **Seam.** A point on a face boundary can be named by both faces, a base
  corner by five. Take the smallest `(face, i, j, k)`. The seam loses its
  ability to duplicate anything.

An edge is then just its two canonical vertices in canonical order, so
`EDGE(A,B)` and `EDGE(B,A)` are the same string:

```
@X/08/1.1.0|09/1.1.0
```

### The claim is checked, not asserted

Euler's formula tests the whole scheme at once. If every triangle names its
three edges canonically, then across a closed surface each edge must be
named by exactly two triangles, and the counts must satisfy `E = 3F/2` and
`V − E + F = 2`. A duplicated name shows up immediately as an edge counted
once; a collision as one counted three times.

```
depth 0:  20 faces    30 edges    12 vertices   V − E + F = 2
depth 1:  80 faces   120 edges    42 vertices   V − E + F = 2
depth 2: 320 faces   480 edges   162 vertices   V − E + F = 2
depth 3: 1280 faces 1920 edges   642 vertices   V − E + F = 2
```

`node address.test.mjs` also checks that an edge reads the same from either
end, that a vertex keeps one address at every depth, that the twelve
planetary vertices survive as twelve, and that two different points never
collide onto one address.

---

## Geometry hands a person their situation

This is the part that makes the addressing worth the trouble. Assign a
person to an edge:

```
@P/watson -> @F/09:e2
```

and ask what their situation is:

```
? @P/watson

OCCUPIES   @X/00/0.0.1|05/1.0.0
BETWEEN    @V/00/0.0.1  @V/05/1.0.0
BORDERS    @F/09  @F/05
```

Nothing was configured. No role table, no membership list. You assign the
edge and the geometry supplies two endpoint convergences and two adjacent
situations, which is exactly the structural property a syntegration needs —
a participant who cannot optimise either end alone.

Local aliases keep it speakable — `@F/09:e2` resolves to the canonical edge,
so a person can talk locally while the world stays single-named.

---

## The tetrad

A tetrad is four readings of one cell with six tensions between them, which
is the shape of K4 — the tetrahedron's graph. That is a real correspondence
about the *relations*, and it is worth being precise about what it is not.

A triangle also has four children. It would be very tempting to say child 0
is *enhances* and child 3 is *reverses*. **That is a category error**: the
north corner of a triangle is not what it retrieves. The four children are
ground; the tetrad is a reading. Both being four is a coincidence to resist.

So a tetrad is stored as properties of a cell, and the tests check that it
does not leak into the children:

```
@F/09 enhances   "upstream generating capacity"
@F/09 obsolesces "unmetered seasonal flooding"
@F/09 retrieves  "the negotiated basin, older than either state"
@F/09 reverses   "into a downstream water emergency when filling is fast"

? tetrad @F/09
```

---

## The language

**Addresses**

```
@E                the whole
@F/09/3/2         face — where something happens
@X/a|b            edge — what passes between
@V/07/3.2.3       vertex — where relationships meet
@P/name           person
@F/09:v0 :e2      local aliases, resolved to canonical ids
```

**Relations** — `place issue has needs carries produces risks from to asks joins occupies`

**Operations** — `open split follow meet trace inspect`

**Operators**

```
/            containment
->           occupation
-water->     flow, with the noun that crosses the boundary
=>           consequence
:=           set
?            query
```

An edge never says `CONNECTED_TO`. It says what crosses it, which is what
makes the graph causal rather than decorative. And `-water->` is kept
separate from `=>` so that material flow and consequence never get confused
for one another.

**Queries**

```
? @F/09
? children @F/09
? edges @F/09
? touches @F/09/3
? tetrad @F/09
? @P/watson
```

Every element answers the same questions: what am I, what contains me, what
do I contain, what touches me, what do I connect to, who is assigned to me,
what is happening here.

---

## Run it

```
node address.test.mjs      # the addressing claims, against Euler
node worldtext.test.mjs    # the language, against a worked Nile passage
```

Open `index.html` from any static server for a REPL. It needs a server
rather than `file://` because it loads ES modules.

```
python3 -m http.server 8000
```

---

## Where this came from

`icosa.data.js` is compiled geometry: the icosahedron, its orientation on
the Earth, and the unfolding net. Neither the orientation nor the net is
transcribed from Fuller — both are solved from his criteria against
coastline data. No vertex on land (the closest is 267 km offshore), and cut
where there is no land.

That work, along with the map this language addresses, the compiled
councils and the syntegration instrument, lives in
[unsettled-atlas](https://github.com/hartswf0/unsettled-atlas).

Natural Earth, public domain, supplies the coastlines.

---

## What this does not do yet

- **No simulation.** `simulate` and `compare` are in the sketch and not in
  the parser. Consequences are recorded as stated, not computed.
- **No time or branches.** `@F/09 at 2026` and scenario branches are the
  right design — address tells where, time tells when, branch tells which
  possible world, kept orthogonal — and none of it is built.
- **Edges do not subdivide yet.** A face splits into four; an edge should
  resolve into the several lower-scale dependencies it is made of, and a
  vertex into the parties that meet at it. The addressing supports it; the
  language does not express it.
- **No persistence.** The REPL holds a world in memory and loses it on
  reload.

/* The language, run against the passage it was designed for. */
import { kernel } from './address.mjs';
import { worldtext } from './worldtext.mjs';

globalThis.window = {};
await import('./icosa.data.js');
const D = window.ICOSA_WORLD_DATA;
const W = worldtext(kernel(D.ico.vertices, D.ico.faces));

let failures = 0;
const claim = (name, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name.padEnd(50)} ${detail}`);
};

const PASSAGE = `
@F/09 place "Nile Basin"
@F/09 issue "Upstream electricity and downstream water security are coupled."

split @F/09

@F/09/0 place "Ethiopian Highlands"
@F/09/1 place "GERD"
@F/09/2 place "Sudanese Nile"
@F/09/3 place "Egyptian Nile"

@F/09/0 -water-> @F/09/1
@F/09/1 -water-> @F/09/2
@F/09/2 -water-> @F/09/3

@F/09:e2 carries water
@F/09:e2 asks "who is upstream"

low-water => crop-failure
crop-failure => food-price
food-price => displacement

@F/09.issue := "Nile allocation"

@F/09 enhances "upstream generating capacity"
@F/09 obsolesces "unmetered seasonal flooding"
@F/09 retrieves "the negotiated basin, older than either state"
@F/09 reverses "into a downstream water emergency when filling is fast"
`;

const out = W.run(PASSAGE);
const errs = out.filter((r) => r.error);
claim('the passage runs', errs.length === 0, errs.map((e) => e.line + ' → ' + e.error).join(' | '));

claim('a face holds what happens there',
  W.world.F['@F/09'].place === 'Nile Basin' && W.world.F['@F/09'].issue === 'Nile allocation',
  W.world.F['@F/09'].issue);

claim('split produced four addressed children',
  W.query('children @F/09').join(' ') === '@F/09/0 @F/09/1 @F/09/2 @F/09/3');

claim('flow is a noun on an arrow', W.world.flows.length === 3 && W.world.flows[0].what === 'water',
  W.world.flows.map((f) => f.what).join(','));

claim('consequence is separate from flow', W.world.causes.length === 3,
  W.world.causes.map((c) => c.cause + '=>' + c.effect).join(' '));

// the local alias must resolve to the canonical edge, and the canonical
// edge must be the same object seen from the neighbouring face
{
  const e2 = W.alias('@F/09:e2');
  const insp = W.query(e2);
  const other = insp.borders.find((f) => f !== '@F/09');
  const shared = other ? W.query('edges ' + other).includes(e2) : false;
  claim('a local alias resolves to one canonical edge', /^@X\//.test(e2), e2);
  claim('the neighbour names the same edge', shared, 'borders ' + insp.borders.join(' '));
  claim('the edge carries what was said of it', (insp.carries || []).includes('water'));
}

// a person occupies an edge and inherits their situation from geometry
{
  const e2 = W.alias('@F/09:e2');
  W.statement('@P/watson -> ' + e2);
  const p = W.query('@P/watson');
  claim('a person occupies an edge', p.occupies.length === 1, p.occupies[0]);
  claim('geometry hands them their situation',
    p.situation[0].between.length === 2 && p.situation[0].borders.length === 2,
    'between ' + p.situation[0].between.join(' ') + ' · borders ' + p.situation[0].borders.join(' '));
}

// the tetrad is four readings of one cell, not four pieces of it
{
  const t = W.query('tetrad @F/09');
  const keys = Object.keys(t).sort().join(' ');
  claim('a tetrad is four readings', keys === 'enhances obsolesces retrieves reverses', keys);
  const kids = W.query('children @F/09');
  claim('and is not the four children', kids.length === 4 && !kids.some((k) => t[k]),
    'children stay ground: ' + kids.join(' '));
}

// every element answers the same questions
{
  const f = W.query('@F/09/3');
  claim('a face knows what contains it and what it contains',
    f.inside === '@F/09' && f.contains.length === 4 && f.corners.length === 3 && f.edges.length === 3);
  const v = W.query(f.corners[0]);
  claim('a vertex knows the edges that meet there', v.joins.length >= 5,
    v.joins.length + ' edges, ' + v.faces.length + ' faces');
}

console.log(failures ? `\n${failures} FAILED` : '\nworldtext holds');
process.exit(failures ? 1 : 0);

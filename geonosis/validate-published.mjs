#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT=process.argv[2]||'geonosis/data';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const m=read(join(ROOT,'manifest.json'));
assert.equal(m.schema,'geonosis-compiled-index-v0.1');
assert(Array.isArray(m.prefixes)&&m.prefixes.length>0);
assert(Array.isArray(m.leaves)&&m.leaves.length>0);
const rx=/^F\d{2}(?:\.[0-3]+)?$/;
function desc(parent,child){return parent===child||child.indexOf(parent+'.')===0||(parent.indexOf('.')>=0&&child.indexOf(parent)===0);}
for(const slug of m.prefixes){
  assert(rx.test(slug),`bad prefix ${slug}`);
  const p=join(ROOT,'cells',`${slug}.json`);assert(existsSync(p),`missing bundle ${slug}`);
  const b=read(p);assert.equal(b.atlas_address,slug);
  for(const s of b.signals||[]){assert(s.atlas_address,`unaddressed signal leaked into ${slug}`);assert(desc(slug,s.atlas_address),`signal ${s.id} not under ${slug}`);}
  for(const e of b.entities||[]){assert(e.atlas_address,`unaddressed entity leaked into ${slug}`);assert(desc(slug,e.atlas_address),`entity ${e.id} not under ${slug}`);}
  for(const s of b.statements||[]){assert(s.atlas_address,`unaddressed statement leaked into ${slug}`);assert(desc(slug,s.atlas_address),`statement ${s.id} not under ${slug}`);assert(Array.isArray(s.evidence));}
}
const scoped=read(join(ROOT,'scoped.json'));
for(const x of scoped.records||[]){if(x.kind==='signal'||x.kind==='statement'||x.kind==='entity')assert(!x.record.atlas_address,`addressed ${x.kind} should not be in scoped.json`);}
process.stdout.write(JSON.stringify({ok:true,prefixes:m.prefixes.length,leaves:m.leaves.length,regions:(m.regions||[]).map(r=>r.id),scoped_records:(scoped.records||[]).length},null,2)+'\n');

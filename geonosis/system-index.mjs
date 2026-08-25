#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=resolve(process.argv[2]||'geonosis/system-data');
const regions=[];
if(existsSync(root))for(const name of readdirSync(root)){
  const dir=join(root,name);if(!statSync(dir).isDirectory())continue;const mf=join(dir,'manifest.json');if(!existsSync(mf))continue;const m=JSON.parse(readFileSync(mf,'utf8'));regions.push({id:name,label:m.region||name,center:m.center||null,generated_at:m.generated_at||null,counts:m.counts||{},source_health:m.source_health||{},manifest:`${name}/manifest.json`,map:`${name}/map.json`,events:`${name}/events.json`,possibilities:`${name}/possibilities.json`,subjects:`${name}/subjects.json`,current:`${name}/current.json`});
}
regions.sort((a,b)=>a.label.localeCompare(b.label));
writeFileSync(join(root,'index.json'),JSON.stringify({schema:'geonosis-system-index-v1',generated_at:new Date().toISOString(),regions},null,2)+'\n');
process.stdout.write(JSON.stringify({root,regions:regions.length},null,2)+'\n');

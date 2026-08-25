import { normalizeSignal, pointGeometry } from './schema.mjs';

const UA = 'Unsettled-Atlas-Geonosis/0.3 (https://github.com/hartswf0/unsettled-atlas)';

async function fetchJSON(url, options = {}, timeoutMs = 25000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ac.signal, headers: { 'User-Agent': UA, Accept: 'application/json', ...(options.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} · ${url}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function rowsOf(data) { return (data?.data || []).map(x => x?.data || x).filter(Boolean); }
function haversineKm(aLat,aLon,bLat,bLon){const R=6371.0088,d=Math.PI/180,p1=aLat*d,p2=bLat*d,dp=(bLat-aLat)*d,dl=(bLon-aLon)*d,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}

const STATE_BY_FIPS = {'01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY','60':'AS','66':'GU','69':'MP','72':'PR','78':'VI'};

async function censusCounty(ctx) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
  url.searchParams.set('x', String(ctx.lon)); url.searchParams.set('y', String(ctx.lat));
  url.searchParams.set('benchmark','Public_AR_Current'); url.searchParams.set('vintage','Current_Current'); url.searchParams.set('format','json');
  const data = await fetchJSON(url); const c = data?.result?.geographies?.Counties?.[0]; if (!c) return null;
  const sf=String(c.STATE||'').padStart(2,'0'), cf=String(c.COUNTY||'').padStart(3,'0');
  return { state: STATE_BY_FIPS[sf] || null, state_fips:sf, county_fips:cf, geoid:c.GEOID||sf+cf, name:c.NAME||c.BASENAME||null, query_url:url.toString() };
}

async function fdic(endpoint, params) {
  const url = new URL(`https://api.fdic.gov/banks/${endpoint}`);
  Object.entries(params).forEach(([k,v]) => v != null && url.searchParams.set(k,String(v)));
  return { url, data: await fetchJSON(url) };
}

export const WAVE2_ADAPTERS = {
  'fdic-locations': async function(ctx) {
    const county = await censusCounty(ctx); if (!county?.state) return [];
    const { url, data } = await fdic('locations', { filters:`STALP:${county.state}`, limit:10000, offset:0, format:'json' });
    const out=[];
    for (const r of rowsOf(data)) {
      const lat=num(r.LATITUDE), lon=num(r.LONGITUDE); if (lat==null||lon==null||haversineKm(ctx.lat,ctx.lon,lat,lon)>ctx.radiusKm) continue;
      out.push(normalizeSignal({ source:'fdic-locations', source_record_id:r.ID ?? `${r.CERT}:${r.OFFNUM}`, predicate:'money.bank_branch', value:{ cert:r.CERT??null, branch_id:r.OFFNUM??r.ID??null, institution_name:r.NAME??null, branch_name:r.OFFNAME??null, main_office:r.MAINOFF??null, service_type:r.SERVTYPE_DESC??r.SERVTYPE??null, address:r.ADDRESS??null, city:r.CITY??null, state:r.STALP??null, zip:r.ZIP??null, fi_uninum:r.FI_UNINUM??null }, geometry:pointGeometry(lon,lat), epistemic:'REPORTED', observed_at:r.RUNDATE?new Date(r.RUNDATE).toISOString():null, actors:['GROUND','HUMAN','SERVICE','ECONOMY'], provenance:{ query_url:url.toString(), provider:'FDIC BankFind Suite' } }));
    }
    return out.slice(0,ctx.limit||500);
  },

  'fdic-sod': async function(ctx) {
    const county = await censusCounty(ctx); if (!county?.state) return [];
    const year = new Date().getUTCFullYear()-1;
    const { url, data } = await fdic('sod', { filters:`STALPBR:${county.state} AND YEAR:${year}`, limit:10000, offset:0, format:'json' });
    const out=[];
    for (const r of rowsOf(data)) {
      const lat=num(r.SIMS_LATITUDE ?? r.LATITUDE), lon=num(r.SIMS_LONGITUDE ?? r.LONGITUDE); if (lat==null||lon==null||haversineKm(ctx.lat,ctx.lon,lat,lon)>ctx.radiusKm) continue;
      const dep=num(r.DEPSUMBR ?? r.DEPSUM);
      out.push(normalizeSignal({ source:'fdic-sod', source_record_id:`${r.YEAR}:${r.CERT}:${r.BRNUM??r.UNINUMBR}`, predicate:'money.branch_deposits', value:{ year:num(r.YEAR)??year, cert:r.CERT??null, branch_id:r.BRNUM??r.UNINUMBR??null, institution_name:r.NAMEFULL??r.NAME??null, branch_name:r.NAMEBR??r.OFFNAME??null, deposits_usd:dep==null?null:dep*1000, address:r.ADDRESBR??r.ADDRESS??null, city:r.CITYBR??r.CITY??null, state:r.STALPBR??r.STALP??null, zip:r.ZIPBR??r.ZIP??null }, unit:'USD', geometry:pointGeometry(lon,lat), epistemic:'REPORTED', valid_from:`${year}-06-30`, valid_to:`${year}-06-30`, actors:['GROUND','HUMAN','SERVICE','ECONOMY'], provenance:{ query_url:url.toString(), provider:'FDIC Summary of Deposits', note:'Branch deposits are reported in thousands of dollars by FDIC; normalized here to USD.' } }));
    }
    return out.slice(0,ctx.limit||500);
  },

  'hmda-lenders': async function(ctx) {
    const county=await censusCounty(ctx); if(!county) return [];
    const year=new Date().getUTCFullYear()-1;
    const url=new URL('https://ffiec.cfpb.gov/v2/data-browser-api/view/filers');
    url.searchParams.set('counties',county.geoid); url.searchParams.set('years',String(year));
    const data=await fetchJSON(url); const inst=data?.institutions||[];
    return inst.slice(0,Math.min(ctx.limit||200,500)).map(r=>normalizeSignal({ source:'hmda-lenders', source_record_id:`${year}:${county.geoid}:${r.lei}`, predicate:'money.hmda_lender_presence', value:{ lei:r.lei||null, name:r.name||null, year:r.period||year, county_geoid:county.geoid, county_name:county.name, state:county.state }, geometry:null, epistemic:'REPORTED', actors:['HUMAN','SERVICE','ECONOMY'], provenance:{ query_url:url.toString(), provider:'CFPB / FFIEC HMDA Data Browser', geographic_scope:'county', census_geocoder:county.query_url } }));
  }
};

export const WAVE2_DEFAULTS=['fdic-locations','fdic-sod','hmda-lenders'];

function leiValue(data) {
  const a=data?.data?.attributes || {}; const e=a.entity || {};
  return { lei:data?.data?.id||null, legal_name:e.legalName?.name||null, jurisdiction:e.jurisdiction||null, entity_status:e.status||null, legal_address:e.legalAddress||null, headquarters_address:e.headquartersAddress||null };
}

async function optionalJSON(url) { try { return await fetchJSON(url,{headers:{Accept:'application/vnd.api+json'}}); } catch(e) { if(String(e.message).startsWith('404 ')) return null; throw e; } }

export async function enrichGLEIF(signals, ctx={}) {
  const leis=[...new Set(signals.filter(s=>s.source==='hmda-lenders').map(s=>s.value?.lei).filter(Boolean))].slice(0,Math.min(ctx.gleifLimit||30,50));
  const out=[];
  for (const lei of leis) {
    const base=`https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(lei)}`;
    const record=await optionalJSON(base); if(record?.data) out.push(normalizeSignal({ source:'gleif-entity', source_record_id:lei, predicate:'ownership.lei_entity', value:leiValue(record), geometry:null, epistemic:'REPORTED', actors:['ECONOMY'], provenance:{ source_url:base, provider:'GLEIF' } }));
    for (const level of ['direct','ultimate']) {
      const purl=`${base}/${level}-parent`; const parent=await optionalJSON(purl); if(!parent?.data) continue;
      const pv=leiValue(parent); if(!pv.lei) continue;
      out.push(normalizeSignal({ source:'gleif-parent', source_record_id:`${lei}:${level}:${pv.lei}`, predicate:`ownership.${level}_parent`, value:{ child_lei:lei, parent_lei:pv.lei, parent_name:pv.legal_name, level, parent_jurisdiction:pv.jurisdiction }, geometry:null, epistemic:'REPORTED', actors:['ECONOMY'], provenance:{ source_url:purl, provider:'GLEIF', relation_basis:'accounting consolidation' } }));
    }
  }
  return out;
}

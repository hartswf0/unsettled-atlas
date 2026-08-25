import { normalizeSignal, pointGeometry } from './schema.mjs';

const UA='Unsettled-Atlas-Geonosis/0.2.5 (https://github.com/hartswf0/unsettled-atlas)';

async function fetchJSON(url,options={},timeoutMs=25000){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeoutMs);
  try{
    const res=await fetch(url,{...options,signal:ac.signal,headers:{'User-Agent':UA,Accept:'application/json',...(options.headers||{})}});
    if(!res.ok)throw new Error(`${res.status} ${res.statusText} · ${url}`);
    return await res.json();
  }finally{clearTimeout(timer);}
}
function bbox(lat,lon,radiusKm){const dy=radiusKm/110.574,dx=radiusKm/(111.320*Math.max(.1,Math.cos(lat*Math.PI/180)));return[lon-dx,lat-dy,lon+dx,lat+dy];}
function asISO(v){if(v==null||v==='')return null;const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():String(v);}
function dateDaysAgo(days){return new Date(Date.now()-days*86400000).toISOString().slice(0,10);}
function locationPoint(v){
  if(!v)return null;
  const c=v.coordinates;
  if(Array.isArray(c)&&Number.isFinite(+c[0])&&Number.isFinite(+c[1]))return pointGeometry(+c[0],+c[1]);
  const lat=+(v.latitude??v.lat??NaN),lon=+(v.longitude??v.lon??NaN);
  return pointGeometry(lon,lat);
}
async function arcgis(base,ctx,outFields='*'){
  const url=new URL(base.replace(/\/$/,'')+'/query'),b=bbox(ctx.lat,ctx.lon,ctx.radiusKm);
  Object.entries({f:'geojson',where:'1=1',geometry:b.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields,returnGeometry:'true',resultRecordCount:String(Math.min(ctx.limit||500,2000))}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  const data=await fetchJSON(url);if(data?.error)throw new Error(`ArcGIS ${data.error.code||''} ${data.error.message||'query error'}`.trim());return{url,features:data.features||[]};
}

async function currentNolaPermits(ctx){
  const url=new URL('https://data.nola.gov/resource/rcm3-fn58.json');
  const radiusM=Math.max(1,Math.round(ctx.radiusKm*1000)),start=dateDaysAgo(Math.max(ctx.sinceDays||30,365));
  url.searchParams.set('$where',`within_circle(location_1, ${ctx.lat}, ${ctx.lon}, ${radiusM}) AND filingdate >= '${start}T00:00:00.000'`);
  url.searchParams.set('$order','filingdate DESC');url.searchParams.set('$limit',String(Math.min(ctx.limit||500,50000)));
  const rows=await fetchJSON(url);
  return (Array.isArray(rows)?rows:[]).flatMap(r=>{
    const g=locationPoint(r.location_1);if(!g)return[];
    return[normalizeSignal({
      source:'nola-building-permits',source_record_id:r.numstring||null,predicate:'change.building_permit',
      value:{permit:r.numstring||null,permit_type:r.type||null,address:r.address||null,description:r.description||null,owner:r.owner||null,status:r.currentstatus||null,next_status:r.nextstatus||null,zoning:r.zoning||null,historic_district:r.historicdistrict||null,council_district:r.councildist||null,construction_value_usd:r.constrval==null?null:Number(r.constrval),filing_date:r.filingdate||null,issue_date:r.issuedate||null},
      geometry:g,epistemic:'DECLARED',observed_at:asISO(r.currentstatusdate||r.issuedate||r.filingdate||null),
      actors:['GROUND','HUMAN','BUILDING','SERVICE','ECONOMY'],
      provenance:{query_url:url.toString(),provider:'City of New Orleans · Data.NOLA',dataset_id:'rcm3-fn58',dataset_scope:'City permit data since 2012; current dataset is updated nightly.',spatial_method:'source location_1 point'},
      raw:{division:r.division||null,master_or_subpermit:r.m_s||null,is_closed:r.isclosed||null}
    })];
  });
}

async function currentNolaCodeScope(ctx){
  const url=new URL('https://data.nola.gov/resource/u6yx-v2tw.json');
  url.searchParams.set('$order','statdate DESC');url.searchParams.set('$limit',String(Math.min(ctx.limit||160,500)));
  const rows=await fetchJSON(url);
  return (Array.isArray(rows)?rows:[]).map(r=>normalizeSignal({
    source:'nola-code-enforcement',source_record_id:r.caseno||null,predicate:'service.code_enforcement_case',
    value:{case_number:r.caseno||null,location:r.location||null,stage:r.stage||null,status:r.keystatus||null,status_date:r.statdate||null,case_filed:r.casefiled||null,initial_inspection:r.initinspection||null,initial_inspection_result:r.initinspresult||null,previous_hearing_date:r.prevhearingdate||null,previous_hearing_result:r.prevhearingresult||null,next_hearing_date:r.nexthearingdate||null,last_permit:r.lastpermit||null,permit_filing:r.permitfiling||null,permit_type:r.permittype||null,scope:'City of New Orleans'},
    geometry:null,epistemic:'DECLARED',observed_at:asISO(r.statdate||r.casefiled||null),actors:['HUMAN','BUILDING','SERVICE'],
    provenance:{query_url:url.toString(),provider:'City of New Orleans · Data.NOLA',dataset_id:'u6yx-v2tw',spatial_scope:{kind:'municipality',name:'City of New Orleans'},note:'Current all-cases dataset has address/location text but no source point geometry in the published contract used here. Records remain city-scoped and unaddressed until the compiler has a separately evidenced address→parcel resolver.'},raw:{}
  }));
}

async function currentAtlantaHistoric(ctx){
  const base='https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/17';
  const fields=['OBJECTID','STATUS','ADDRESS','NAME','CLASS','DATE_','OF_STORI','PREV_USE','CONSTR_MAT','NPU','NR_POTENTI','DESCRIPTIO','SURVEY','GLOBALID'].join(',');
  const {url,features}=await arcgis(base,ctx,fields);
  return features.flatMap(f=>{
    const c=f?.geometry?.coordinates,g=Array.isArray(c)?pointGeometry(+c[0],+c[1]):null,p=f.properties||{};if(!g)return[];
    return[normalizeSignal({source:'atlanta-historic-buildings',source_record_id:p.GLOBALID||p.OBJECTID,predicate:'memory.atlanta_historic_building',value:{name:p.NAME||null,address:p.ADDRESS||null,status:p.STATUS||null,class:p.CLASS||null,date:p.DATE_||null,stories:p.OF_STORI??null,previous_use:p.PREV_USE||null,construction_material:p.CONSTR_MAT||null,npu:p.NPU||null,national_register_potential:p.NR_POTENTI||null,description:p.DESCRIPTIO||null,survey:p.SURVEY||null},geometry:g,epistemic:'DECLARED',actors:['GROUND','HUMAN','BUILDING','MEMORY','SERVICE'],provenance:{query_url:url.toString(),provider:'City of Atlanta Department of City Planning',layer:17,schema_note:'ArcGIS field name is DESCRIPTIO (10-character source field), not DESCRIPTION.'}})];
  });
}

export const WAVE25_OVERRIDES={
  'nola-building-permits':currentNolaPermits,
  'nola-code-enforcement':currentNolaCodeScope,
  'atlanta-historic-buildings':currentAtlantaHistoric
};

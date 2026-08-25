import { legacySignalToV1 } from './v1-bridge.mjs';
import { correspondence, possibility, stableId } from './v1-schema.mjs';
import { correspondenceRuleFor, actorPossibilitiesFor } from './system-rules.mjs';

const REGIME_ORDER=['MATERIAL','AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL'];

function uniq(xs=[]){return [...new Set(xs.filter(x=>x!==undefined&&x!==null&&x!==''))];}
function stableJSON(v){
  if(Array.isArray(v))return v.map(stableJSON);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stableJSON(v[k])]));
  return v;
}
function sameValue(a,b){return JSON.stringify(stableJSON(a))===JSON.stringify(stableJSON(b));}
function observationTime(o){
  const t=o?.time||{};
  for(const k of ['valid_from','observed_at','occurred_at','published_at','recorded_at','recognized_at','acted_on_at']){
    const ms=Date.parse(t[k]||'');if(Number.isFinite(ms))return ms;
  }
  return 0;
}
function isoTime(o){const ms=observationTime(o);return ms?new Date(ms).toISOString():null;}
function firstGeometry(forms=[]){return forms.find(f=>f.geometry)?.geometry||null;}

export function subjectIdForSignal(signal){
  if(!signal)throw new Error('signal required');
  const v=signal.value&&typeof signal.value==='object'?signal.value:{};
  if(signal.gers_id||v.gers_id)return `gers:${signal.gers_id||v.gers_id}`;
  if(signal.subject_id)return String(signal.subject_id);
  if(v.osm_type&&v.osm_id)return `osm:${v.osm_type}:${v.osm_id}`;
  if(v.lei)return `lei:${v.lei}`;
  if(v.frs_id)return `epa-frs:${v.frs_id}`;
  if(v.facility_id)return `${signal.source}:facility:${v.facility_id}`;
  if(v.branch_id)return `${signal.source}:branch:${v.branch_id}`;
  if(signal.source_record_id!==undefined&&signal.source_record_id!==null)return `${signal.source}:record:${signal.source_record_id}`;
  return `${signal.source||'unknown'}:signal:${signal.id}`;
}

export function bridgeToLedger(signals=[]){
  const forms=[],observations=[],legacyByObservation=new Map(),errors=[];
  for(const signal of signals){
    try{
      const subject_id=subjectIdForSignal(signal);
      const {form,observation}=legacySignalToV1(signal,{subject_id,regime:signal.geonosis_regime||null,form:signal.geonosis_form||null});
      forms.push(form);observations.push(observation);legacyByObservation.set(observation.id,signal);
    }catch(error){errors.push({signal_id:signal?.id||null,error:String(error?.message||error)});}
  }
  return {forms,observations,legacyByObservation,errors};
}

export function mergeById(existing=[],incoming=[]){
  const seen=new Map();
  for(const x of [...existing,...incoming])if(x&&x.id&&!seen.has(x.id))seen.set(x.id,x);
  return [...seen.values()];
}

export function buildSubjects(forms=[],observations=[]){
  const obsByForm=new Map();
  for(const o of observations){if(!obsByForm.has(o.form_id))obsByForm.set(o.form_id,[]);obsByForm.get(o.form_id).push(o);}
  const bySubject=new Map();
  for(const f of forms){
    const s=bySubject.get(f.subject_id)||{id:f.subject_id,form_ids:[],atlas_addresses:[],sources:[],regimes:[],predicates:[],first_observed_at:null,last_observed_at:null,geometry:null,identity_basis:[]};
    s.form_ids.push(f.id);if(f.atlas_address)s.atlas_addresses.push(f.atlas_address);if(!s.geometry&&f.geometry)s.geometry=f.geometry;if(f.bridge_basis)s.identity_basis.push(f.bridge_basis);
    for(const o of obsByForm.get(f.id)||[]){s.sources.push(o.source);s.regimes.push(o.regime);s.predicates.push(o.predicate);const at=isoTime(o);if(at&&(!s.first_observed_at||at<s.first_observed_at))s.first_observed_at=at;if(at&&(!s.last_observed_at||at>s.last_observed_at))s.last_observed_at=at;}
    bySubject.set(f.subject_id,s);
  }
  return [...bySubject.values()].map(s=>({...s,form_ids:uniq(s.form_ids),atlas_addresses:uniq(s.atlas_addresses),sources:uniq(s.sources),regimes:uniq(s.regimes),predicates:uniq(s.predicates),identity_basis:uniq(s.identity_basis)}));
}

export function reconstructCurrent(forms=[],observations=[],at=null){
  const cutoff=at?Date.parse(at):Infinity,formById=new Map(forms.map(f=>[f.id,f])),latest=new Map();
  for(const o of observations){
    const f=formById.get(o.form_id);if(!f)continue;const ms=observationTime(o);if(Number.isFinite(cutoff)&&ms>cutoff)continue;
    const key=`${f.subject_id}|${o.regime}|${o.predicate}`;const prev=latest.get(key);
    if(!prev||observationTime(prev.observation)<=ms)latest.set(key,{subject_id:f.subject_id,form_id:f.id,atlas_address:f.atlas_address||null,geometry:f.geometry||null,regime:o.regime,predicate:o.predicate,value:o.value,unit:o.unit||null,epistemic:o.epistemic,source:o.source,observed_at:isoTime(o),observation_id:o.id,apparatus:o.apparatus});
  }
  return [...latest.values()].sort((a,b)=>String(a.subject_id).localeCompare(String(b.subject_id))||REGIME_ORDER.indexOf(a.regime)-REGIME_ORDER.indexOf(b.regime)||a.predicate.localeCompare(b.predicate));
}

function valueForRule(observation,rule){
  let v=observation.value;
  if(!rule.value_path)return v;
  for(const part of rule.value_path.split('.')){if(v==null)return null;v=v[part];}
  return v;
}

export function deriveCorrespondenceHistory(forms=[],observations=[]){
  const formById=new Map(forms.map(f=>[f.id,f])),groups=new Map();
  for(const o of observations){const f=formById.get(o.form_id);if(!f)continue;const rule=correspondenceRuleFor(o.predicate);if(!rule)continue;const key=`${f.subject_id}|${o.predicate}|${rule.id}`;if(!groups.has(key))groups.set(key,{subject_id:f.subject_id,predicate:o.predicate,rule,rows:[],atlas_address:f.atlas_address||null,geometry:f.geometry||null});groups.get(key).rows.push(o);}
  const events=[],current=[];
  for(const g of groups.values()){
    const rows=g.rows.sort((a,b)=>observationTime(a)-observationTime(b)||a.id.localeCompare(b.id));
    const state=new Map(),open=new Map();
    for(const o of rows){
      state.set(o.regime,o);
      for(let i=0;i<g.rule.regimes.length;i++)for(let j=i+1;j<g.rule.regimes.length;j++){
        const a=g.rule.regimes[i],b=g.rule.regimes[j],oa=state.get(a),ob=state.get(b);if(!oa||!ob)continue;
        const pair=`${a}|${b}`,va=valueForRule(oa,g.rule),vb=valueForRule(ob,g.rule);if(va===null||va===undefined||vb===null||vb===undefined)continue;
        const equal=sameValue(va,vb),now=isoTime(o);
        if(!equal){
          if(!open.has(pair))open.set(pair,{id:stableId('event',{subject_id:g.subject_id,rule_id:g.rule.id,regime_a:a,regime_b:b,started_at:now}),kind:'GEONOTIC_EVENT',subject_id:g.subject_id,predicate:g.predicate,rule_id:g.rule.id,regime_a:a,regime_b:b,state:'MISMATCH',started_at:now,resolved_at:null,duration_minutes:null,active:true,atlas_address:g.atlas_address,geometry:g.geometry,evidence:[oa.id,ob.id],values:{[a]:va,[b]:vb},expectation:g.rule.expectation});
          else open.get(pair).evidence=uniq([...open.get(pair).evidence,oa.id,ob.id]);
        }else if(open.has(pair)){
          const e=open.get(pair),start=Date.parse(e.started_at||''),end=Date.parse(now||'');e.resolved_at=now;e.duration_minutes=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,(end-start)/60000):null;e.active=false;e.resolution_evidence=uniq([oa.id,ob.id]);events.push(e);open.delete(pair);
        }
      }
    }
    for(const [pair,e] of open){events.push(e);}
    for(let i=0;i<g.rule.regimes.length;i++)for(let j=i+1;j<g.rule.regimes.length;j++){
      const a=g.rule.regimes[i],b=g.rule.regimes[j],oa=state.get(a),ob=state.get(b);if(!oa||!ob)continue;const va=valueForRule(oa,g.rule),vb=valueForRule(ob,g.rule);if(va===null||va===undefined||vb===null||vb===undefined)continue;const equal=sameValue(va,vb);
      current.push(correspondence({regime_a:a,regime_b:b,subject_or_extent:g.subject_id,expectation:g.rule.expectation,state:equal?'MATCH':'MISMATCH',evidence:[oa.id,ob.id],explanation:equal?`${a} and ${b} currently satisfy ${g.rule.id}.`:`${a} and ${b} currently disagree under ${g.rule.id}.`,temporal_scope:{a_at:isoTime(oa),b_at:isoTime(ob)},geographic_scope:g.atlas_address||null,rule_id:g.rule.id}));
    }
  }
  return {events:events.sort((a,b)=>String(b.started_at||'').localeCompare(String(a.started_at||''))),current};
}

export function derivePossibilities(forms=[],observations=[],legacyByObservation=new Map()){
  const formById=new Map(forms.map(f=>[f.id,f])),out=[];
  for(const o of observations){
    const f=formById.get(o.form_id);if(!f)continue;const legacy=legacyByObservation.get(o.id)||null;
    for(const p of actorPossibilitiesFor(o,legacy)){
      out.push(possibility({actor_id:p.actor_id,condition:p.condition,modality:p.modality,reachable:p.reachable??null,permitted:p.permitted??null,expected:p.expected??null,risk:p.risk??null,horizon:p.horizon||null,geographic_scope:f.atlas_address||f.subject_id,derived_from:[o.id]}));
    }
  }
  return mergeById([],out);
}

export function compileBackplane(signals=[],existing={}){
  const bridged=bridgeToLedger(signals),forms=mergeById(existing.forms||[],bridged.forms),observations=mergeById(existing.observations||[],bridged.observations);
  const subjects=buildSubjects(forms,observations),current=reconstructCurrent(forms,observations),corr=deriveCorrespondenceHistory(forms,observations),possibilities=derivePossibilities(forms,observations,bridged.legacyByObservation);
  return {schema:'geonosis-system-v1',forms,observations,subjects,current,correspondences:corr.current,events:corr.events,possibilities,bridge_errors:bridged.errors};
}

export function mapFeatures(system,{limit=1500}={}){
  const currentByForm=new Map();for(const s of system.current){if(!currentByForm.has(s.form_id))currentByForm.set(s.form_id,s);}
  const eventSubjects=new Set(system.events.filter(e=>e.active).map(e=>e.subject_id));
  const ranked=system.forms.filter(f=>f.geometry).map(f=>({f,s:currentByForm.get(f.id)||null,rank:eventSubjects.has(f.subject_id)?0:1})).sort((a,b)=>a.rank-b.rank||String(b.s?.observed_at||'').localeCompare(String(a.s?.observed_at||''))).slice(0,limit);
  return {type:'FeatureCollection',features:ranked.map(({f,s})=>({type:'Feature',geometry:f.geometry,properties:{subject_id:f.subject_id,form_id:f.id,atlas_address:f.atlas_address||null,form:f.form,regime:s?.regime||null,predicate:s?.predicate||null,value:s?.value??null,unit:s?.unit||null,source:s?.source||null,epistemic:s?.epistemic||null,observed_at:s?.observed_at||null,observation_id:s?.observation_id||null,active_event:eventSubjects.has(f.subject_id)}}))};
}

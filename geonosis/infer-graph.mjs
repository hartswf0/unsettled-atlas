import { statementId } from './schema.mjs';

function make(kind,{address=null,scope=null,text,evidence,importance={}}){return{id:statementId({kind,address,scope,evidence:[...evidence].sort()}),kind,atlas_address:address,scope_id:scope,text,epistemic:'INFERRED',evidence:[...new Set(evidence)],derived_from:[...new Set(evidence)],importance:{change:null,exposure:importance.exposure??null,anomaly:null,contestation:null,consequence:importance.consequence??null,evidence_diversity:importance.evidence_diversity??null,uncertainty:importance.uncertainty??null,novelty:importance.novelty??null}};}

export function inferGraphStatements(graph){
 const out=[],entityById=new Map(graph.entities.map(e=>[e.id,e]));
 const deposits=new Map();
 for(const r of graph.relations.filter(r=>r.predicate==='holds_reported_deposits')){const e=entityById.get(r.subject),a=e?.atlas_address,amount=Number(r.value?.amount_usd);if(!a||!Number.isFinite(amount))continue;if(!deposits.has(a))deposits.set(a,{amount:0,rels:[],branches:new Set()});const x=deposits.get(a);x.amount+=amount;x.rels.push(r);x.branches.add(r.subject);}
 for(const[a,x]of deposits)out.push(make('reported_deposit_stock',{address:a,text:`FDIC Summary of Deposits reports $${Math.round(x.amount).toLocaleString('en-US')} held across ${x.branches.size} branch${x.branches.size===1?'':'es'} addressed to this ground. This is reported deposit stock, not evidence that the money is invested locally.`,evidence:x.rels.flatMap(r=>r.derived_from),importance:{consequence:Math.min(1,.25+x.branches.size*.05),uncertainty:.25}}));

 const counties=graph.entities.filter(e=>e.type==='administrative_scope'&&e.scope==='county');
 const ownershipPreds=new Set(['directly_consolidated_by','ultimately_consolidated_by']);
 for(const county of counties){
  const lenders=graph.relations.filter(r=>r.predicate==='reports_hmda_activity_in'&&r.object===county.id),federal=graph.relations.filter(r=>r.predicate==='reports_obligations_with_place_of_performance'&&r.object===county.id);
  if(lenders.length||federal.length){const federalUsd=federal.reduce((n,r)=>n+(Number(r.value?.amount_usd)||0),0);out.push(make('county_financial_channels',{scope:county.id,text:`${county.name||county.id} has ${lenders.length} HMDA-reporting lender${lenders.length===1?'':'s'} in the selected year${federal.length?` and USAspending reports $${Math.round(federalUsd).toLocaleString('en-US')} in obligations with this county as place of performance over the harvest window`:''}. These are distinct financial channels and are not combined into one measure of local investment.`,evidence:[...lenders,...federal].flatMap(r=>r.derived_from),importance:{evidence_diversity:lenders.length&&federal.length?.5:.25,uncertainty:.35}}));}
  const lenderIds=new Set(lenders.map(r=>r.subject)),parentRels=graph.relations.filter(r=>lenderIds.has(r.subject)&&ownershipPreds.has(r.predicate));if(parentRels.length){const covered=new Set(parentRels.map(r=>r.subject));out.push(make('lender_consolidation_parentage',{scope:county.id,text:`Among the HMDA-reporting lenders enriched through GLEIF in ${county.name||county.id}, ${covered.size} have a direct or ultimate accounting-consolidation parent relation returned by GLEIF. This is not beneficial-ownership evidence and the enrichment sample may be incomplete.`,evidence:[...lenders.filter(r=>covered.has(r.subject)),...parentRels].flatMap(r=>r.derived_from),importance:{evidence_diversity:.5,uncertainty:.45}}));}
 }
 return out;
}

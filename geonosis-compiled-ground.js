/* GEONOSIS COMPILED GROUND · wave 2.5
 * Static, prefix-addressed evidence produced by geonosis/compile-ground.mjs.
 * Loaded inside the canonical ICOSA closure by icosa-syntegrity-live.html.
 */

var GEONOSIS_COMPILED_VERSION='geonosis-compiled-ground-v0.1';
var GEO25={manifest:null,manifestState:'idle',manifestError:null,prefixSet:null,leafSet:null,cache:Object.create(null),loading:Object.create(null),focus:Object.create(null)};

function geo25Url(path){return new URL(path,document.baseURI).toString();}
function geo25JSON(path,cb){
  fetch(geo25Url(path),{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(path+' '+r.status);return r.json();})
    .then(function(j){cb(null,j);}).catch(function(e){cb(String(e&&e.message||e));});
}
function geo25Depth(slug){var p=String(slug||'').split('.')[1]||'';return p.length;}
function geo25IsAncestor(a,b){return a===b||String(b).indexOf(String(a)+'.')===0||(a.indexOf('.')>=0&&String(b).indexOf(a)===0);}
function geo25EnsureManifest(cb){
  if(GEO25.manifest){cb&&cb(null,GEO25.manifest);return;}
  if(GEO25.manifestState==='loading'){setTimeout(function(){geo25EnsureManifest(cb);},80);return;}
  GEO25.manifestState='loading';GEO25.manifestError=null;
  geo25JSON('geonosis/data/manifest.json',function(err,j){
    if(err){GEO25.manifestState='error';GEO25.manifestError=err;cb&&cb(err);wake();return;}
    GEO25.manifest=j;GEO25.manifestState='ready';
    GEO25.prefixSet=new Set(j.prefixes||[]);GEO25.leafSet=new Set(j.leaves||[]);
    cb&&cb(null,j);wake();
  });
}
function geo25Resolution(slug){
  var m=GEO25.manifest;if(!m||!GEO25.prefixSet)return null;
  if(GEO25.prefixSet.has(slug)){
    return {bundle:slug,mode:GEO25.leafSet.has(slug)?'AT_COMPILED_DEPTH':'CONTAINS_COMPILED_DESCENDANTS',matches_focus:true};
  }
  var best=null;
  (m.leaves||[]).forEach(function(leaf){if(geo25IsAncestor(leaf,slug)&&(!best||leaf.length>best.length))best=leaf;});
  if(best)return {bundle:best,mode:'COMPILED_PARENT_SCOPE',matches_focus:false};
  return {bundle:null,mode:'OUTSIDE_COMPILED_COVERAGE',matches_focus:false};
}
function geo25Request(cell,cb){
  if(!cell){cb&&cb('no cell');return;}
  var slug=cellSlug(cell);
  geo25EnsureManifest(function(err){
    if(err){GEO25.focus[slug]={state:'error',error:err,focus:slug};cb&&cb(err);return;}
    var r=geo25Resolution(slug);
    if(!r||!r.bundle){GEO25.focus[slug]={state:'outside',focus:slug,resolution:r};cb&&cb(null,null);wake();return;}
    if(GEO25.cache[r.bundle]){GEO25.focus[slug]={state:'ready',focus:slug,resolution:r,bundle:GEO25.cache[r.bundle]};cb&&cb(null,GEO25.focus[slug]);return;}
    if(GEO25.loading[r.bundle]){setTimeout(function(){geo25Request(cell,cb);},80);return;}
    GEO25.loading[r.bundle]=1;GEO25.focus[slug]={state:'loading',focus:slug,resolution:r};
    geo25JSON('geonosis/data/cells/'+r.bundle+'.json',function(e,j){
      delete GEO25.loading[r.bundle];
      if(e){GEO25.focus[slug]={state:'error',focus:slug,resolution:r,error:e};cb&&cb(e);wake();return;}
      GEO25.cache[r.bundle]=j;GEO25.focus[slug]={state:'ready',focus:slug,resolution:r,bundle:j};cb&&cb(null,GEO25.focus[slug]);wake();
    });
  });
}
function geo25ForCell(cell){return cell?GEO25.focus[cellSlug(cell)]||null:null;}
function geo25SeedFor(cell){return cell&&DB.geonosisSeeds?DB.geonosisSeeds[cellSlug(cell)]||null:null;}
function geo25CompactSignal(s){return {id:s.id,source:s.source,predicate:s.predicate,epistemic:s.epistemic,value:s.value,atlas_address:s.atlas_address,observed_at:s.observed_at||null,valid_from:s.valid_from||null,retrieved_at:s.retrieved_at||null,publication_region:s.publication_region||null};}
function geo25CompactEntity(e){return {id:e.id,type:e.type,name:e.name||null,identifiers:e.identifiers||{},atlas_address:e.atlas_address||null,scope:e.scope||null,publication_region:e.publication_region||null};}
function geo25CompactRelation(r){return {id:r.id,subject:r.subject,predicate:r.predicate,object:r.object,value:r.value||null,epistemic:r.epistemic,derived_from:r.derived_from||[],publication_region:r.publication_region||null};}
function geo25CompactStatement(s){return {id:s.id,kind:s.kind,text:s.text,epistemic:s.epistemic,atlas_address:s.atlas_address||null,scope_id:s.scope_id||null,evidence:s.evidence||[],importance:s.importance||{},publication_rank:s.publication_rank||null,publication_region:s.publication_region||null};}
function geo25Context(cell){
  var slug=cellSlug(cell),st=geo25ForCell(cell),seed=geo25SeedFor(cell);
  if(!st)return {version:GEONOSIS_COMPILED_VERSION,state:'not_requested',focus_address:slug,selected_statement:seed||null};
  if(st.state!=='ready')return {version:GEONOSIS_COMPILED_VERSION,state:st.state,focus_address:slug,coverage:st.resolution||null,error:st.error||null,selected_statement:seed||null};
  var b=st.bundle;
  return {version:GEONOSIS_COMPILED_VERSION,state:'ready',focus_address:slug,bundle_address:b.atlas_address,coverage:st.resolution,generated_at:b.generated_at,regions:b.regions||[],sources:b.sources||[],counts:b.counts||{},signal_predicates:b.signal_predicates||{},entity_types:b.entity_types||{},relation_predicates:b.relation_predicates||{},statement_kinds:b.statement_kinds||{},signals:(b.signals||[]).slice(0,12).map(geo25CompactSignal),entities:(b.entities||[]).slice(0,12).map(geo25CompactEntity),relations:(b.relations||[]).slice(0,12).map(geo25CompactRelation),statements_of_importance:(b.statements||[]).slice(0,8).map(geo25CompactStatement),selected_statement:seed||null,semantics:{compiled:'dated public records compiled outside the interaction loop',contained:'when coverage.matches_focus is true the bundle address is the focus or a descendant aggregate contained by it',parent_scope:'COMPILED_PARENT_SCOPE is broader than the current focus and must never be treated as exact evidence for the deeper cell',sample:'arrays are bounded samples; counts describe the compiled prefix bundle',administrative_scope:'county and other unaddressed records are excluded from triangle bundles until real boundary geometry is compiled'}};
}

if(!DB.geonosisSeeds)DB.geonosisSeeds={};
var geo25LiveCtxBuildBase=liveCtxBuild;
liveCtxBuild=function(cell){var x=geo25LiveCtxBuildBase(cell);x.compiled_ground=geo25Context(cell);return x;};
var geo25LiveCtxWarmBase=liveCtxWarm;
liveCtxWarm=function(cell){geo25LiveCtxWarmBase(cell);geo25Request(cell);};
var geo25LiveCtxPendingBase=liveCtxPending;
liveCtxPending=function(cell){var out=geo25LiveCtxPendingBase(cell),st=geo25ForCell(cell);if((!st||st.state==='loading')&&out.indexOf('compiled-ground')<0)out.push('compiled-ground');return out;};

var GEONOSIS_COMPILED_LAW=' When context.live.compiled_ground is present, treat it as dated compiled evidence, not live observation. Preserve bundle_address, coverage.mode, source epistemic classes and every evidence ID. COMPILED_PARENT_SCOPE is broader than the focused cell and cannot establish a fact about the deeper focus. When context.live.compiled_ground.selected_statement exists, it is the primary agenda seed selected by the human: the charter opening question and first substantive agenda item must address that proposition, retain its evidence IDs and spatial scope, and may only add adjacent factual premises already present in context. The council may reject or qualify the proposition; it may not silently replace its evidentiary basis.';
if(typeof LAW==='string'&&LAW.indexOf('context.live.compiled_ground is present')<0)LAW+=GEONOSIS_COMPILED_LAW;

window.ICOSA_LIVE.compiledGround={version:GEONOSIS_COMPILED_VERSION,state:GEO25,request:function(slug,cb){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?geo25Request(c,cb):null;},context:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?geo25Context(c):null;}};

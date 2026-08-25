/* GEONOSIS GROUND PANEL · wave 2.5
 * Makes compiled evidence legible inside the existing sibling panel.
 * Four persistent labels: HERE / HAPPENING / CONNECTIONS / STRANGE.
 */

var GEONOSIS_PANEL_VERSION='geonosis-ground-panel-v0.1';
if(!GEO25.selected)GEO25.selected=Object.create(null);

(function geo25Style(){
  if(document.getElementById('geo25-style'))return;
  var s=document.createElement('style');s.id='geo25-style';s.textContent=[
    '#geonosis-ground{border:1.5px solid var(--ink);background:var(--paper);margin:10px 0 12px;padding:9px}',
    '#geonosis-ground .g25head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;border-bottom:1.5px solid var(--ink);padding-bottom:7px;margin-bottom:8px}',
    '#geonosis-ground .g25head b{font-size:10px;letter-spacing:.16em}',
    '#geonosis-ground .g25head span{font-size:8px;line-height:1.35;color:var(--muted);text-align:right}',
    '#geonosis-ground .g25counts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:7px 0 9px}',
    '#geonosis-ground .g25count{border:1px solid rgba(18,21,20,.3);padding:5px 4px;text-align:center}',
    '#geonosis-ground .g25count b{display:block;font-size:12px}',
    '#geonosis-ground .g25count span{font-size:6.5px;letter-spacing:.1em;color:var(--muted)}',
    '#geonosis-ground .g25grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '#geonosis-ground .g25box{border-top:2px solid var(--ink);padding-top:5px;min-width:0}',
    '#geonosis-ground .g25box h3{font-size:9px;letter-spacing:.18em;margin:0 0 5px}',
    '#geonosis-ground .g25item{border-top:1px solid rgba(18,21,20,.16);padding:5px 0;font-size:8px;line-height:1.4;overflow-wrap:anywhere}',
    '#geonosis-ground .g25item b{display:block;font-size:8.5px}',
    '#geonosis-ground .g25item span{color:var(--muted)}',
    '#geonosis-ground .g25strange{border:1px solid rgba(18,21,20,.28);padding:6px;margin:5px 0;cursor:pointer;background:var(--ground)}',
    '#geonosis-ground .g25strange.on{border:2px solid var(--signal);padding:5px}',
    '#geonosis-ground .g25strange b{display:block;font-size:9px;line-height:1.45}',
    '#geonosis-ground .g25vector{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}',
    '#geonosis-ground .g25vector i{font-style:normal;font-size:6.5px;letter-spacing:.06em;border:1px solid rgba(18,21,20,.24);padding:2px 3px;color:var(--muted)}',
    '#geonosis-ground .g25scope{font-size:7px;color:var(--signal);letter-spacing:.08em;margin-top:5px}',
    '#geonosis-ground .g25actions{display:flex;flex-wrap:wrap;gap:5px;border-top:1.5px solid var(--ink);padding-top:8px;margin-top:8px}',
    '#geonosis-ground .g25actions button{font:inherit;font-size:9px;font-weight:700;letter-spacing:.12em;border:1.5px solid var(--ink);background:var(--ground);color:var(--ink);padding:7px 9px;cursor:pointer}',
    '#geonosis-ground .g25actions button.primary{background:var(--signal);border-color:var(--signal);color:var(--paper)}',
    '#geonosis-seed{border:2px solid var(--signal);padding:8px;margin:8px 0;background:rgba(168,70,42,.06)}',
    '#geonosis-seed b{display:block;font-size:9px;letter-spacing:.12em;color:var(--signal)}',
    '#geonosis-seed p{margin:5px 0 0!important;color:var(--ink)!important;font-size:10px!important}',
    '@media(max-width:520px){#geonosis-ground .g25grid{grid-template-columns:1fr}#geonosis-ground .g25counts{grid-template-columns:repeat(2,1fr)}}'
  ].join('\n');document.head.appendChild(s);
})();

function geo25Esc(x){return typeof liveEsc==='function'?liveEsc(String(x==null?'':x)):esc(String(x==null?'':x));}
function geo25Short(x,n){x=String(x==null?'':x);return x.length>(n||54)?x.slice(0,(n||54)-1)+'…':x;}
function geo25Name(id,map){var e=map&&map[id];return e&&(e.name||e.id)||geo25Short(id,34);}
function geo25Vector(i){
  var out=[];i=i||{};
  [['change','CHANGE'],['exposure','EXPOSURE'],['anomaly','ANOMALY'],['contestation','CONTEST'],['consequence','CONSEQUENCE'],['evidence_diversity','EVIDENCE'],['uncertainty','UNCERTAINTY'],['novelty','NOVELTY']].forEach(function(k){
    var v=Number(i[k[0]]);if(Number.isFinite(v))out.push('<i>'+k[1]+' '+Math.round(v*100)+'</i>');
  });
  return out.join('');
}
function geo25SignalLabel(s){
  var v=s.value||{},name=v.name||v.scientific_name||v.common_name||v.address||v.docket||v.permit||null;
  return (name?geo25Short(name,42)+' · ':'')+String(s.predicate||'signal').replace(/[._]/g,' ');
}
function geo25CurrentStatement(cell,b){
  var ss=(b&&b.statements)||[],id=GEO25.selected[cellSlug(cell)];
  var got=ss.find(function(s){return s.id===id;});if(got)return got;
  if(ss.length){GEO25.selected[cellSlug(cell)]=ss[0].id;return ss[0];}
  return null;
}
function geo25SetSelected(cell,id){GEO25.selected[cellSlug(cell)]=id;geo25RenderPanel(cell);}

function geo25SeedCouncil(cell,statement){
  if(!cell||!statement)return;
  var slug=cellSlug(cell),st=geo25ForCell(cell);
  if(st&&st.resolution&&st.resolution.mode==='COMPILED_PARENT_SCOPE'){
    var parent=cellFromSlug(st.resolution.bundle);if(parent){selection=parent;lookAt(cellCentre(parent),parent.depth);openWhere(parent);wake();}return;
  }
  if(!DB.geonosisSeeds)DB.geonosisSeeds={};
  DB.geonosisSeeds[slug]={id:statement.id,kind:statement.kind,text:statement.text,atlas_address:statement.atlas_address||null,scope_id:statement.scope_id||null,evidence:(statement.evidence||[]).slice(),importance:statement.importance||{},publication_region:statement.publication_region||null,selected_at:new Date().toISOString()};
  if(DB.charter&&DB.charter[slug]){
    if(!DB.charterHistory)DB.charterHistory={};
    (DB.charterHistory[slug]=DB.charterHistory[slug]||[]).push(DB.charter[slug]);
    DB.charterHistory[slug]=DB.charterHistory[slug].slice(-8);delete DB.charter[slug];
  }
  commit();
  councilCell=cell;councilSeat=councilFor(cellEdgeKm(cell));setLegend(councilSeat);openCouncil(cell);
  var run=document.getElementById('cRun');if(run&&OPENAI_KEY)run.click();
}
function geo25ClearSeed(cell){if(DB.geonosisSeeds){delete DB.geonosisSeeds[cellSlug(cell)];commit();}geo25RenderCouncilSeed(cell);}

function geo25RenderPanel(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;
  var old=document.getElementById('geonosis-ground');if(old)old.remove();
  var st=geo25ForCell(cell),slug=cellSlug(cell),h='';
  if(!st){geo25Request(cell,function(){if(PANEL==='where')geo25RenderPanel(cell);});st={state:'loading'};}
  if(st.state==='loading'||GEO25.manifestState==='loading'){
    h='<section id="geonosis-ground"><div class="g25head"><b>GEONOSIS · COMPILED GROUND</b><span>'+geo25Esc(slug)+'<br>LOADING</span></div><p>Loading the dated evidence bundle for this Icosa address.</p></section>';
    root.insertAdjacentHTML('beforeend',h);return;
  }
  if(st.state==='error'||GEO25.manifestState==='error'){
    h='<section id="geonosis-ground"><div class="g25head"><b>GEONOSIS · COMPILED GROUND</b><span>'+geo25Esc(slug)+'<br>UNAVAILABLE</span></div><p>'+geo25Esc(st.error||GEO25.manifestError||'compiled ground unavailable')+'</p></section>';
    root.insertAdjacentHTML('beforeend',h);return;
  }
  if(st.state==='outside'){
    h='<section id="geonosis-ground"><div class="g25head"><b>GEONOSIS · COMPILED GROUND</b><span>'+geo25Esc(slug)+'<br>OUTSIDE COMPILED COVERAGE</span></div><p>The current compiler publishes Atlanta and New Orleans reference windows. Live sources above remain independent of this absence.</p></section>';
    root.insertAdjacentHTML('beforeend',h);return;
  }
  if(st.state!=='ready'||!st.bundle)return;
  var b=st.bundle,c=b.counts||{},entityMap={};(b.entities||[]).forEach(function(e){entityMap[e.id]=e;});
  var mode=st.resolution.mode.replace(/_/g,' '),selected=geo25CurrentStatement(cell,b);
  h+='<section id="geonosis-ground"><div class="g25head"><b>GEONOSIS · COMPILED GROUND</b><span>FOCUS '+geo25Esc(slug)+'<br>'+geo25Esc(mode)+' · '+geo25Esc((b.regions||[]).join(' + '))+'</span></div>';
  h+='<div class="g25counts"><div class="g25count"><b>'+Number(c.signals||0)+'</b><span>SIGNALS</span></div><div class="g25count"><b>'+Number(c.entities||0)+'</b><span>ENTITIES</span></div><div class="g25count"><b>'+Number(c.relations||0)+'</b><span>RELATIONS</span></div><div class="g25count"><b>'+Number(c.statements||0)+'</b><span>STRANGE</span></div></div>';
  h+='<div class="g25grid">';
  h+='<div class="g25box"><h3>HERE · WHAT EXISTS IN THE COMPILED RECORD</h3>'+(b.entities||[]).slice(0,6).map(function(e){return '<div class="g25item"><b>'+geo25Esc(e.name||e.type||e.id)+'</b><span>'+geo25Esc(String(e.type||'entity').replace(/_/g,' '))+' · '+geo25Esc(e.publication_region||'')+'</span></div>';}).join('')+(!(b.entities||[]).length?'<div class="g25item"><span>No sampled entities in this prefix bundle.</span></div>':'')+'</div>';
  h+='<div class="g25box"><h3>HAPPENING · REPORTED CHANGE, ACTIVITY, CONDITION</h3>'+(b.signals||[]).slice(0,6).map(function(s){return '<div class="g25item"><b>'+geo25Esc(geo25SignalLabel(s))+'</b><span>'+geo25Esc((s.source||'source').toUpperCase())+' · '+geo25Esc(s.epistemic||'')+' · '+geo25Esc(s.atlas_address||'')+'</span></div>';}).join('')+(!(b.signals||[]).length?'<div class="g25item"><span>No sampled signals in this prefix bundle.</span></div>':'')+'</div>';
  h+='<div class="g25box"><h3>CONNECTIONS · TYPED EDGES</h3>'+(b.relations||[]).slice(0,6).map(function(r){return '<div class="g25item"><b>'+geo25Esc(geo25Name(r.subject,entityMap))+'</b><span>'+geo25Esc(String(r.predicate||'relation').replace(/_/g,' '))+' → '+geo25Esc(geo25Name(r.object,entityMap))+'</span></div>';}).join('')+(!(b.relations||[]).length?'<div class="g25item"><span>No sampled typed relations in this prefix bundle.</span></div>':'')+'</div>';
  h+='<div class="g25box"><h3>STRANGE · RULE-DERIVED STATEMENTS</h3>'+(b.statements||[]).slice(0,6).map(function(s){var on=selected&&selected.id===s.id;return '<div class="g25strange'+(on?' on':'')+'" data-g25-statement="'+geo25Esc(s.id)+'"><b>'+geo25Esc(s.text)+'</b><div class="g25vector">'+geo25Vector(s.importance)+'</div><div class="g25scope">INFERRED · '+Number((s.evidence||[]).length)+' EVIDENCE · '+geo25Esc(s.atlas_address||s.scope_id||'SCOPED')+'</div><details><summary>EVIDENCE IDS</summary><div class="g25item"><span>'+geo25Esc((s.evidence||[]).slice(0,20).join(' · '))+'</span></div></details></div>';}).join('')+(!(b.statements||[]).length?'<div class="g25item"><span>No compiled Statement of Importance at this prefix yet.</span></div>':'')+'</div>';
  h+='</div>';
  h+='<div class="g25scope">UPDATED '+geo25Esc(b.generated_at||'UNKNOWN')+' · SAMPLES ARE BOUNDED · COUNTS ARE PREFIX AGGREGATES</div>';
  h+='<div class="g25actions">'+(selected?'<button class="primary" id="g25Council">'+(st.resolution.mode==='COMPILED_PARENT_SCOPE'?'GO TO COMPILED PARENT':'CALL A COUNCIL')+'</button>':'')+'<button id="g25Refresh">REFRESH COMPILED GROUND</button></div></section>';
  root.insertAdjacentHTML('beforeend',h);
  root.querySelectorAll('[data-g25-statement]').forEach(function(el){el.onclick=function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('details'))return;geo25SetSelected(cell,el.getAttribute('data-g25-statement'));};});
  var council=document.getElementById('g25Council');if(council)council.onclick=function(){geo25SeedCouncil(cell,geo25CurrentStatement(cell,b));};
  var refresh=document.getElementById('g25Refresh');if(refresh)refresh.onclick=function(){var r=st.resolution;if(r&&r.bundle)delete GEO25.cache[r.bundle];delete GEO25.focus[slug];geo25Request(cell,function(){geo25RenderPanel(cell);});};
}

function geo25RenderCouncilSeed(cell){
  var root=document.getElementById('panel');if(!root||!cell)return;
  var old=document.getElementById('geonosis-seed');if(old)old.remove();
  var seed=geo25SeedFor(cell);if(!seed)return;
  var h='<section id="geonosis-seed"><b>GEONOSIS AGENDA SEED · HUMAN SELECTED</b><p>'+geo25Esc(seed.text)+'</p><div class="g25scope">'+geo25Esc(seed.kind||'statement')+' · '+Number((seed.evidence||[]).length)+' EVIDENCE IDS · '+geo25Esc(seed.atlas_address||seed.scope_id||cellSlug(cell))+'</div><button class="go ghost" id="g25ClearSeed" style="margin-top:7px">CLEAR AGENDA SEED</button></section>';
  var head=root.querySelector('h2');if(head)head.insertAdjacentHTML('afterend',h);else root.insertAdjacentHTML('afterbegin',h);
  var clear=document.getElementById('g25ClearSeed');if(clear)clear.onclick=function(){geo25ClearSeed(cell);openCouncil(cell,true);};
}

var geo25RenderLiveWhereBase=renderLiveWhere;
renderLiveWhere=function(cell){geo25RenderLiveWhereBase(cell);geo25Request(cell,function(){if(PANEL==='where')geo25RenderPanel(cell);});geo25RenderPanel(cell);};
var geo25OpenCouncilBase=openCouncil;
openCouncil=function(cell,keep){geo25OpenCouncilBase(cell,keep);geo25RenderCouncilSeed(cell);};

window.ICOSA_LIVE.geonosisPanelVersion=GEONOSIS_PANEL_VERSION;
window.ICOSA_LIVE.callGeonosisCouncil=function(slug,statementId){var c=typeof slug==='string'?cellFromSlug(slug):slug;if(!c)return false;var st=geo25ForCell(c);if(!st||st.state!=='ready')return false;var s=(st.bundle.statements||[]).find(function(x){return x.id===statementId;})||geo25CurrentStatement(c,st.bundle);if(!s)return false;geo25SeedCouncil(c,s);return true;};

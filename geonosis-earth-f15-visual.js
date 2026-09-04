/* F15 EARTH · VISIBLE MATERIAL LENS
 * The architecture was real but perceptually buried. This layer makes the
 * working descendant legible at world scale without changing its evidence
 * semantics: selected ground stays the address; FIELD/GEOMETRY/VOLUME remain
 * distinct; native pages remain provenance only.
 */
var F15_VISUAL_VERSION='f15-visible-material-lens-v1';
var F15_VISUAL={lastPaint:0,lastLens:0};

function f15VisualDominant(){
  var h=F15.cover&&F15.cover.histogram;if(!h)return null;
  var best=null,n=-1;Object.keys(h).forEach(function(k){if(h[k]>n){n=h[k];best=+k;}});
  return best;
}
function f15VisualCoverText(){
  var d=f15VisualDominant();
  if(d!=null)return (F15_CLASSES[d]||('CLASS '+d));
  return F15.cover&&F15.cover.state||'LOADING';
}
function f15VisualLidarText(){
  var x=F15.lidar||{};
  if(x.state==='HEADER_READY')return 'COPC HEADER READY';
  return x.state||'UNAVAILABLE';
}
function f15VisualNativeText(){
  if(typeof F15_NATIVE==='undefined')return 'NATIVE · NOT LOADED';
  return 'NATIVE · '+F15_NATIVE.state+' · '+f15NativeBytes(F15_NATIVE.bytes)+' · '+F15_NATIVE.pages.length+'/'+F15_NATIVE_LIMITS.MAX_PAGES+' PAGES';
}
function f15VisualEnsureLens(){
  var stage=document.getElementById('stage');if(!stage)return null;
  var old=document.getElementById('f15-earth-plate');if(old)old.style.display='none';
  var el=document.getElementById('f15-material-lens');if(el)return el;
  var style=document.createElement('style');
  style.textContent='\
#f15-material-lens{position:absolute;z-index:18;right:max(12px,env(safe-area-inset-right));top:72px;width:min(330px,40vw);background:rgba(241,238,228,.96);border:2px solid var(--ink);box-shadow:5px 5px 0 rgba(18,21,20,.12);padding:10px 11px;pointer-events:auto;cursor:pointer;font-size:8px;line-height:1.45;letter-spacing:.07em}\
#f15-material-lens .f15vhead{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--ink);padding-bottom:6px;margin-bottom:7px}\
#f15-material-lens .f15vhead b{font-size:11px;letter-spacing:.13em}\
#f15-material-lens .f15vaddr{font-size:7px;color:var(--muted);max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#f15-material-lens .f15vfield{display:grid;grid-template-columns:64px 1fr;gap:7px;align-items:center;margin:5px 0}\
#f15-material-lens .f15vfield strong{font-size:8px}\
#f15-material-lens .f15vbar{height:6px;border:1px solid var(--ink);background:transparent;position:relative}\
#f15-material-lens .f15vbar i{display:block;height:100%;background:var(--ink)}\
#f15-material-lens .f15vtriangle{width:100%;height:56px;position:relative;margin:8px 0 6px;overflow:hidden;border-bottom:1px solid var(--ink)}\
#f15-material-lens .f15vtriangle:before{content:"";position:absolute;left:50%;top:2px;width:78px;height:48px;transform:translateX(-50%);clip-path:polygon(50% 0,100% 100%,0 100%);background:var(--f15field,#bdb8a8);opacity:.7}\
#f15-material-lens .f15vtriangle:after{content:"WORKING DESCENDANT";position:absolute;left:0;right:0;bottom:2px;text-align:center;font-size:7px;letter-spacing:.12em}\
#f15-material-lens .f15vfoot{border-top:1px solid var(--ink);padding-top:6px;margin-top:6px;color:var(--muted)}\
@media(max-width:620px){#f15-material-lens{top:auto;bottom:max(72px,env(safe-area-inset-bottom));right:10px;width:min(310px,72vw);font-size:7px;padding:8px 9px}#f15-material-lens .f15vtriangle{height:45px}}';
  document.head.appendChild(style);
  el=document.createElement('div');el.id='f15-material-lens';
  el.onclick=function(){var c=F15.selected||f15Selected();if(c&&typeof openWhere==='function')openWhere(c);};
  stage.appendChild(el);return el;
}
function f15VisualUpdateLens(force){
  var now=performance.now();if(!force&&now-F15_VISUAL.lastLens<180)return;F15_VISUAL.lastLens=now;
  var el=f15VisualEnsureLens();if(!el)return;
  var selected=F15.selected||f15Selected(),slug=selected?cellSlug(selected):'—';
  var z=F15.terrain&&F15.terrain.state==='READY'?(Math.round(F15.terrain.min)+'–'+Math.round(F15.terrain.max)+' m'):(F15.terrain&&F15.terrain.state||'LOADING');
  var cover=f15VisualCoverText(),p=F15.power&&F15.power.features?F15.power.features.length:0,w=F15.water&&F15.water.features?F15.water.features.length:0;
  var d=f15VisualDominant(),fieldColor=d!=null?(F15_COLORS[d]||'#bdb8a8'):'#bdb8a8';
  var requestN=F15.resources&&F15.resources.requests||0,featureN=F15.resources&&F15.resources.features||0;
  var reqPct=Math.min(100,requestN*7),featPct=Math.min(100,featureN/1.2);
  el.style.setProperty('--f15field',fieldColor);
  el.innerHTML='<div class="f15vhead"><b>F15 / MATERIAL LENS</b><span class="f15vaddr">'+f15Esc(slug)+'</span></div>'+ 
    '<div class="f15vtriangle"></div>'+ 
    '<div class="f15vfield"><strong>TERRAIN</strong><span>'+f15Esc(z)+'</span></div>'+ 
    '<div class="f15vfield"><strong>COVER</strong><span>'+f15Esc(cover)+' · 2021 FIELD</span></div>'+ 
    '<div class="f15vfield"><strong>LINES</strong><span>'+p+' POWER · '+w+' WATER</span></div>'+ 
    '<div class="f15vfield"><strong>LIDAR</strong><span>'+f15Esc(f15VisualLidarText())+'</span></div>'+ 
    '<div class="f15vfield"><strong>REQUESTS</strong><span class="f15vbar"><i style="width:'+reqPct+'%"></i></span></div>'+ 
    '<div class="f15vfield"><strong>GEOMETRY</strong><span class="f15vbar"><i style="width:'+featPct+'%"></i></span></div>'+ 
    '<div class="f15vfoot">'+f15Esc(f15VisualNativeText())+'<br>TAP THIS LENS TO READ THE WORKING SET</div>';
}
function f15VisualCellPath(cell,S){
  if(!cell)return null;var cs=cellCorners(cell).map(lonlat),pts=[];
  for(var i=0;i<3;i++){var sp=f15Screen(cs[i][0],cs[i][1],S);if(!sp)return null;pts.push(sp);}return pts;
}
function f15VisualFillCell(cell,S,fill,alpha){
  var p=f15VisualCellPath(cell,S);if(!p)return;ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();ctx.fill();ctx.restore();
}
function f15VisualOutline(cell,S,label){
  var p=f15VisualCellPath(cell,S);if(!p)return;ctx.save();ctx.strokeStyle='#121514';ctx.lineWidth=2.4;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();ctx.stroke();
  var c=lonlat(cellCentre(cell)),sp=f15Screen(c[0],c[1],S);if(sp){ctx.fillStyle='#121514';ctx.beginPath();ctx.arc(sp[0],sp[1],6,0,Math.PI*2);ctx.fill();ctx.font='700 8px ui-monospace,monospace';ctx.textAlign='left';ctx.fillText(label,sp[0]+10,sp[1]+3);}ctx.restore();
}
function f15VisualAura(cell,S){
  if(!cell)return;var c=lonlat(cellCentre(cell)),sp=f15Screen(c[0],c[1],S);if(!sp)return;var d=f15VisualDominant(),fill=d!=null?(F15_COLORS[d]||'#121514'):'#121514';ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle=fill;ctx.lineWidth=2;ctx.beginPath();ctx.arc(sp[0],sp[1],17,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(sp[0],sp[1],24,0,Math.PI*2);ctx.stroke();ctx.restore();
}
if(typeof drawGround==='function'){
  var f15VisualDrawBase=drawGround;
  drawGround=function(S){
    var d=f15VisualDominant(),fill=d!=null?(F15_COLORS[d]||'#bdb8a8'):'#bdb8a8';
    f15VisualFillCell(F15.coverCell,S,fill,.16);
    f15VisualFillCell(F15.geomCell,S,'#665678',.07);
    f15VisualDrawBase(S);
    if(F15.selected)f15VisualOutline(F15.selected,S,'F15 ADDRESS');
    f15VisualAura(F15.coverCell,S);
    f15VisualUpdateLens(false);
  };
}
if(typeof f15RefreshState==='function'){
  var f15VisualRefreshBase=f15RefreshState;
  f15RefreshState=function(){var r=f15VisualRefreshBase();f15VisualUpdateLens(true);return r;};
}
if(typeof f15NativeRefresh==='function'){
  var f15VisualNativeRefreshBase=f15NativeRefresh;
  f15NativeRefresh=function(){f15VisualNativeRefreshBase();f15VisualUpdateLens(true);};
}
setTimeout(function(){f15VisualEnsureLens();f15VisualUpdateLens(true);if(typeof wake==='function')wake();},80);

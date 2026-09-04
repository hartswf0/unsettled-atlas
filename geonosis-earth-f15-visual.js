/* F15 EARTH · MATERIAL TILE FIELD
 * F15 is not the old atlas with an outline. The grid itself becomes a
 * working-set display: unmaterialized tiles are visibly empty; bounded
 * working cells acquire evidence-driven terrain/cover; returned line
 * geometry is drawn as geometry. Nothing outside the loaded evidence region
 * is painted as if it had been observed.
 */
var F15_VISUAL_VERSION='f15-material-tile-field-v2';
var F15_VISUAL={lastLegend:0};

function f15VisualActive(){
  var c=(F15&&F15.selected)||f15Selected();
  return !!(c&&typeof f15IsActive==='function'&&f15IsActive(c));
}
function f15VisualHexRgb(hex){
  var s=String(hex||'').replace('#','');
  if(s.length===3)s=s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
  var n=parseInt(s,16);if(!Number.isFinite(n))return [189,184,168];
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function f15VisualMix(hex,toward,amount){
  var a=f15VisualHexRgb(hex),b=f15VisualHexRgb(toward),m=Math.max(0,Math.min(1,amount));
  var r=Math.round(a[0]*(1-m)+b[0]*m),g=Math.round(a[1]*(1-m)+b[1]*m),bl=Math.round(a[2]*(1-m)+b[2]*m);
  return 'rgb('+r+','+g+','+bl+')';
}
function f15VisualTriCentreLL(f,tri){
  var w=[0,0,0];
  for(var i=0;i<3;i++){w[0]+=tri[i][0]/3;w[1]+=tri[i][1]/3;w[2]+=tri[i][2]/3;}
  return lonlat(worldOf(f,w));
}
function f15VisualInside(cell,ll){
  if(!cell||!ll)return false;
  try{return cellContains(cell,fromLonLat(ll[0],ll[1]));}catch(e){return false;}
}
function f15VisualNearest(samples,ll,key){
  if(!Array.isArray(samples)||!samples.length)return null;
  var best=null,bd=Infinity,latr=ll[1]*Math.PI/180;
  for(var i=0;i<samples.length;i++){
    var s=samples[i],lon=Number(s.lon),lat=Number(s.lat),v=Number(s[key]);
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||!Number.isFinite(v))continue;
    var dx=lon-ll[0];if(dx>180)dx-=360;if(dx<-180)dx+=360;dx*=Math.cos(latr);
    var dy=lat-ll[1],d=dx*dx+dy*dy;
    if(d<bd){bd=d;best=s;}
  }
  return best;
}
function f15VisualMaterialAt(ll){
  var out={state:'UNMATERIALIZED',fill:'rgba(250,248,241,.88)',stroke:'rgba(95,103,99,.23)'};
  if(!f15VisualActive())return out;

  var inTerrain=f15VisualInside(F15.terrainCell,ll);
  var inCover=f15VisualInside(F15.coverCell,ll);
  if(inTerrain){
    out.state='TERRAIN';
    out.fill='rgba(205,199,184,.82)';
    out.stroke='rgba(18,21,20,.25)';
    if(F15.terrain&&F15.terrain.state==='READY'){
      var ts=f15VisualNearest(F15.terrain.samples,ll,'elevationM');
      if(ts){
        var span=Math.max(1,Number(F15.terrain.max)-Number(F15.terrain.min));
        var t=(Number(ts.elevationM)-Number(F15.terrain.min))/span;
        out.fill=f15VisualMix('#bdb8a8',t>.5?'#7f796d':'#f5f1e7',Math.abs(t-.5)*.82);
      }
    }else if(F15.terrain&&F15.terrain.state==='LOADING'){
      out.fill='rgba(214,208,194,.78)';
    }
  }
  if(inCover){
    out.state='COVER';
    if(F15.cover&&F15.cover.state==='READY'){
      var cs=f15VisualNearest(F15.cover.samples,ll,'classCode');
      if(cs&&F15_COLORS[cs.classCode]){
        var base=F15_COLORS[cs.classCode];
        if(F15.terrain&&F15.terrain.state==='READY'){
          var ts2=f15VisualNearest(F15.terrain.samples,ll,'elevationM');
          if(ts2){
            var span2=Math.max(1,Number(F15.terrain.max)-Number(F15.terrain.min));
            var t2=(Number(ts2.elevationM)-Number(F15.terrain.min))/span2;
            base=f15VisualMix(base,t2>.5?'#121514':'#faf8f1',.10+Math.abs(t2-.5)*.18);
          }
        }
        out.fill=base;out.stroke='rgba(18,21,20,.36)';
      }
    }else if(F15.cover&&F15.cover.state==='LOADING'){
      out.fill='rgba(168,70,42,.11)';out.stroke='rgba(168,70,42,.42)';
    }
  }
  return out;
}
function f15VisualFillTri(scr,mat){
  ctx.beginPath();ctx.moveTo(scr[0][0],scr[0][1]);ctx.lineTo(scr[1][0],scr[1][1]);ctx.lineTo(scr[2][0],scr[2][1]);ctx.closePath();
  ctx.fillStyle=mat.fill;ctx.fill();
  ctx.strokeStyle=mat.stroke;ctx.lineWidth=mat.state==='COVER'?.7:.55;ctx.stroke();
  if(mat.state==='UNMATERIALIZED'){
    var cx=(scr[0][0]+scr[1][0]+scr[2][0])/3,cy=(scr[0][1]+scr[1][1]+scr[2][1])/3;
    ctx.fillStyle='rgba(95,103,99,.20)';ctx.fillRect(cx-.65,cy-.65,1.3,1.3);
  }
}

/* Replace the visual grammar of F15 tiles only. Other faces retain the base
 * infinite grid exactly. The recursion remains bounded by the base budget.
 */
if(typeof drawGrid==='function'){
  var f15VisualGridBase=drawGrid;
  drawGrid=function(f,tri,depth,S,stopPx,budget){
    if(f!==15||!f15VisualActive())return f15VisualGridBase(f,tri,depth,S,stopPx,budget);
    var c=faceCorners[f],scr=[];
    for(var k=0;k<3;k++){
      var w=tri[k],p=[c[0][0]*w[0]+c[1][0]*w[1]+c[2][0]*w[2],c[0][1]*w[0]+c[1][1]*w[1]+c[2][1]*w[2],c[0][2]*w[0]+c[1][2]*w[1]+c[2][2]*w[2]];
      scr.push(project(toView(p),S));
    }
    var minx=Math.min(scr[0][0],scr[1][0],scr[2][0]),maxx=Math.max(scr[0][0],scr[1][0],scr[2][0]);
    var miny=Math.min(scr[0][1],scr[1][1],scr[2][1]),maxy=Math.max(scr[0][1],scr[1][1],scr[2][1]);
    if(maxx<-20||minx>W+20||maxy<-20||miny>H+20)return;
    var size=Math.max(maxx-minx,maxy-miny);
    if(size>stopPx&&depth<MAX_DEPTH&&budget.n<3000){
      budget.n++;
      for(var i=0;i<4;i++)drawGrid(f,childTri(tri,i),depth+1,S,stopPx,budget);
      return;
    }
    f15VisualFillTri(scr,f15VisualMaterialAt(f15VisualTriCentreLL(f,tri)));
  };
}

/* F15's inherited political/gazetteer surface becomes a ghost. The material
 * grid is the foreground. This is intentionally face-scoped.
 */
if(typeof drawFaceSurface==='function'){
  var f15VisualSurfaceBase=drawFaceSurface;
  drawFaceSurface=function(f,S){
    if(f!==15||!f15VisualActive())return f15VisualSurfaceBase(f,S);
    ctx.save();ctx.globalAlpha=.11;f15VisualSurfaceBase(f,S);ctx.restore();
  };
}

function f15VisualDrawGeometry(S){
  if(!f15VisualActive())return;
  function draw(features,stroke,width){
    if(!Array.isArray(features)||!features.length)return;
    ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
    for(var i=0;i<features.length;i++){
      var g=features[i]&&features[i].coordinates;if(!Array.isArray(g)||g.length<2)continue;
      var started=false;ctx.beginPath();
      for(var j=0;j<g.length;j++){
        var sp=f15Screen(g[j][0],g[j][1],S);if(!sp)continue;
        if(!started){ctx.moveTo(sp[0],sp[1]);started=true;}else ctx.lineTo(sp[0],sp[1]);
      }
      if(started)ctx.stroke();
    }
    ctx.restore();
  }
  draw(F15.water&&F15.water.features,'rgba(57,127,157,.94)',Math.max(1.5,1.1+view.zoom*.16));
  draw(F15.power&&F15.power.features,'rgba(168,70,42,.98)',Math.max(1.8,1.35+view.zoom*.18));
}
function f15VisualOutlineWorking(cell,S,stroke,dash){
  if(!cell)return;var p=f15VisualCellPath(cell,S);if(!p)return;
  ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=1.25;ctx.setLineDash(dash||[]);ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);ctx.lineTo(p[1][0],p[1][1]);ctx.lineTo(p[2][0],p[2][1]);ctx.closePath();ctx.stroke();ctx.restore();
}
function f15VisualCellPath(cell,S){
  if(!cell)return null;var cs=cellCorners(cell).map(lonlat),pts=[];
  for(var i=0;i<3;i++){var sp=f15Screen(cs[i][0],cs[i][1],S);if(!sp)return null;pts.push(sp);}return pts;
}

/* Keep the HUD nearly empty: one narrow state strip. The map carries the
 * semantics; the strip only tells the reader what has materialized.
 */
function f15VisualEnsureLegend(){
  var stage=document.getElementById('stage');if(!stage)return null;
  var plate=document.getElementById('f15-earth-plate');if(plate)plate.style.display='none';
  var old=document.getElementById('f15-material-lens');if(old)old.remove();
  var el=document.getElementById('f15-material-strip');if(el)return el;
  var style=document.createElement('style');style.textContent='\
#f15-material-strip{position:absolute;z-index:18;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));background:rgba(250,248,241,.90);border:1px solid rgba(18,21,20,.5);padding:4px 6px;font:700 7px/1.35 ui-monospace,monospace;letter-spacing:.11em;pointer-events:none;white-space:nowrap}\
#f15-material-strip i{font-style:normal;font-weight:400;color:var(--muted)}';document.head.appendChild(style);
  el=document.createElement('div');el.id='f15-material-strip';stage.appendChild(el);return el;
}
function f15VisualUpdateLegend(force){
  if(!f15VisualActive())return;
  var now=performance.now();if(!force&&now-F15_VISUAL.lastLegend<220)return;F15_VISUAL.lastLegend=now;
  var el=f15VisualEnsureLegend();if(!el)return;
  var cover=F15.cover&&F15.cover.state||'—',terrain=F15.terrain&&F15.terrain.state||'—';
  var p=F15.power&&F15.power.features?F15.power.features.length:0,w=F15.water&&F15.water.features?F15.water.features.length:0;
  el.innerHTML='F15 · MATERIAL TILES <i>TERRAIN '+terrain+' · COVER '+cover+' · '+p+' POWER · '+w+' WATER</i>';
}

if(typeof drawGround==='function'){
  var f15VisualDrawGroundBase=drawGround;
  drawGround=function(S){
    f15VisualDrawGroundBase(S);
    if(!f15VisualActive())return;
    f15VisualDrawGeometry(S);
    f15VisualOutlineWorking(F15.terrainCell,S,'rgba(18,21,20,.36)',[5,4]);
    f15VisualOutlineWorking(F15.coverCell,S,'rgba(168,70,42,.76)',[]);
    f15VisualUpdateLegend(false);
  };
}
if(typeof f15RefreshState==='function'){
  var f15VisualRefreshBase=f15RefreshState;
  f15RefreshState=function(){var r=f15VisualRefreshBase();f15VisualUpdateLegend(true);if(typeof wake==='function')wake();return r;};
}
setTimeout(function(){if(f15VisualActive()){f15VisualEnsureLegend();f15VisualUpdateLegend(true);if(typeof wake==='function')wake();}},80);

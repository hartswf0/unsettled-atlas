/* F15 EARTH · GROUND, NOT CHROME
 * The only visible intervention: actual WorldCover categories paint the
 * active material descendant; real OSM power/water geometry remains on top.
 * No lens, badge, bullseye, legend, dashboard, or synthetic interpolation.
 */
var F15_GROUND_VERSION='f15-ground-v1';
var F15_GROUND={slug:null,generation:0,abort:null,state:'IDLE',points:[],error:null};
var F15_GROUND_N=22;

function f15GroundReset(cell){
  if(F15_GROUND.abort)try{F15_GROUND.abort.abort();}catch(e){}
  F15_GROUND.abort=new AbortController();
  F15_GROUND.slug=cell?cellSlug(cell):null;
  F15_GROUND.generation++;
  F15_GROUND.state='LOADING';
  F15_GROUND.points=[];
  F15_GROUND.error=null;
  return {g:F15_GROUND.generation,signal:F15_GROUND.abort.signal};
}
function f15GroundSame(g){return g===F15_GROUND.generation;}
function f15GroundBounds(cell){
  var p=cellCorners(cell).map(lonlat),w=180,e=-180,s=90,n=-90;
  for(var i=0;i<p.length;i++){w=Math.min(w,p[i][0]);e=Math.max(e,p[i][0]);s=Math.min(s,p[i][1]);n=Math.max(n,p[i][1]);}
  return {west:w,east:e,south:s,north:n,crosses:(e-w)>180};
}
function f15GroundGrid(cell){
  var b=f15GroundBounds(cell),out=[];
  if(b.crosses)throw new Error('dateline field window not supported');
  var nx=F15_GROUND_N,ny=F15_GROUND_N;
  for(var y=0;y<ny;y++)for(var x=0;x<nx;x++){
    var lon=b.west+(x+.5)/nx*(b.east-b.west),lat=b.south+(y+.5)/ny*(b.north-b.south);
    if(cellContains(cell,fromLonLat(lon,lat)))out.push({lon:lon,lat:lat,x:x,y:y});
  }
  return out;
}
function f15GroundMaterialize(cell,force){
  cell=cell||F15.coverCell||f15Selected();
  if(!cell)return Promise.resolve(F15_GROUND);
  var slug=cellSlug(cell);
  if(!force&&F15_GROUND.slug===slug&&F15_GROUND.state==='READY')return Promise.resolve(F15_GROUND);
  var run=f15GroundReset(cell),g=run.g,signal=run.signal,pts;
  try{pts=f15GroundGrid(cell);}catch(e){F15_GROUND.state='ERROR';F15_GROUND.error=String(e.message||e);return Promise.resolve(F15_GROUND);}
  var groups={};
  for(var i=0;i<pts.length;i++){
    var code=f15TileCode(pts[i].lat,pts[i].lon);
    if(!groups[code])groups[code]=[];
    groups[code].push(pts[i]);
  }
  var codes=Object.keys(groups);
  if(codes.length>F15_LIMITS.MAX_COG_TILES){F15_GROUND.state='ERROR';F15_GROUND.error='COG budget exceeded';return Promise.resolve(F15_GROUND);}
  var jobs=codes.map(function(code){
    return f15CogOpen(code,signal).then(function(t){return t.getImage(0);}).then(function(image){
      var bbox=image.getBoundingBox(),w=image.getWidth(),h=image.getHeight(),gp=groups[code],pix=[];
      var minX=w-1,minY=h-1,maxX=0,maxY=0;
      for(var j=0;j<gp.length;j++){
        var px=Math.max(0,Math.min(w-1,Math.floor((gp[j].lon-bbox[0])/(bbox[2]-bbox[0])*w)));
        var py=Math.max(0,Math.min(h-1,Math.floor((bbox[3]-gp[j].lat)/(bbox[3]-bbox[1])*h)));
        gp[j].px=px;gp[j].py=py;minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
      }
      var rw=Math.max(1,maxX-minX+1),rh=Math.max(1,maxY-minY+1);
      return image.readRasters({window:[minX,minY,maxX+1,maxY+1],samples:[0],interleave:true,signal:signal}).then(function(data){
        for(var k=0;k<gp.length;k++){
          var ix=(gp[k].py-minY)*rw+(gp[k].px-minX),v=f15Finite(data&&data[ix]);
          pix.push({lon:gp[k].lon,lat:gp[k].lat,classCode:v});
        }
        return pix;
      });
    });
  });
  return Promise.all(jobs).then(function(all){
    if(!f15GroundSame(g))return F15_GROUND;
    var out=[];for(var i=0;i<all.length;i++)out=out.concat(all[i]);
    F15_GROUND.points=out;F15_GROUND.state='READY';F15_GROUND.error=null;if(typeof wake==='function')wake();return F15_GROUND;
  }).catch(function(e){
    if(!f15GroundSame(g)||f15AbortError(e))return F15_GROUND;
    F15_GROUND.state='ERROR';F15_GROUND.error=String(e&&e.message||e);if(typeof wake==='function')wake();return F15_GROUND;
  });
}
function f15GroundDraw(S){
  if(F15_GROUND.state!=='READY'||!F15_GROUND.points.length)return;
  ctx.save();ctx.globalAlpha=.78;
  var size=Math.max(3,Math.min(11,Math.min(W,H)*.012));
  for(var i=0;i<F15_GROUND.points.length;i++){
    var p=F15_GROUND.points[i],sp=f15Screen(p.lon,p.lat,S);if(!sp)continue;
    ctx.fillStyle=F15_COLORS[p.classCode]||'rgba(0,0,0,0)';
    ctx.fillRect(sp[0]-size/2,sp[1]-size/2,size,size);
  }
  ctx.restore();
}

/* Remove the old F15 plate: the map is the readout. */
setTimeout(function(){var p=document.getElementById('f15-earth-plate');if(p)p.remove();var l=document.getElementById('f15-material-lens');if(l)l.remove();},0);

if(typeof drawGround==='function'){
  var f15GroundBase=drawGround;
  drawGround=function(S){
    f15GroundBase(S);
    f15GroundDraw(S);
  };
}

if(typeof f15Request==='function'){
  var f15GroundRequestBase=f15Request;
  f15Request=function(cell,force){
    var p=f15GroundRequestBase(cell,force);
    var target=F15.coverCell||f15Attention(cell||f15Selected(),F15_LIMITS.COVER_MAX_KM);
    if(target)f15GroundMaterialize(target,!!force);
    return p;
  };
}

/* When the cover descendant changes after an asynchronous request, follow it. */
if(typeof f15RefreshState==='function'){
  var f15GroundRefreshBase=f15RefreshState;
  f15RefreshState=function(){var r=f15GroundRefreshBase();if(F15.coverCell&&F15_GROUND.slug!==cellSlug(F15.coverCell))f15GroundMaterialize(F15.coverCell,false);return r;};
}

window.ICOSA_EARTH_GROUND={version:F15_GROUND_VERSION,state:function(){return F15_GROUND;},request:function(){return f15GroundMaterialize(F15.coverCell||f15Selected(),true);}};

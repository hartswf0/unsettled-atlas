import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const atlasPath = path.join(root, 'icosa-syntegrity.html');
const sourcePath = path.join(root, 'geonosis-earth-f15-lite.js');
const nativePath = path.join(root, 'geonosis-earth-native-pages.js');
const visualPath = path.join(root, 'geonosis-earth-f15-visual.js');
const markerStart = '/* F15 MATERIAL GROUND · SAME-INSTRUMENT EARTH WORKING SET · GENERATED V5 */';
const markerEnd = '/* END F15 MATERIAL GROUND · GENERATED V5 */';

function need(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`F15 integration contract drift: ${label}`);
  return text.replace(from, to);
}

let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace("var F15_EARTH_VERSION='f15-earth-lean-v2';", "var F15_EARTH_VERSION='f15-earth-integrated-v5';");

source = need(source,
  "function f15AbortError(e){return !!(e&&(e.name==='AbortError'||String(e).indexOf('AbortError')>=0));}\n",
  "function f15AbortError(e){return !!(e&&(e.name==='AbortError'||String(e).indexOf('AbortError')>=0));}\n" +
  "function f15IsActive(cell){return !!(cell&&Number(cell.f)===15);}\n" +
  "function f15HidePlate(){var el=document.getElementById('f15-earth-plate');if(el)el.style.display='none';}\n" +
  "function f15Deactivate(){if(F15.abort)F15.abort.abort();F15.generation++;F15.selected=null;F15.terrainCell=null;F15.coverCell=null;F15.geomCell=null;F15.state='IDLE';F15.lastRequestKey=null;f15HidePlate();}\n",
  'face gate');

source = need(source,
  "function f15Request(selected,force){\n  selected=selected||f15Selected();if(!selected)return Promise.resolve(null);",
  "function f15Request(selected,force){\n  selected=selected||f15Selected();if(!selected||!f15IsActive(selected)){f15Deactivate();return Promise.resolve(null);}",
  'request gate');

source = need(source,
  "function f15UpdatePlate(){\n  var el=f15EnsurePlate();if(!el)return;",
  "function f15UpdatePlate(){\n  var active=F15.selected||f15Selected();if(!f15IsActive(active)){f15HidePlate();return;}\n  var el=f15EnsurePlate();if(!el)return;el.style.display='block';",
  'plate gate');

source = need(source,
  "<b>F15 · EARTH WORKING SET · '+f15Esc(F15.state)+'</b>",
  "<b>F15 · MATERIAL GROUND · '+f15Esc(F15.state)+'</b><div class=\"f15dim\">BUILD · INTEGRATED V5</div>",
  'visible build marker');

source = need(source,
`  openWhere=function(cell,keep){
    var r=f15OpenWhereBase(cell,keep);
    var root=document.getElementById('panel');if(root&&cell){
      var old=document.getElementById('f15-earth-where');if(old)old.remove();
      root.insertAdjacentHTML('beforeend',f15WhereHTML());
      f15Request(cell,false);
    }
    return r;
  };`,
`  openWhere=function(cell,keep){
    var r=f15OpenWhereBase(cell,keep);
    var root=document.getElementById('panel'),old=document.getElementById('f15-earth-where');if(old)old.remove();
    if(root&&cell&&f15IsActive(cell)){root.insertAdjacentHTML('beforeend',f15WhereHTML());f15Request(cell,false);}
    return r;
  };`,
  'WHERE gate');

source = need(source,
  "function f15ScheduleFocus(){\n  var c=f15Selected();if(!c)return;var slug=cellSlug(c);",
  "function f15ScheduleFocus(){\n  var c=f15Selected();if(!c||!f15IsActive(c)){if(F15.selected)f15Deactivate();else f15HidePlate();return;}var slug=cellSlug(c);",
  'focus gate');

source = need(source,
  "if(typeof drawGround==='function'){\n  var f15DrawGroundBase=drawGround;",
`function f15DrawSelectedGround(cell,S){
  if(!cell||!f15IsActive(cell))return;
  var cs=cellCorners(cell).map(lonlat),pts=[];
  for(var i=0;i<3;i++){var sp=f15Screen(cs[i][0],cs[i][1],S);if(!sp)return;pts.push(sp);}
  ctx.save();ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[2][0],pts[2][1]);ctx.closePath();
  ctx.fillStyle='rgba(168,70,42,.10)';ctx.fill();ctx.strokeStyle='rgba(168,70,42,.92)';ctx.lineWidth=2.4;ctx.stroke();
  var c=lonlat(cellCentre(cell)),sc=f15Screen(c[0],c[1],S);
  if(sc){ctx.fillStyle='#a8462a';ctx.font='700 9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('F15 / MATERIAL',sc[0],sc[1]-11);}
  ctx.restore();
}
if(typeof drawGround==='function'){
  var f15DrawGroundBase=drawGround;`,
  'selected-ground mark');

source = need(source,
`  drawGround=function(S){
    f15DrawGroundBase(S);
    f15DrawCell(F15.terrainCell,S,'rgba(18,21,20,.55)','Z');
    f15DrawCell(F15.coverCell,S,'rgba(168,70,42,.72)','FIELD');
    f15DrawCell(F15.geomCell,S,'rgba(67,61,105,.72)','GEOM');
    f15DrawGeometry(F15.water,S,'rgba(47,111,137,.95)',1.35);
    f15DrawGeometry(F15.power,S,'rgba(88,41,105,.95)',1.65);
    f15DrawSamples(S);
    f15ScheduleFocus();
  };`,
`  drawGround=function(S){
    f15DrawGroundBase(S);
    var active=f15Selected();
    if(!f15IsActive(active)){f15ScheduleFocus();return;}
    f15DrawSelectedGround(active,S);
    f15DrawCell(F15.terrainCell,S,'rgba(18,21,20,.68)','Z');
    f15DrawCell(F15.coverCell,S,'rgba(168,70,42,.88)','FIELD');
    f15DrawCell(F15.geomCell,S,'rgba(67,61,105,.88)','GEOM');
    f15DrawGeometry(F15.water,S,'rgba(47,111,137,.98)',1.7);
    f15DrawGeometry(F15.power,S,'rgba(88,41,105,.98)',2.0);
    f15DrawSamples(S);f15ScheduleFocus();
  };`,
  'render gate');

source = need(source,
  "f15EnsurePlate();\nsetTimeout(function(){f15Request(f15Selected(),true);},120);",
  "setTimeout(function(){var c=f15Selected();if(f15IsActive(c)){f15EnsurePlate();f15UpdatePlate();f15Request(c,true);}else f15HidePlate();},120);",
  'startup gate');

const native = fs.readFileSync(nativePath, 'utf8');
const visual = fs.readFileSync(visualPath, 'utf8');
const bundle = source +
  '\n/* --- F15 NATIVE STAC / COG / COPC PAGES --- */\n' + native +
  '\n/* --- F15 MATERIAL TILE FIELD --- */\n' + visual +
  "\nwindow.ICOSA_F15_INTEGRATED='2026-09-04.integrated-v5-material-tiles';\n";

fs.writeFileSync('/tmp/f15-integrated.js', bundle);

let atlas = fs.readFileSync(atlasPath, 'utf8');
const oldStart = atlas.indexOf(markerStart);
if (oldStart >= 0) {
  const oldEnd = atlas.indexOf(markerEnd, oldStart);
  if (oldEnd < 0) throw new Error('unterminated prior F15 generated block');
  atlas = atlas.slice(0, oldStart) + atlas.slice(oldEnd + markerEnd.length);
}
const close = atlas.lastIndexOf('})();');
if (close < 0) throw new Error('main ICOSA closure not found');
const block = `\n${markerStart}\n${bundle}\n${markerEnd}\n`;
atlas = atlas.slice(0, close) + block + atlas.slice(close);
fs.writeFileSync(atlasPath, atlas);
console.log(`Integrated F15 material ground: ${bundle.length} bytes into ${path.basename(atlasPath)}.`);

/* ICOSA SYNTEGRITY — the constitution, run end-to-end with the API mocked.
 *
 * Run it:
 *   python3 -m http.server 8811          # from the repo root
 *   node icosa-syntegrity.test.mjs       # needs playwright + chromium
 *
 * A full convening is staged against a mocked OpenAI endpoint that speaks
 * the current schemas — compiled claims (op + evidence), admissibility,
 * structured carries, agenda standings, outcomes with a research agenda —
 * and COPY THE RUN must carry the whole constitution: the system
 * instruction verbatim, the registers as operators, every scored line with
 * its evidence, the carries with their contradictions, and the spend.
 */
const pw = await (async () => {
  try { return await import('playwright'); }
  catch { return await import('/opt/node22/lib/node_modules/playwright/index.js'); }
})();
const { chromium } = pw.default || pw;
const BASE = process.env.ICOSA_URL || 'http://127.0.0.1:8811';
const b=await chromium.launch(); const out={};
async function rig(p){
  for (const h of ['query.wikidata.org','www.wikidata.org','overpass-api.de'])
    await p.route('**/'+h+'/**', r=>r.abort());
  await p.route('**/api.gdeltproject.org/**', r=>r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify({articles:[{title:'Local dispute',url:'https://x/g',domain:'reuters.com',seendate:'20260811T080000Z'}]})}));
  await p.route('**/en.wikipedia.org/**', r=>{
    const u=r.request().url();
    if (u.includes('prop=extracts')){
      const titles=decodeURIComponent((u.match(/titles=([^&]+)/)||[,''])[1]).split('|');
      return r.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({query:{pages:titles.map(ti=>({title:ti,
          extract:'EXTRACT for '+ti+': population 4,213; the phosphate mine closed in 1998; '+
          'the canal authority holds jurisdiction since 1975; the river floods each May.'}))}})});
    }
    return r.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:'{}'});
  });
  await p.route('**/api.openai.com/v1/models', r=>r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify({data:[{id:'gpt-5.6-sol'},{id:'gpt-5.6-terra'}]})}));
  await p.route('**/api.openai.com/v1/responses', async r=>{
    const bo=JSON.parse(r.request().postData()||'{}');
    const ctx=JSON.parse(bo.input[0].content[0].text); const op=ctx.operation||{};
    seen.push({type:op.type, iteration:op.iteration||null,
      readings:(ctx.evidence&&ctx.evidence.readings)?ctx.evidence.readings.length:0,
      temperature:(op.topic&&op.topic.temperature)||op.temperature||null,
      members:(op.members||[]).map(m=>({seat:m.seat, hasSoul:!!m.soul,
        hasScratch:!!m.scratch, hasMemories:Array.isArray(m.memories),
        memoryCount:(m.memories||[]).length,
        incoming:(m.incoming||[]).map(x=>({kind:x.kind||null,tension:x.tension||null}))})),
      seats:(op.seats||[]).map(s=>({seat:s.seat, rooms:(s.two_rooms||[]).map(r=>r.room),
        hasScratch:!!s.scratch}))});
    let txt;
    if (op.type==='WRITE_CHARTER') txt=JSON.stringify({charter:'CHARTER-BODY: argued from the ground.',
      opening_question:'OPENING-Q: who holds the water?',
      agenda:(op.topic_points||[]).map(tp=>({topic:tp.id,subject:'SUBJ-'+tp.id,statement:'ST-'+tp.id,
        standing:'QUESTIONED',basis:''})),
      tensions:[{title:'TENSION-A',why_now:'because now'}]});
    else if (op.type==='SPEAK') txt=JSON.stringify({utterances:(op.members||[]).map(m=>({seat:m.seat,
      op:'cite',move:'joke',evidence:['evidence.recent: Local dispute'],
      memories:(m.memories||[]).slice(0,1).map(x=>x.id),
      question:'Q-'+m.seat+'?',
      text:'SPOKE-'+m.seat+' at '+op.topic.place+'.'})),needs:[]});
    else if (op.type==='CRITIQUE') txt=JSON.stringify({utterances:(op.critics||[]).map(m=>({seat:m.seat,
      op:'name-missing',evidence:['evidence.recent'],memories:[],question:'',text:'CRIT-'+m.seat}))});
    else if (op.type==='JUDGE'){
      const seats=[...new Set([...(op.said||[]),...(op.critiques||[])].map(u=>u.seat))];
      txt=JSON.stringify({scores:seats.map(sn=>({seat:sn,admissible:true,grounded:3,register:3,specific:2,engaged:2,
        note:'fine',carry:(op.members||[]).some(m=>m.seat===sn)
          ?{claim:'CARRY',evidence:'EV-'+sn,contradiction:'CONTRA-'+sn}
          :{claim:'',evidence:'',contradiction:''}}))});
    } else if (op.type==='WRITE_SOULS') txt=JSON.stringify({souls:(op.bench||[]).map(b=>({
      seat:b.seat,attention:'ATT-'+b.seat,values:['V'+b.seat],refusals:['R'+b.seat],
      tactics:['joke','reframe','attack-premise'],update_when:'UPD-'+b.seat,
      belief:'B0-'+b.seat,desire:'D0-'+b.seat,charge:'calm'}))});
    else if (op.type==='CHAT') txt=JSON.stringify({notice:'N',pressure:'P',move:'joke',
      text:'CHAT-REPLY to: '+op.user_line,
      absorb:{belief:'B1-CHANGED',desire:'',charge:'amused'},remember:'REMEMBER-THIS'});
    else if (op.type==='REFLECT') txt=JSON.stringify({reflections:(op.seats||[]).map(s=>({
      seat:s.seat,implication:'IMPL-'+s.seat+' across '+s.two_rooms.map(r=>r.room).join('&'),
      bridge_to:s.two_rooms[1].room,bridge_claim:'BRIDGE-'+s.seat,
      why_there:'WHY-'+s.seat,tension:'TENSION-'+s.seat}))});
    else if (op.type==='OUTCOME') txt=JSON.stringify({outcomes:(op.topics||[]).map(tp=>({topic:tp.id,
      statement:'OUT-'+tp.id+' at '+tp.place+'.',dissent:tp.id%2?'DISSENT-'+tp.id:'',
      needed:'NEEDED-'+tp.id}))});
    else txt='{}';
    return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({output:[{content:[{type:'output_text',text:txt}]}],
        usage:{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:800},
               output_tokens_details:{reasoning_tokens:30}}})});
  });
}
const ctx=await b.newContext({viewport:{width:1000,height:900}});
await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:BASE});
const p=await ctx.newPage(); const errs=[]; const seen=[]; p.on('pageerror',e=>errs.push(e.message));
await rig(p);
await p.addInitScript(()=>{try{
  localStorage.setItem('icosa.openai.key','sk-t');
  localStorage.setItem('icosa.syn.v1',JSON.stringify({seats:{'F11.1103|0':'Ada Testholder'}}));
}catch(e){}});
await p.goto(BASE+'/icosa-syntegrity.html#F11.1103'); await p.waitForTimeout(3000);
await p.click('#cellplate'); await p.waitForTimeout(600);
await p.evaluate(()=>{const x=[...document.querySelectorAll('#panel button')].find(y=>/COUNCIL/.test(y.textContent)); if(x)x.click();});
await p.waitForTimeout(4000);
await p.evaluate(()=>document.getElementById('cRun').click());
// while the run churns, the RUN BOARD must say where the process is
const board = { seen:false, live:false, roomChips:0, rows:0, clock:false, done:0 };
for (let i=0;i<40;i++){ await p.waitForTimeout(800);
  const b = await p.evaluate(()=>{
    const rb=document.querySelector('#convene .runboard');
    if (!rb) return null;
    return { live: !!rb.querySelector('.stg.live'),
      rooms: rb.querySelectorAll('.stg.rm').length,
      rows: rb.querySelectorAll('.rbrow').length,
      done: rb.querySelectorAll('.stg.done').length,
      clock: !!document.getElementById('cvClock') };
  });
  if (b){ board.seen=true; board.live=board.live||b.live;
    board.roomChips=Math.max(board.roomChips,b.rooms);
    board.rows=Math.max(board.rows,b.rows); board.done=Math.max(board.done,b.done);
    board.clock=board.clock||b.clock; }
  if (await p.evaluate(()=>([...document.querySelectorAll('#panel p')].some(x=>/things said across/.test(x.textContent))))) break; }
await p.waitForTimeout(500);
out.board = { seen: board.seen, liveChipSeen: board.live, clock: board.clock,
  roomChipsBothReverbs: board.roomChips===12, rows: board.rows===4,
  progressAccumulated: board.done>=6 };

// copy from the council view
await p.evaluate(()=>document.getElementById('cCopyRun').click());
await p.waitForTimeout(600);
const doc = await p.evaluate(()=>navigator.clipboard.readText());
const btnLabel = await p.evaluate(()=>document.getElementById('cCopyRun').textContent);
out.council = {
  errs, copied: !!doc, btnSaysCopied: btnLabel==='COPIED', chars: doc.length,
  isPrompt: /^# RUN A SYNTEGRATION · F11\.1103/.test(doc) && doc.includes('This document is a runnable prompt'),
  polygon: doc.includes('## THE POLYGON'),
  corners: (doc.match(/^- corner \d:/gm)||[]).length,
  containment: /- contained by: F11 → F11\.1 → F11\.11 → F11\.110/.test(doc),
  harnessSteps: (doc.match(/^\d\. [A-Z]/gm)||[]).length,
  youAreTheHarness: doc.includes('you are the harness'),
  fetchFirst: doc.includes('1. FETCH FIRST'),
  readDemanded: doc.includes('AND READ') && /may only cite what (has been read|is in THE READINGS)/.test(doc),
  unclaimedBranch: doc.includes('UNCLAIMED — fetch or infer a holder'),
  outputFormatDemanded: doc.includes('6. WRITE IT DOWN in exactly the transcript format'),
  addressTracked: doc.includes('Head your output with the address F11.1103'),
  systemInstruction: doc.includes('## SYSTEM INSTRUCTION'),
  lawVerbatim: doc.includes('CHARTER-BODY: argued from the ground.'),
  lawIsHarnessLaw: /operation\.directive/.test(doc),
  opening: doc.includes('OPENING-Q: who holds the water?'),
  agenda: (doc.match(/- TOPIC \d+ · QUESTIONED · SUBJ-\d+/g)||[]).length,
  agendaStanding: doc.includes('Each subject carries its epistemic standing'),
  tensions: doc.includes('TENSION-A — because now'),
  ground: doc.includes('## THE GROUND') && /governed by Egypt/.test(doc),
  topicsWithCoords: (doc.match(/^- TOPIC \d+ · .+ · \d+\.\d+°[NS] \d+\.\d+°[EW]/gm)||[]).length,
  bench: (doc.match(/^- SEAT \d+/gm)||[]).length,
  benchRooms: (doc.match(/speaks in rooms \d+ & \d+ · answers rooms \d+ & \d+/g)||[]).length,
  transcript: doc.includes('## THE TRANSCRIPT SO FAR') && doc.includes('Inherit it'),
  reverbHeads: (doc.match(/### CONVENING 1 · REVERBERATION \d OF \d/g)||[]).length,
  spokeLines: (doc.match(/SPOKE-\d+ at /g)||[]).length,
  scores: (doc.match(/\[10\/12\]/g)||[]).length,
  carried: (doc.match(/- carried in from room \d/g)||[]).length,
  carriedContradiction: doc.includes('undecided: CONTRA-'),
  carriedEvidence: doc.includes('[stands on: EV-'),
  evidenceLines: (doc.match(/^  ← evidence\.recent/gm)||[]).length,
  outcomes: (doc.match(/- OUTCOME: OUT-\d/g)||[]).length,
  dissent: doc.includes('still open: DISSENT-'),
  mustLearn: doc.includes('must learn: NEEDED-'),
  operatorNotVoice: doc.includes('EPISTEMIC OPERATOR') && doc.includes('never a simulated voice'),
  admissibilityFirst: doc.includes('ADMISSIBILITY FIRST') && doc.includes('INVALID'),
  silenceIsPerfect: doc.includes('op silence'),
  claimIsCompiled: doc.includes('claim = operation(register, evidence)'),
  made: doc.includes('## HOW THE LAST RUN WAS MADE') && doc.includes('gpt-5.6-sol'),
  spend: /spend, all time on this record: \d+ calls/.test(doc),
  reflections: (doc.match(/- SEAT REFLECTION \(simulated seat position, not the person’s belief\)/g)||[]).length,
  bridgesRouted: (doc.match(/- bridge from room \d/g)||[]).length,
  bridgeTension: doc.includes('tension: TENSION-'),
  bridgeWhy: doc.includes('why it matters here: WHY-'),
  reflectStep: doc.includes('e. after ALL rooms') && doc.includes('Same topology, different minds'),
  pipelineHasMinds: doc.includes('seats reflect') && doc.includes('memory stream'),
  soulLines: (doc.match(/^  soul: attends to ATT-\d+/gm)||[]).length,
  readingsSection: doc.includes('## THE READINGS') && doc.includes('article text, not'),
  readingsWithFacts: (doc.match(/^- .+ \((place|person|topic)\): EXTRACT for .+population 4,213/gm)||[]).length,
  personRead: /^- Ada Testholder \(person\): EXTRACT/m.test(doc),
  moveLines: (doc.match(/move: joke/g)||[]).length > 10,
};
// the mind between the calls: perspectival packets, scratch continuity, memory
const soulsCalls = seen.filter(s=>s.type==='WRITE_SOULS');
const speaks = seen.filter(s=>s.type==='SPEAK');
const r1 = speaks.filter(s=>/^1\//.test(s.iteration||''));
const r2 = speaks.filter(s=>/^2\//.test(s.iteration||''));
const reflects = seen.filter(s=>s.type==='REFLECT');
out.minds = {
  soulsCompiledOnce: soulsCalls.length===1,
  everySpeakFed: speaks.every(s=>s.readings>0),
  charterFed: seen.some(s=>s.type==='WRITE_CHARTER' && s.readings>0),
  speakCalls: speaks.length,
  soulsInPackets: r2.length>0 && r2.every(s=>s.members.every(m=>m.seat!==0 || m.hasSoul)),
  jokesWarmTheRoom: r2.some(s=>s.temperature==='playful'),
  perspectival: speaks.every(s=>s.members.length && s.members.every(m=>m.hasScratch && m.hasMemories)),
  r2HasMemories: r2.length>0 && r2.some(s=>s.members.some(m=>m.memoryCount>0)),
  r2HasBridges: r2.some(s=>s.members.some(m=>m.incoming.some(x=>x.kind==='bridge' && x.tension))),
  reflectCalls: reflects.length,
  reflectSeesBothRooms: reflects.every(s=>s.seats.length && s.seats.every(x=>x.rooms.length===2 && x.hasScratch)),
};
out.memory = await p.evaluate(()=>{
  const M = window.ICOSA_MEM.all();
  const types = {}; M.forEach(m=>{types[m.type]=(types[m.type]||0)+1;});
  // geographic inheritance: memories written at F11.1103 retrievable at the parent
  const up = window.ICOSA_MEM.retrieve('F11.110', 0, 0, 'SPOKE dispute', 6);
  return { total: M.length, types,
    typed: M.every(m=>['EVIDENCE','HEARD_CLAIM','UTTERANCE','CRITIQUE','BRIDGE','REFLECTION','CONTRADICTION','OPEN_QUESTION','COMMITMENT','OUTCOME'].includes(m.type)),
    scoped: M.every(m=>m.cell==='F11.1103'),
    provenanced: M.every(m=>m.prov>=0 && m.prov<=3 && m.imp>=0 && m.imp<=3),
    inheritedUp: up.length>0 && up.every(x=>x.inherited && x.scope==='F11.1103') };
});
// and from the transcript view, with the file button present
await p.evaluate(()=>document.getElementById('cScript').click());
await p.waitForTimeout(800);
await p.evaluate(()=>navigator.clipboard.writeText(''));
await p.evaluate(()=>document.getElementById('tCopy').click());
await p.waitForTimeout(600);
const doc2 = await p.evaluate(()=>navigator.clipboard.readText());
const dl = p.waitForEvent('download',{timeout:4000}).catch(()=>null);
await p.evaluate(()=>document.getElementById('tTake').click());
const got = await dl;
out.transcript = {
  sameShape: doc2.includes('## SYSTEM INSTRUCTION') && doc2.includes('## THE TRANSCRIPT SO FAR'),
  fileOffered: !!got, fileName: got && got.suggestedFilename(),
};
// ---- speaking with one seat, individually ----
// the transcript view is open; walk back to the council, then the deck
await p.click('#cellplate'); await p.waitForTimeout(400);
await p.evaluate(()=>{const x=[...document.querySelectorAll('#panel button')].find(y=>/COUNCIL/.test(y.textContent)); if(x)x.click();});
await p.waitForTimeout(1500);
await p.evaluate(()=>document.getElementById('cDeck').click());
await p.waitForTimeout(1200);
await p.evaluate(()=>{const c=[...document.querySelectorAll('#panel .pcard')]
  .find(x=>/ADA TESTHOLDER/i.test(x.textContent)); if(c)c.click();});
await p.waitForTimeout(600);
out.chat = { doorExists: await p.evaluate(()=>!!document.getElementById('sdChat')),
  soulInDossier: await p.evaluate(()=>/attends to: ATT-0/.test(document.getElementById('panel').textContent)) };
await p.evaluate(()=>document.getElementById('sdChat').click());
await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('chIn').value='why is the water contested?';
  document.getElementById('chSend').click();});
await p.waitForTimeout(1500);
Object.assign(out.chat, await p.evaluate(()=>{
  const txt = document.getElementById('chLog').textContent;
  const soul = window.ICOSA_SOULS.of('F11.1103');
  const enc = window.ICOSA_MEM.all().filter(m=>m.type==='ENCOUNTER');
  return { replied: /CHAT-REPLY to: why is the water contested\?/.test(txt),
    moveShown: /move: joke/.test(txt),
    stampedRehearsal: /rehearsal — written by a model, not by Ada Testholder/.test(txt),
    beliefChanged: soul && soul.mut && soul.mut[0] && soul.mut[0].belief==='B1-CHANGED',
    chargeChanged: soul && soul.mut && soul.mut[0] && soul.mut[0].charge==='amused',
    remembered: enc.length===1 && enc[0].text==='REMEMBER-THIS' && enc[0].seat===0,
    tempWarmed: /the room is playful/.test(document.getElementById('panel').textContent) };
}));
console.log(JSON.stringify(out,null,1));
await b.close();

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
  await p.route('**/en.wikipedia.org/**', r=>r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:'{}'}));
  await p.route('**/api.openai.com/v1/models', r=>r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify({data:[{id:'gpt-5.6-sol'},{id:'gpt-5.6-terra'}]})}));
  await p.route('**/api.openai.com/v1/responses', async r=>{
    const bo=JSON.parse(r.request().postData()||'{}');
    const ctx=JSON.parse(bo.input[0].content[0].text); const op=ctx.operation||{};
    let txt;
    if (op.type==='WRITE_CHARTER') txt=JSON.stringify({charter:'CHARTER-BODY: argued from the ground.',
      opening_question:'OPENING-Q: who holds the water?',
      agenda:(op.topic_points||[]).map(tp=>({topic:tp.id,subject:'SUBJ-'+tp.id,statement:'ST-'+tp.id,
        standing:'QUESTIONED',basis:''})),
      tensions:[{title:'TENSION-A',why_now:'because now'}]});
    else if (op.type==='SPEAK') txt=JSON.stringify({utterances:(op.members||[]).map(m=>({seat:m.seat,
      op:'cite',evidence:['evidence.recent: Local dispute'],
      text:'SPOKE-'+m.seat+' at '+op.topic.place+'.'})),needs:[]});
    else if (op.type==='CRITIQUE') txt=JSON.stringify({utterances:(op.critics||[]).map(m=>({seat:m.seat,
      op:'name-missing',evidence:['evidence.recent'],text:'CRIT-'+m.seat}))});
    else if (op.type==='JUDGE'){
      const seats=[...new Set([...(op.said||[]),...(op.critiques||[])].map(u=>u.seat))];
      txt=JSON.stringify({scores:seats.map(sn=>({seat:sn,admissible:true,grounded:3,register:3,specific:2,engaged:2,
        note:'fine',carry:(op.members||[]).some(m=>m.seat===sn)
          ?{claim:'CARRY',evidence:'EV-'+sn,contradiction:'CONTRA-'+sn}
          :{claim:'',evidence:'',contradiction:''}}))});
    } else if (op.type==='OUTCOME') txt=JSON.stringify({outcomes:(op.topics||[]).map(tp=>({topic:tp.id,
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
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await rig(p);
await p.addInitScript(()=>{try{localStorage.setItem('icosa.openai.key','sk-t');}catch(e){}});
await p.goto(BASE+'/icosa-syntegrity.html#F11.1103'); await p.waitForTimeout(3000);
await p.click('#cellplate'); await p.waitForTimeout(600);
await p.evaluate(()=>{const x=[...document.querySelectorAll('#panel button')].find(y=>/COUNCIL/.test(y.textContent)); if(x)x.click();});
await p.waitForTimeout(4000);
await p.evaluate(()=>document.getElementById('cRun').click());
for (let i=0;i<40;i++){ await p.waitForTimeout(800);
  if (await p.evaluate(()=>([...document.querySelectorAll('#panel p')].some(x=>/things said across/.test(x.textContent))))) break; }
await p.waitForTimeout(500);

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
  fetchFirst: doc.includes('1. FETCH FIRST.'),
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
};
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
console.log(JSON.stringify(out,null,1));
await b.close();

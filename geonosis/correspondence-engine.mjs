import { correspondence } from './v1-schema.mjs';

function num(x){const n=Number(x);return Number.isFinite(n)?n:null;}
function ts(x){const n=Date.parse(x||'');return Number.isFinite(n)?n:null;}
function eq(a,b,tolerance=0){
  const na=num(a),nb=num(b);
  if(na!==null&&nb!==null)return Math.abs(na-nb)<=Number(tolerance||0);
  return JSON.stringify(a)===JSON.stringify(b);
}
function compare(operator,left,right,tolerance=0){
  if(left===undefined||left===null||right===undefined||right===null)return null;
  if(operator==='equal')return eq(left,right,tolerance);
  if(operator==='not_equal')return !eq(left,right,tolerance);
  const a=num(left),b=num(right);if(a===null||b===null)return null;
  if(operator==='lte')return a<=b+Number(tolerance||0);
  if(operator==='gte')return a+Number(tolerance||0)>=b;
  if(operator==='lt')return a<b;
  if(operator==='gt')return a>b;
  throw new Error(`unknown correspondence operator ${operator}`);
}

export function evaluateCorrespondence(rule,input={}){
  if(!rule?.id)throw new Error('correspondence rule requires id');
  const ok=compare(rule.operator||'equal',input.left,input.right,rule.tolerance||0);
  const state=ok===null?'UNKNOWN':ok?'MATCH':'MISMATCH';
  return correspondence({
    regime_a:rule.regime_a,
    regime_b:rule.regime_b,
    subject_or_extent:input.subject_or_extent||rule.subject_or_extent,
    expectation:rule.expectation,
    state,
    evidence:[...(input.left_evidence||[]),...(input.right_evidence||[])],
    explanation:state==='UNKNOWN'
      ? `Cannot evaluate ${rule.expectation}: one or both regime values are unavailable.`
      : state==='MATCH'
        ? `The ${rule.regime_a} and ${rule.regime_b} states satisfy the declared expectation: ${rule.expectation}.`
        : `The ${rule.regime_a} and ${rule.regime_b} states fail the declared expectation: ${rule.expectation}.`,
    temporal_scope:input.temporal_scope||null,
    geographic_scope:input.geographic_scope||null,
    rule_id:rule.id
  });
}

export function evaluateLag(rule,input={}){
  if(!rule?.id)throw new Error('lag rule requires id');
  const start=ts(input.trigger_at),end=ts(input.response_at);
  if(start===null||end===null){
    return correspondence({
      regime_a:rule.regime_a,regime_b:rule.regime_b,
      subject_or_extent:input.subject_or_extent||rule.subject_or_extent,
      expectation:rule.expectation,state:'UNKNOWN',evidence:[...(input.trigger_evidence||[]),...(input.response_evidence||[])],
      explanation:`Cannot evaluate lag for ${rule.expectation}: trigger or response time is unavailable.`,
      temporal_scope:{trigger_at:input.trigger_at||null,response_at:input.response_at||null,lag_minutes:null},
      geographic_scope:input.geographic_scope||null,rule_id:rule.id
    });
  }
  const lagMinutes=(end-start)/60000;
  const threshold=Number(rule.max_lag_minutes??0);
  const state=lagMinutes>threshold?'LAG':'MATCH';
  return correspondence({
    regime_a:rule.regime_a,regime_b:rule.regime_b,
    subject_or_extent:input.subject_or_extent||rule.subject_or_extent,
    expectation:rule.expectation,state,
    evidence:[...(input.trigger_evidence||[]),...(input.response_evidence||[])],
    explanation:state==='LAG'
      ? `${rule.regime_b} recognition followed ${rule.regime_a} evidence by ${lagMinutes.toFixed(1)} minutes, beyond the declared ${threshold}-minute expectation.`
      : `${rule.regime_b} recognition followed ${rule.regime_a} evidence within the declared ${threshold}-minute expectation.`,
    temporal_scope:{trigger_at:input.trigger_at,response_at:input.response_at,lag_minutes:lagMinutes,max_lag_minutes:threshold},
    geographic_scope:input.geographic_scope||null,rule_id:rule.id
  });
}

export function detectContradiction({regime_a,regime_b,subject_or_extent,claim_a,claim_b,evidence=[],geographic_scope=null,rule_id='explicit-claim-contradiction-v1'}){
  const known=claim_a!==undefined&&claim_a!==null&&claim_b!==undefined&&claim_b!==null;
  const state=!known?'UNKNOWN':eq(claim_a,claim_b)?'MATCH':'CONTRADICTION';
  return correspondence({
    regime_a,regime_b,subject_or_extent,
    expectation:'Explicit claims about the same scoped state should not assert incompatible values at the same valid time.',
    state,evidence,
    explanation:state==='UNKNOWN'?'Insufficient claims for contradiction test.':state==='MATCH'?'The claims agree.':`The claims are explicitly incompatible: ${JSON.stringify(claim_a)} versus ${JSON.stringify(claim_b)}.`,
    geographic_scope,rule_id
  });
}

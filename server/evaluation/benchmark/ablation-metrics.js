'use strict';

function numeric(values) { return (values || []).map(Number).filter(Number.isFinite); }
function mean(values) { const xs = numeric(values); return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null; }
function mae(predicted, human) {
  const pairs = (predicted || []).map((p,i)=>[Number(p), Number((human||[])[i])]).filter(([p,h])=>Number.isFinite(p)&&Number.isFinite(h));
  return pairs.length ? mean(pairs.map(([p,h])=>Math.abs(p-h))) : null;
}
function rmse(predicted, human) {
  const pairs = (predicted || []).map((p,i)=>[Number(p), Number((human||[])[i])]).filter(([p,h])=>Number.isFinite(p)&&Number.isFinite(h));
  return pairs.length ? Math.sqrt(mean(pairs.map(([p,h])=>(p-h)**2))) : null;
}
function pearson(x,y) {
  const pairs=(x||[]).map((a,i)=>[Number(a),Number((y||[])[i])]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b));
  if(pairs.length<2)return null; const mx=mean(pairs.map(p=>p[0])),my=mean(pairs.map(p=>p[1]));
  const num=pairs.reduce((s,[a,b])=>s+(a-mx)*(b-my),0), dx=pairs.reduce((s,[a])=>s+(a-mx)**2,0),dy=pairs.reduce((s,[,b])=>s+(b-my)**2,0);
  return dx&&dy ? num/Math.sqrt(dx*dy) : null;
}
function agreementRate(predicted,human,tolerance=5){
  const pairs=(predicted||[]).map((p,i)=>[Number(p),Number((human||[])[i])]).filter(([p,h])=>Number.isFinite(p)&&Number.isFinite(h));
  return pairs.length ? pairs.filter(([p,h])=>Math.abs(p-h)<=tolerance).length/pairs.length : null;
}
function summarizeCondition(result) {
  const rows=result.results||[]; const predicted=rows.map(r=>r.score), human=rows.map(r=>r.humanScore);
  const verification=rows.filter(r=>r.verification?.status);
  return {
    n: rows.length,
    meanScore: mean(predicted),
    mae: mae(predicted,human),
    rmse: rmse(predicted,human),
    pearson: pearson(predicted,human),
    agreementWithin5: agreementRate(predicted,human,5),
    verificationPassRate: verification.length ? verification.filter(r=>r.verification.status==='PASS').length/verification.length : null,
    humanReviewRate: rows.length ? rows.filter(r=>r.requiresHumanReview===true).length/rows.length : null,
    reliabilityMean: mean(rows.map(r=>r.reliability?.overallReliability)),
  };
}
function compareAblation(runs){
  const conditions=(runs||[]).map(run=>({conditionId:run.condition.id,label:run.condition.label,metrics:summarizeCondition(run)}));
  const baseline=conditions.find(c=>c.conditionId==='baseline');
  return {conditions, deltasFromBaseline: baseline ? conditions.filter(c=>c!==baseline).map(c=>({conditionId:c.conditionId,maeDelta:c.metrics.mae==null||baseline.metrics.mae==null?null:c.metrics.mae-baseline.metrics.mae,rmseDelta:c.metrics.rmse==null||baseline.metrics.rmse==null?null:c.metrics.rmse-baseline.metrics.rmse,pearsonDelta:c.metrics.pearson==null||baseline.metrics.pearson==null?null:c.metrics.pearson-baseline.metrics.pearson,agreementWithin5Delta:c.metrics.agreementWithin5==null||baseline.metrics.agreementWithin5==null?null:c.metrics.agreementWithin5-baseline.metrics.agreementWithin5})):[]};
}
module.exports={mean,mae,rmse,pearson,agreementRate,summarizeCondition,compareAblation};

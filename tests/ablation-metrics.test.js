'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {compareAblation}=require('../server/evaluation/benchmark/ablation-metrics');

test('ablation comparison computes condition metrics and baseline deltas',()=>{
 const out=compareAblation([
  {condition:{id:'baseline',label:'Baseline'},results:[{score:60,humanScore:70}]},
  {condition:{id:'full',label:'Full Harness'},results:[{score:68,humanScore:70,verification:{status:'PASS'},reliability:{overallReliability:.9}}]}
 ]);
 assert.equal(out.conditions[0].metrics.mae,10);
 assert.equal(out.conditions[1].metrics.mae,2);
 assert.equal(out.deltasFromBaseline[0].maeDelta,-8);
 assert.equal(out.conditions[1].metrics.verificationPassRate,1);
});

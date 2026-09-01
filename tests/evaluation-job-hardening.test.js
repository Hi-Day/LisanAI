'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');

test('evaluation job migration adds lease and idempotency fields',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../server/migrations/017_evaluation_job_leases.sql'),'utf8');
 assert.match(sql,/idempotency_key/);
 assert.match(sql,/lease_until/);
 assert.match(sql,/heartbeat_at/);
 assert.match(sql,/UNIQUE INDEX/i);
});

test('job service exports production recovery primitives',()=>{
 const service=require('../server/evaluation/evaluation-job-service');
 assert.equal(typeof service.recoverExpiredJobs,'function');
 assert.equal(typeof service.heartbeatEvaluationJob,'function');
 assert.equal(typeof service.enqueueEvaluation,'function');
});

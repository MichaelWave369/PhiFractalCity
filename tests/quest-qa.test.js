import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QA_SCHEMA,QA_TESTS,makeQA,recordQA,recordFrame,setCheck,
  summarizeQA,reportQA,exportQA,MAX_EVENTS,MAX_FRAMES
} from '../src/quest-qa.js';

test('all Quest acceptance checks start untested without claiming device success',()=>{
  const qa=makeQA({now:()=>Date.parse('2026-11-12T00:00:00.000Z')});
  assert.equal(qa.schema,QA_SCHEMA);
  assert.equal(qa.sessions,0);
  assert.equal(qa.active,false);
  assert.equal(QA_TESTS.length,8);
  assert.equal(summarizeQA(qa).counts.untested,8);
  assert.equal(summarizeQA(qa).frame.estimatedFps,null);
});
test('only allowed event names can be recorded and session events update state',()=>{
  const qa=makeQA();
  assert.throws(()=>recordQA(qa,'token:aabb'),/Unknown/);
  assert.throws(()=>recordQA(qa,'http://192.168.0.3'),/Unknown/);
  recordQA(qa,'xr-enter');recordQA(qa,'left-grip');
  assert.equal(qa.sessions,1);
  assert.equal(qa.active,true);
  recordQA(qa,'xr-exit');
  assert.equal(qa.active,false);
  assert.equal(qa.events.length,3);
  assert.ok(qa.events.every(e=>Object.keys(e).sort().join(',')==='code,id,time'));
});
test('frame metrics have bounded buffers and are labeled approximate',()=>{
  const qa=makeQA();
  assert.equal(recordFrame(qa,11.1),false);
  recordQA(qa,'xr-enter');
  for(let i=0;i<300;i++)recordFrame(qa,11.1);
  assert.equal(qa.frameMs.length,MAX_FRAMES);
  assert.equal(recordFrame(qa,NaN),false);
  assert.equal(recordFrame(qa,-10),false);
  const stats=summarizeQA(qa).frame;
  assert.equal(stats.samples,240);
  assert.equal(stats.meanMs,11.1);
  assert.equal(stats.p95Ms,11.1);
  assert.equal(stats.estimatedFps,90);
  assert.match(reportQA(qa).disclaimer,/not.*benchmark/i);
});
test('manual outcomes require a known test ID and fixed status',()=>{
  const qa=makeQA();
  setCheck(qa,'entry','pass');setCheck(qa,'comfort','fail');
  setCheck(qa,'dialogue','skip');
  assert.deepEqual(summarizeQA(qa).counts,{pass:1,fail:1,skip:1,untested:5});
  assert.throws(()=>setCheck(qa,'private-memory','pass'));
  assert.throws(()=>setCheck(qa,'entry','success'));
});
test('the report never includes memory, browser metadata, bridge secret, address or model reply',()=>{
  const qa=makeQA();
  qa.token='dont-share-this-token';
  qa.privateNotes=['HOME SECRET'];
  qa.userAgent='browser-fingerprint';
  qa.bridgeUrl='https://192.168.1.1:8765/v1/chat';
  qa.modelReply='This is a confidential model answer';
  recordQA(qa,'model-attempt');
  // Simulate unexpected status mutation after the legitimate event.
  qa.latestEvent='Secret accidentally injected as a status';
  const text=exportQA(qa);
  for(const secret of [qa.token,qa.privateNotes[0],qa.userAgent,qa.bridgeUrl,qa.modelReply]){
    assert.equal(text.includes(secret),false);
  }
  assert.equal(text.includes(qa.latestEvent),false);
  const exported=JSON.parse(text);
  assert.deepEqual(Object.keys(exported),['schema','startedAt','exportedAt','summary','checklist','events','disclaimer']);
  assert.equal(exported.events[0].code,'model-attempt');
});
test('event retention is bounded without losing aggregate event count',()=>{
  const qa=makeQA();
  for(let i=0;i<MAX_EVENTS+15;i++)recordQA(qa,'controller-select');
  assert.equal(qa.events.length,MAX_EVENTS);
  assert.equal(qa.eventSequence,MAX_EVENTS+15);
  assert.equal(qa.events[0].id,16);
});
test('export rejects tampered diagnostic state and cannot manufacture results',()=>{
  const qa=makeQA();
  qa.checks.entry='verified-on-quest';
  assert.throws(()=>reportQA(qa),/Invalid diagnostics/);
  qa.checks.entry='untested';
  qa.checks.other='pass';
  assert.throws(()=>reportQA(qa),/Invalid diagnostics/);
});

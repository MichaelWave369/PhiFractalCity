/* ΦFractalCity R0.7: no-network Quest field diagnostics.
 * Session-only state and an explicit, redacted report. Never include
 * model text, pairing secrets, network addresses, browser fingerprint data,
 * private memories, proposals, or resident notes.
 */
export const QA_SCHEMA = 'phifractalcity.quest-qa.v1';
export const MAX_EVENTS = 80;
export const MAX_FRAMES = 240;
export const QA_TESTS = Object.freeze([
  Object.freeze({id:'entry',label:'Enter and exit VR',detail:'Verify entry, exit, and returning to the desktop view.'}),
  Object.freeze({id:'pointing',label:'Trigger and controller ray',detail:'Can you point at and select an in-world button?'}),
  Object.freeze({id:'grip',label:'Left grip console toggle',detail:'Hide and reopen the in-world console using left grip.'}),
  Object.freeze({id:'pockets',label:'Recursive pocket travel',detail:'Enter a portal and return without losing orientation.'}),
  Object.freeze({id:'workshop',label:'Workshop review controls',detail:'Browse proposals and exhibits without unintended approval.'}),
  Object.freeze({id:'dialogue',label:'Ori conversation panel',detail:'Select a prompt and see a reply or understandable failure.'}),
  Object.freeze({id:'persistence',label:'Local state across reload',detail:'Check world, habitat and layout after a real reload.'}),
  Object.freeze({id:'comfort',label:'Readability and comfort',detail:'Can you read the panels without eyestrain or discomfort?'})
]);
const IDS = new Set(QA_TESTS.map(x=>x.id));
const STATUSES = new Set(['untested','pass','fail','skip']);
const EVENTS = new Set([
  'xr-enter','xr-exit','controller-select','left-grip','console-open','console-close',
  'pocket-travel','panel-action','model-attempt','model-success','model-error',
  'storage-test-success','storage-test-fail',
  'teleport-aim','teleport-move','snap-turn'
]);
const isFrame = x=>Number.isFinite(x)&&x>0&&x<=2000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const boundedTime = time=>typeof time==='string'&&ISO.test(time)&&time.length<=40;
function timeFrom(now){return new Date(now).toISOString();}
export function makeQA({now=Date.now}={}){
  const startedAt=timeFrom(now());
  return {
    schema:QA_SCHEMA,
    startedAt,
    sessions:0,
    active:false,
    eventSequence:0,
    events:[],
    frameMs:[],
    checks:Object.fromEntries(QA_TESTS.map(t=>[t.id,'untested'])),
    latestEvent:'none'
  };
}
export function recordQA(qa,code,{now=Date.now}={}){
  if(!EVENTS.has(code))throw new Error('Unknown diagnostics event');
  // No arbitrary event payload, strings, data addresses, or browser metadata.
  qa.eventSequence++;
  const entry={id:qa.eventSequence,code,time:timeFrom(now())};
  qa.events.push(entry);
  if(qa.events.length>MAX_EVENTS)qa.events.shift();
  qa.latestEvent=code;
  if(code==='xr-enter'){qa.active=true;qa.sessions++;qa.frameMs=[];}
  if(code==='xr-exit')qa.active=false;
  return entry;
}
export function recordFrame(qa,deltaMs){
  if(!qa.active||!isFrame(deltaMs))return false;
  qa.frameMs.push(Math.round(deltaMs*10)/10);
  if(qa.frameMs.length>MAX_FRAMES)qa.frameMs.shift();
  return true;
}
export function setCheck(qa,id,status){
  if(!IDS.has(id)||!STATUSES.has(status))throw new Error('Unknown diagnostics test or outcome');
  qa.checks[id]=status;
  return status;
}
export function summarizeQA(qa){
  const checks=QA_TESTS.map(x=>qa.checks[x.id]);
  const counts={pass:0,fail:0,skip:0,untested:0};
  for(const check of checks)counts[check]++;
  const frames=qa.frameMs.filter(isFrame);
  const sorted=[...frames].sort((a,b)=>a-b);
  const average=frames.length?frames.reduce((a,b)=>a+b,0)/frames.length:null;
  return {
    sessions:qa.sessions,
    active:qa.active,
    eventCount:qa.eventSequence,
    latestEvent:EVENTS.has(qa.latestEvent)?qa.latestEvent:'none',
    counts,
    frame:{
      samples:frames.length,
      meanMs:average===null?null:Math.round(average*10)/10,
      p95Ms:frames.length?sorted[Math.ceil(frames.length*.95)-1]:null,
      estimatedFps:average?Math.round(1000/average):null
    }
  };
}
export function reportQA(qa,{now=Date.now}={}){
  if(qa?.schema!==QA_SCHEMA || !boundedTime(qa.startedAt) ||
     !Number.isSafeInteger(qa.sessions)||qa.sessions<0||
     !Number.isSafeInteger(qa.eventSequence)||qa.eventSequence<0||
     !Array.isArray(qa.events)||qa.events.length>MAX_EVENTS||
     !Array.isArray(qa.frameMs)||qa.frameMs.length>MAX_FRAMES||
     !qa.checks||Object.keys(qa.checks).sort().join(',')!==[...IDS].sort().join(',')) {
    throw new Error('Invalid diagnostics state');
  }
  for(const [id,value] of Object.entries(qa.checks)){
    if(!IDS.has(id)||!STATUSES.has(value))throw new Error('Invalid diagnostics test outcome');
  }
  // Allowlist serialization: do NOT stringify arbitrary browser state or the original qa object.
  return {
    schema:QA_SCHEMA,startedAt:qa.startedAt,exportedAt:timeFrom(now()),
    summary:summarizeQA(qa),
    checklist:QA_TESTS.map(x=>({id:x.id,result:qa.checks[x.id]})),
    events:qa.events.filter(e=>EVENTS.has(e.code)&&Number.isSafeInteger(e.id)&&boundedTime(e.time))
      .map(e=>({id:e.id,code:e.code,time:e.time})),
    disclaimer:'Manual field test, not a certified Quest benchmark. Estimated FPS is based on JavaScript frame intervals, not headset compositor measurements. No data uploaded.'
  };
}
export function exportQA(qa,opts){
  return JSON.stringify(reportQA(qa,opts),null,2);
}

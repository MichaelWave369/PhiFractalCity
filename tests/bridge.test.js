import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createBridgeHandler, bridgeConfig, validPrivateBind, validOrigin, validateBridgeBody,
  makeRateGate, OLLAMA, DEFAULT_ORIGIN
} from '../bridge/server.js';

const KEY='a'.repeat(64);
const HEADERS={
  Origin:DEFAULT_ORIGIN,
  Authorization:'Bearer '+KEY,
  'Content-Type':'application/json'
};
const sample={
  model:'qwen3:4b',
  prompt:'What could we build?',
  context:{pocket:'0/3',publicNotes:['An open garden exists.'],publishedConcepts:[]}
};

async function withServer(handler,run) {
  const server=http.createServer(handler); // In-process test transport only; executable uses HTTPS.
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  const url='http://127.0.0.1:'+address.port+'/v1/chat';
  try{return await run(url);}finally{await new Promise(resolve=>server.close(resolve));}
}
function response(){return {ok:true,body:null,text:async()=>JSON.stringify({message:{content:'Propose a shared garden.'}})};}

test('bridge binds only explicit private or loopback addresses',()=>{
  assert.equal(validPrivateBind('127.0.0.1'),true);
  assert.equal(validPrivateBind('192.168.1.17'),true);
  assert.equal(validPrivateBind('10.0.0.1'),true);
  assert.equal(validPrivateBind('172.16.0.1'),true);
  assert.equal(validPrivateBind('172.31.254.254'),true);
  assert.equal(validPrivateBind('172.32.0.1'),false);
  assert.equal(validPrivateBind('8.8.8.8'),false);
  assert.equal(validPrivateBind('0.0.0.0'),false);
  assert.equal(validPrivateBind('example.com'),false);
  assert.equal(validOrigin(DEFAULT_ORIGIN),true);
  assert.equal(validOrigin('https://evil.example/path'),false);
  assert.equal(validOrigin('https://foo.com,https://bar.com'),false);
});
test('startup fails closed without TLS files or a secure pair token',()=>{
  assert.throws(()=>bridgeConfig({PHI_BRIDGE_BIND:'0.0.0.0',PHI_BRIDGE_TLS_CERT:'x',PHI_BRIDGE_TLS_KEY:'y'}));
  assert.throws(()=>bridgeConfig({PHI_BRIDGE_BIND:'127.0.0.1'}));
  assert.throws(()=>bridgeConfig({PHI_BRIDGE_BIND:'127.0.0.1',PHI_BRIDGE_TLS_CERT:'x',PHI_BRIDGE_TLS_KEY:'y',PHI_BRIDGE_TOKEN:'weak'}));
  const cfg=bridgeConfig({PHI_BRIDGE_BIND:'127.0.0.1',PHI_BRIDGE_TLS_CERT:'cert',PHI_BRIDGE_TLS_KEY:'key'});
  assert.match(cfg.token,/^[0-9a-f]{64}$/);
});
test('restricted body rejects extra fields and invalid contexts',()=>{
  const req=validateBridgeBody(sample);
  assert.equal(req.stream,false);
  assert.equal(req.messages[0].role,'system');
  assert.ok(!JSON.stringify(req).includes('"tools"'));
  assert.throws(()=>validateBridgeBody({...sample,tools:[{type:'function'}]}));
  assert.throws(()=>validateBridgeBody({...sample,context:{...sample.context,privateNotes:['SECRET']}}));
  assert.throws(()=>validateBridgeBody({...sample,context:{...sample.context,publicNotes:['x'.repeat(241)]}}));
  assert.throws(()=>validateBridgeBody({...sample,prompt:'x'.repeat(501)}));
});
test('only paired, exact-origin requests reach fixed loopback Ollama',async()=>{
  let calls=0,urlSeen,post;
  const handler=createBridgeHandler({
    token:KEY,
    fetcher:async (url,options)=>{calls++;urlSeen=url;post=options;return response();}
  });
  await withServer(handler,async url=>{
    let res=await fetch(url,{method:'POST',headers:{...HEADERS,Origin:'https://evil.example'},body:JSON.stringify(sample)});
    assert.equal(res.status,403);
    res=await fetch(url,{method:'POST',headers:{...HEADERS,Authorization:'Bearer '+('b'.repeat(64))},body:JSON.stringify(sample)});
    assert.equal(res.status,401);
    res=await fetch(url,{method:'POST',headers:HEADERS,body:JSON.stringify(sample)});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('access-control-allow-origin'),DEFAULT_ORIGIN);
    const body=await res.json();
    assert.equal(body.endpoint,'paired-bridge-v1');
    assert.equal(body.text,'Propose a shared garden.');
  });
  assert.equal(calls,1);
  assert.equal(urlSeen,OLLAMA);
  assert.equal(post.method,'POST');
  assert.equal(post.redirect,'error');
  assert.equal(JSON.parse(post.body).model,'qwen3:4b');
  assert.equal(JSON.parse(post.body).tools,undefined);
});
test('preflight only advertises exact origin, method and headers',async()=>{
  const handler=createBridgeHandler({token:KEY,fetcher:async()=>response()});
  await withServer(handler,async url=>{
    const valid=await fetch(url,{method:'OPTIONS',headers:{Origin:DEFAULT_ORIGIN}});
    assert.equal(valid.status,204);
    assert.equal(valid.headers.get('access-control-allow-origin'),DEFAULT_ORIGIN);
    assert.equal(valid.headers.get('access-control-allow-methods'),'POST, OPTIONS');
    assert.match(valid.headers.get('access-control-allow-headers'),/authorization/);
    const invalid=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://other.example'}});
    assert.equal(invalid.status,403);
  });
});
test('fixed route and forbidden methods are rejected',async()=>{
  const handler=createBridgeHandler({token:KEY,fetcher:async()=>response()});
  await withServer(handler,async url=>{
    assert.equal((await fetch(url,{method:'GET',headers:{Origin:DEFAULT_ORIGIN}})).status,405);
    assert.equal((await fetch(url.replace('/v1/chat','/api/tags'),{headers:{Origin:DEFAULT_ORIGIN}})).status,404);
    const malformed=await fetch(url,{method:'POST',headers:HEADERS,body:'{'});
    assert.equal(malformed.status,400);
  });
});
test('rate gate rejects bursts and recovers after the cooldown',()=>{
  let now=10000;
  const take=makeRateGate({now:()=>now,intervalMs:1500,limit:2,windowMs:60000});
  assert.equal(take(),true);
  assert.equal(take(),false);
  now+=1500;assert.equal(take(),true);
  now+=1500;assert.equal(take(),false);
  now+=60000;assert.equal(take(),true);
});

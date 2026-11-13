/* ΦFractalCity R0.5: opt-in HTTPS LAN bridge.
 * This is an explicitly launched operator service, NOT a cloud backend.
 * No endpoints besides authenticated /v1/chat and CORS preflight.
 * Ollama always stays on http://127.0.0.1:11434.
 */
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { makeRequest, parseModelReply, validateModelName } from '../src/inference.js';

export const PORT = 8765;
export const OLLAMA = 'http://127.0.0.1:11434/api/chat';
export const DEFAULT_ORIGIN = 'https://michaelwave369.github.io';
export const MAX_BODY_BYTES = 4096;
export const MAX_RESPONSE_BYTES = 120000;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const ADDRESS_RE = /^0(?:\/[0-8]){0,8}$/;

export function validPrivateBind(host) {
  if (host === '127.0.0.1') return true;
  if (typeof host !== 'string' || isIP(host) !== 4) return false;
  const [a,b] = host.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
export function validOrigin(origin) {
  if (typeof origin !== 'string' || !origin || origin.includes(',') || origin.includes(' ')) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin &&
      (parsed.protocol === 'https:' ||
       (parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname)));
  } catch { return false; }
}
function constantTokenMatch(given, expected) {
  if (typeof given !== 'string' || !TOKEN_RE.test(given) || !TOKEN_RE.test(expected)) return false;
  return timingSafeEqual(Buffer.from(given,'hex'),Buffer.from(expected,'hex'));
}
function boundedContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context) ||
      Object.keys(context).sort().join(',') !== 'pocket,publicNotes,publishedConcepts' ||
      !ADDRESS_RE.test(context.pocket)) throw new Error('Context rejected');
  for (const key of ['publicNotes','publishedConcepts']) {
    const notes=context[key];
    if(!Array.isArray(notes)||notes.length>4 ||
       notes.some(t=>typeof t!=='string'||t.length>240)) throw new Error('Public context rejected');
  }
  return {
    pocket:context.pocket,publicNotes:[...context.publicNotes],publishedConcepts:[...context.publishedConcepts]
  };
}
export function validateBridgeBody(body) {
  if(!body || typeof body !== 'object' || Array.isArray(body) ||
     Object.keys(body).sort().join(',') !== 'context,model,prompt') throw new Error('Unexpected request fields');
  if (typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>500) throw new Error('Question rejected');
  validateModelName(body.model);
  const context=boundedContext(body.context);
  // Reuse the exact model request policy from the city client; no tool calls.
  return makeRequest({prompt:body.prompt,model:body.model,context});
}

export function makeRateGate({ now = Date.now, intervalMs = 1500, limit = 15, windowMs = 60000 } = {}) {
  let last = -Infinity;
  let bucket = [];
  return () => {
    const current=now();
    bucket=bucket.filter(t=>current-t<windowMs);
    if(current-last<intervalMs || bucket.length>=limit) return false;
    last=current;bucket.push(current);return true;
  };
}

function respond(res,status,body,extra={}) {
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    ...extra
  });
  res.end(JSON.stringify(body));
}
function readBoundedJSON(req) {
  return new Promise((resolve,reject)=>{
    let bytes=0,chunks=[],failed=false;
    req.on('data',chunk=>{
      if(failed)return;
      bytes+=chunk.length;
      if(bytes>MAX_BODY_BYTES){
        failed=true;reject(new Error('Body too large'));
        req.resume();return;
      }
      chunks.push(chunk);
    });
    req.on('end',()=>{
      if(failed)return;
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
      catch{reject(new Error('Invalid JSON'));}
    });
    req.on('error',reject);
  });
}
async function boundedUpstreamBody(response) {
  if(!response.body) return await response.text();
  const chunks=[];
  let n=0;
  for await(const chunk of response.body){
    const value=Buffer.from(chunk);
    n+=value.length;
    if(n>MAX_RESPONSE_BYTES) throw new Error('Upstream response too large');
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function createBridgeHandler({
  token, allowedOrigin = DEFAULT_ORIGIN,
  fetcher = globalThis.fetch, now = Date.now, rateGate = makeRateGate({now}),
  timeoutMs=30000
} = {}) {
  if(!TOKEN_RE.test(token)) throw new Error('Bridge token must be 64 lowercase hex digits');
  if(!validOrigin(allowedOrigin)) throw new Error('Invalid allowed browser origin');
  if(typeof fetcher!=='function') throw new Error('fetch unavailable');
  let busy = false;
  return async (req,res) => {
    const origin=req.headers.origin;
    if(origin!==allowedOrigin){
      respond(res,403,{error:'Origin not allowed'});return;
    }
    const cors={
      'Access-Control-Allow-Origin':allowedOrigin,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'authorization, content-type',
      'Access-Control-Max-Age':'600',
      'Vary':'Origin'
    };
    if(req.url!=='/v1/chat'){
      respond(res,404,{error:'Not found'},cors);return;
    }
    if(req.method==='OPTIONS'){
      respond(res,204,{},cors);return;
    }
    if(req.method!=='POST'){
      respond(res,405,{error:'Method not allowed'},{...cors,Allow:'POST, OPTIONS'});return;
    }
    if(!constantTokenMatch(req.headers.authorization?.replace(/^Bearer /,'')??'',token)){
      respond(res,401,{error:'Invalid pairing token'},cors);return;
    }
    if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json'){
      respond(res,415,{error:'JSON required'},cors);return;
    }
    if(busy || !rateGate()){
      respond(res,429,{error:'Bridge busy or request rate exceeded'},cors);return;
    }
    busy=true;
    try {
      const body=await readBoundedJSON(req);
      const payload=validateBridgeBody(body);
      const abort=new AbortController();
      const timer=setTimeout(()=>abort.abort(),Math.max(1000,Math.min(timeoutMs,45000)));
      let response;
      try {
        response=await fetcher(OLLAMA,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload),
          signal:abort.signal,redirect:'error'
        });
        if(!response.ok) throw new Error('Ollama unavailable');
        const raw=await boundedUpstreamBody(response);
        const answer=parseModelReply(JSON.parse(raw));
        respond(res,200,{
          kind:'model-generated',endpoint:'paired-bridge-v1',
          model:payload.model,text:answer,
          receivedAt:new Date().toISOString()
        },cors);
      } finally {clearTimeout(timer);}
    } catch(error) {
      const tooLarge=error.message==='Body too large';
      const rejected=/rejected|Unexpected|Question|Context|Model ID|Invalid JSON|request fields|Invalid public/i.test(error.message);
      respond(res,tooLarge?413:rejected?400:503,
        {error:tooLarge?'Request too large':rejected?'Request validation failed':'Local inference unavailable'},cors);
    } finally {busy=false;}
  };
}

export function bridgeConfig(env) {
  const bind=env.PHI_BRIDGE_BIND;
  const certificate=env.PHI_BRIDGE_TLS_CERT;
  const key=env.PHI_BRIDGE_TLS_KEY;
  const origin=env.PHI_BRIDGE_ALLOWED_ORIGIN||DEFAULT_ORIGIN;
  if(!validPrivateBind(bind))throw new Error('Set PHI_BRIDGE_BIND to an explicit private or 127.0.0.1 IPv4 address');
  if(!certificate||!key)throw new Error('Set PHI_BRIDGE_TLS_CERT and PHI_BRIDGE_TLS_KEY file paths');
  if(!validOrigin(origin))throw new Error('PHI_BRIDGE_ALLOWED_ORIGIN must be a single exact HTTPS origin, or local HTTP dev origin');
  const token=env.PHI_BRIDGE_TOKEN||randomBytes(32).toString('hex');
  if(!TOKEN_RE.test(token))throw new Error('PHI_BRIDGE_TOKEN must contain 64 lowercase hex digits');
  return {bind,certificate,key,origin,token};
}
export function startBridge(env=process.env) {
  const cfg=bridgeConfig(env);
  const server=https.createServer({
    cert:readFileSync(cfg.certificate),key:readFileSync(cfg.key),
    minVersion:'TLSv1.2'
  },createBridgeHandler({token:cfg.token,allowedOrigin:cfg.origin}));
  server.requestTimeout=12000;
  server.headersTimeout=10000;
  server.maxRequestsPerSocket=40;
  server.listen(PORT,cfg.bind,()=>{
    console.log('ΦFractalCity Bridge R0.5 · experimental, operator-started');
    console.log('Listening at https://'+cfg.bind+':'+PORT+'/v1/chat');
    console.log('Allowed browser origin: '+cfg.origin);
    console.log('Pairing token (enter in client, never share): '+cfg.token);
    console.log('No automatic model requests; Ctrl+C stops the bridge.');
  });
  return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{startBridge();}
  catch(e){console.error('Bridge startup refused:',e.message);process.exitCode=1;}
}

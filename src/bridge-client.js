/* R0.5: explicitly paired HTTPS LAN client.
 * The pairing secret lives only in the current page's DOM memory; never localStorage.
 * Only explicitly designated LAN/loopback HTTPS endpoints are accepted.
 */
import { DEFAULT_LOCAL_MODEL, makeRequest, MAX_REPLY, validateModelName } from './inference.js';

export const BRIDGE_PORT='8765';
export const BRIDGE_PATH='/v1/chat';
const TOKEN_RE=/^[a-f0-9]{64}$/;

export function validateBridgeEndpoint(value) {
  if(typeof value!=='string'||value.length>200)throw new Error('Bridge URL required');
  let url;
  try{url=new URL(value);}catch{throw new Error('Invalid bridge URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
     url.pathname!==BRIDGE_PATH||url.port!==BRIDGE_PORT){
    throw new Error('Use an HTTPS local bridge URL on port 8765 ending in /v1/chat');
  }
  const host=url.hostname.toLowerCase();
  const localName=host==='localhost'||host.endsWith('.local');
  const ip=host.split('.');
  let privateIP=false;
  if(ip.length===4 && ip.every(x=>/^\d{1,3}$/.test(x)&&+x>=0&&+x<=255)){
    const [a,b]=ip.map(Number);
    privateIP=a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
  }
  if(!localName&&!privateIP)throw new Error('Bridge URL must target a private LAN or loopback host');
  return url.href;
}
export function validatePairingToken(value) {
  if(typeof value!=='string'||!TOKEN_RE.test(value))throw new Error('Enter the 64-character bridge pairing token');
  return value;
}
export function parseBridgeResult(value,model) {
  if(!value||typeof value!=='object'||Array.isArray(value)||value.kind!=='model-generated'||
      value.endpoint!=='paired-bridge-v1'||value.model!==model||
      typeof value.text!=='string'||!value.text.trim()||value.text.length>MAX_REPLY){
    throw new Error('Invalid paired bridge response');
  }
  return {
    kind:'model-generated',endpoint:'paired-bridge-v1',
    model:value.model,text:value.text,receivedAt:new Date().toISOString()
  };
}
export async function askPairedBridge({
  prompt,model=DEFAULT_LOCAL_MODEL,context,endpoint,token,fetcher=globalThis.fetch,timeoutMs=35000
}) {
  const url=validateBridgeEndpoint(endpoint);
  const key=validatePairingToken(token);
  validateModelName(model);
  // Validates questions & public context before any network call.
  makeRequest({prompt,model,context});
  if(typeof fetcher!=='function')throw new Error('Browser fetch unavailable');
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),Math.max(1000,Math.min(45000,timeoutMs)));
  try{
    const response=await fetcher(url,{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+key
      },
      body:JSON.stringify({model,prompt,context}),
      signal:abort.signal
    });
    if(!response?.ok){
      let code=response?.status??'unavailable';
      throw new Error('Paired bridge rejected request ('+code+'). Check token, origin and server status.');
    }
    const body=await response.text();
    if(body.length>2500)throw new Error('Oversized bridge response');
    return parseBridgeResult(JSON.parse(body),model);
  }catch(error){
    if(abort.signal.aborted)throw new Error('Paired bridge request timed out');
    if(error instanceof TypeError){
      throw new Error('Cannot reach HTTPS bridge. Check certificate trust, Quest local-network permission, LAN/Wi-Fi, and allowed origin.');
    }
    throw error;
  }finally{clearTimeout(timer);}
}

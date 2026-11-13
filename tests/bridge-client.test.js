import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, addMemory } from '../src/world.js';
import { makeHabitat, addPrivateNote, proposeCreation } from '../src/habitat.js';
import { makePublicContext } from '../src/inference.js';
import {
  validateBridgeEndpoint, validatePairingToken, parseBridgeResult,
  askPairedBridge
} from '../src/bridge-client.js';

const GOOD='https://192.168.1.15:8765/v1/chat';
const TOKEN='b'.repeat(64);
test('HTTPS paired URL is limited to private targets on the fixed route',()=>{
  for(const url of [GOOD,'https://10.0.0.5:8765/v1/chat',
    'https://172.19.1.2:8765/v1/chat','https://phibridge.local:8765/v1/chat',
    'https://localhost:8765/v1/chat']){
    assert.equal(validateBridgeEndpoint(url),url);
  }
  for(const url of ['http://192.168.1.15:8765/v1/chat',
    'https://public.example:8765/v1/chat',
    'https://8.8.8.8:8765/v1/chat',
    'https://172.35.0.1:8765/v1/chat',
    'https://192.168.1.15:443/v1/chat',
    'https://192.168.1.15:8765/api/chat',
    'https://foo@192.168.1.15:8765/v1/chat',
    'https://192.168.1.15:8765/v1/chat?token=x']){
    assert.throws(()=>validateBridgeEndpoint(url),url);
  }
});
test('pairing token is exactly 32 random bytes expressed as 64 lowercase hex',()=>{
  assert.equal(validatePairingToken(TOKEN),TOKEN);
  assert.throws(()=>validatePairingToken('weak'));
  assert.throws(()=>validatePairingToken('A'.repeat(64)));
});
test('bridge request sends only public pocket context and current user prompt',async()=>{
  const world=makeWorld();addMemory(world,'Public note');addMemory(world,'Outside pocket',{address:'0/2'});
  const habitat=makeHabitat();
  addPrivateNote(habitat,'HOME VAULT SECRET');
  proposeCreation(habitat,'PENDING DRAFT SECRET');
  let sent;
  const result=await askPairedBridge({
    prompt:'How can we improve the plaza?',model:'qwen3:4b',
    context:makePublicContext(world,habitat),endpoint:GOOD,token:TOKEN,
    fetcher:async(url,opts)=>{
      sent={url,opts};
      return {ok:true,text:async()=>JSON.stringify({
        kind:'model-generated',endpoint:'paired-bridge-v1',
        model:'qwen3:4b',text:'Maybe add a small public garden.'
      })};
    }
  });
  assert.equal(sent.url,GOOD);
  assert.equal(sent.opts.headers.Authorization,'Bearer '+TOKEN);
  assert.equal(sent.opts.credentials,'omit');
  assert.equal(result.endpoint,'paired-bridge-v1');
  assert.equal(result.model,'qwen3:4b');
  assert.equal(result.text,'Maybe add a small public garden.');
  assert.ok(!sent.opts.body.includes('HOME VAULT SECRET'));
  assert.ok(!sent.opts.body.includes('PENDING DRAFT SECRET'));
  assert.ok(!sent.opts.body.includes('Outside pocket'));
});
test('endpoint and token validation happens before fetch',async()=>{
  let requests=0;
  const fetcher=async()=>{requests++;throw Error('Must not fetch');};
  const context=makePublicContext(makeWorld(),makeHabitat());
  await assert.rejects(()=>askPairedBridge({
    prompt:'hi',model:'qwen3:4b',context,endpoint:'https://example.com:8765/v1/chat',token:TOKEN,fetcher
  }));
  await assert.rejects(()=>askPairedBridge({
    prompt:'hi',model:'qwen3:4b',context,endpoint:GOOD,token:'wrong',fetcher
  }));
  assert.equal(requests,0);
});
test('malformed and incorrect model replies are never published as valid',()=>{
  assert.throws(()=>parseBridgeResult({kind:'model-generated',endpoint:'paired-bridge-v1',model:'bad',text:'a'},'qwen3:4b'));
  assert.throws(()=>parseBridgeResult({kind:'model-generated',endpoint:'unexpected',model:'qwen3:4b',text:'a'},'qwen3:4b'));
  assert.throws(()=>parseBridgeResult({kind:'model-generated',endpoint:'paired-bridge-v1',model:'qwen3:4b',text:'x'.repeat(901)},'qwen3:4b'));
});

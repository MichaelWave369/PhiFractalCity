import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, addMemory } from '../src/world.js';
import { makeHabitat, addPrivateNote, proposeCreation } from '../src/habitat.js';
import {
  LOCAL_OLLAMA_URL, DEFAULT_LOCAL_MODEL, validateModelName,
  makePublicContext, makeRequest, parseModelReply, askLocalModel
} from '../src/inference.js';

test('local request never reads private vault, drafts or unrelated pocket notes', () => {
  const world = makeWorld();
  addMemory(world, 'Public skyline observation');
  addMemory(world, 'Unrelated pocket memory', {address:'0/1'});
  const habitat = makeHabitat();
  addPrivateNote(habitat, 'SECRET ORI HOME VAULT');
  proposeCreation(habitat,'DO NOT SEND DRAFT PROPOSAL');
  const context = makePublicContext(world, habitat);
  const payload = JSON.stringify(makeRequest({prompt:'Describe this pocket.',context}));
  assert.ok(payload.includes('Public skyline observation'));
  assert.ok(!payload.includes('Unrelated pocket memory'));
  assert.ok(!payload.includes('SECRET ORI HOME VAULT'));
  assert.ok(!payload.includes('DO NOT SEND DRAFT PROPOSAL'));
});
test('model IDs and prompts are bounded and cannot direct network endpoint', () => {
  assert.equal(validateModelName('qwen3:4b'),'qwen3:4b');
  assert.throws(() => validateModelName('https://example.com/steal?secret=1'));
  assert.throws(() => validateModelName('../bad'));
  const context = makePublicContext(makeWorld(), makeHabitat());
  assert.throws(() => makeRequest({prompt:'',context}));
  assert.throws(() => makeRequest({prompt:'a'.repeat(501),context}));
  const req = makeRequest({prompt:'hi',context});
  assert.equal(req.model,DEFAULT_LOCAL_MODEL);
  assert.equal(req.stream,false);
  assert.equal(req.messages.length,2);
});
test('adapter only fetches fixed loopback and returns labeled, clipped model text', async () => {
  let sent;
  const output = await askLocalModel({
    prompt:'Suggest a garden',model:'gemma3:12b',context:makePublicContext(makeWorld(),makeHabitat()),
    fetcher:async (url, options) => {
      sent={url,options};
      return {ok:true,text:async()=>JSON.stringify({message:{content:'Idea: '+'a'.repeat(1000)}})};
    }
  });
  assert.equal(sent.url,LOCAL_OLLAMA_URL);
  assert.equal(sent.options.method,'POST');
  assert.equal(sent.options.credentials,'omit');
  assert.equal(sent.options.redirect,'error');
  assert.equal(JSON.parse(sent.options.body).model,'gemma3:12b');
  assert.equal(output.kind,'model-generated');
  assert.equal(output.endpoint,'ollama-local-v1');
  assert.equal(output.text.length,900);
});
test('malformed results and network problems fail closed', async () => {
  assert.throws(() => parseModelReply({message:{content:''}}));
  await assert.rejects(() => askLocalModel({
    prompt:'Hello', context:makePublicContext(makeWorld(),makeHabitat()),
    fetcher:async()=>({ok:false,status:403})
  }),/403/);
  await assert.rejects(() => askLocalModel({
    prompt:'Hello', context:makePublicContext(makeWorld(),makeHabitat()),
    fetcher:async()=>{throw new TypeError('Network broken');}
  }),/CORS/);
});

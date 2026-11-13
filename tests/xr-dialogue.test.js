import test from 'node:test';
import assert from 'node:assert/strict';
import { XR_PROMPTS,promptByIndex,paginateResponse,dialogueView } from '../src/xr-dialogue.js';
import { makeWorld,addMemory } from '../src/world.js';
import { makeHabitat,addPrivateNote,proposeCreation } from '../src/habitat.js';
import { makePublicContext,makeRequest } from '../src/inference.js';

test('four immutable, bounded, safe VR prompts are available',()=>{
  assert.equal(XR_PROMPTS.length,4);
  assert.equal(promptByIndex(0).id,'welcome');
  assert.equal(promptByIndex(4).id,'welcome');
  assert.equal(promptByIndex(-1).id,'workshop');
  assert.throws(()=>promptByIndex(NaN));
  for(const prompt of XR_PROMPTS){
    assert.ok(prompt.question.length>0&&prompt.question.length<=500);
    assert.ok(Object.isFrozen(prompt));
    assert.match(prompt.question,/Ori/);
  }
  assert.ok(Object.isFrozen(XR_PROMPTS));
});
test('responses paginate within a readable limit without losing words',()=>{
  const text='Pattern '.repeat(90);
  const pages=paginateResponse(text);
  assert.ok(pages.length>2);
  assert.ok(pages.every(p=>p.length<=175));
  assert.equal(pages.join(' '),text.trim().replace(/\s+/g,' '));
  assert.equal(dialogueView({text,model:'qwen3:4b',address:'0/3'},pages.length+1).index,1);
  assert.equal(dialogueView(null).total,0);
});
test('dialogue remains bounded against adversarially long or malformed answers',()=>{
  assert.equal(paginateResponse('x'.repeat(2000)).join('').length,900);
  assert.throws(()=>paginateResponse(null));
  assert.throws(()=>paginateResponse('hello',12));
  assert.equal(paginateResponse(' \n ').length,0);
});
test('VR request context deliberately excludes private notes and workshop drafts',()=>{
  const world=makeWorld(),habitat=makeHabitat();
  addMemory(world,'PUBLIC POCKET MARKER');
  addPrivateNote(habitat,'PRIVATE ORI HOME');
  proposeCreation(habitat,'UNAPPROVED DRAFT');
  const body=makeRequest({prompt:promptByIndex(2).question,context:makePublicContext(world,habitat)});
  const serialized=JSON.stringify(body);
  assert.ok(serialized.includes('PUBLIC POCKET MARKER'));
  assert.ok(!serialized.includes('PRIVATE ORI HOME'));
  assert.ok(!serialized.includes('UNAPPROVED DRAFT'));
});

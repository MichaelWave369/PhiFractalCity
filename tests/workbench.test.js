import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHabitat, proposeCreation, reviewProposal } from '../src/habitat.js';
import {
  WORKBENCH_KEY, makeWorkbench, assertWorkbench, placeConcept,
  moveConcept, turnConcept, removeConcept, exportWorkbench, parseWorkbench,
  loadWorkbench, saveWorkbench, MAX_PLACEMENTS
} from '../src/workbench.js';

function approved() {
  const habitat=makeHabitat();
  const proposal=proposeCreation(habitat,'Build a concept sculpture.',{kind:'sculpture'});
  const artifact=reviewProposal(habitat,proposal.id,'approve');
  return {habitat,artifact};
}
test('only approved concepts in the right pocket can be placed',()=>{
  const habitat=makeHabitat(),bench=makeWorkbench();
  const pending=proposeCreation(habitat,'Not approved yet.');
  assert.throws(()=>placeConcept(bench,habitat,'a999','0'),/approved/i);
  assert.equal(pending.status,'pending');
  const {habitat:h,artifact}=approved();
  assert.throws(()=>placeConcept(bench,h,artifact.id,'0/3'),/another pocket/);
  const item=placeConcept(bench,h,artifact.id,'0');
  assert.equal(item.address,'0');
  assert.equal(bench.placements.length,1);
});
test('placements move one step, rotate in eighth-turns and roundtrip',()=>{
  const {habitat,artifact}=approved();
  const bench=makeWorkbench();
  const entry=placeConcept(bench,habitat,artifact.id,'0');
  assert.equal(entry.x,8);
  assert.equal(entry.z,7);
  moveConcept(bench,entry.id,1,0);
  turnConcept(bench,entry.id,1);
  assert.equal(entry.x,9);
  assert.equal(entry.yaw,1);
  assert.deepEqual(parseWorkbench(exportWorkbench(bench)),bench);
  for(let n=0;n<7;n++)turnConcept(bench,entry.id);
  assert.equal(entry.yaw,0);
  assert.throws(()=>moveConcept(bench,entry.id,2,0));
  assert.throws(()=>turnConcept(bench,entry.id,0));
});
test('layout rejects tampering, duplicate IDs and dangerous coordinates',()=>{
  const {habitat,artifact}=approved(),bench=makeWorkbench();
  const item=placeConcept(bench,habitat,artifact.id,'0');
  const forged=JSON.parse(exportWorkbench(bench));
  forged.placements[0].x=123456;
  assert.throws(()=>parseWorkbench(JSON.stringify(forged)));
  const repeated=JSON.parse(exportWorkbench(bench));
  repeated.placements.push({...repeated.placements[0]});
  assert.throws(()=>assertWorkbench(repeated),/Invalid workbench placement/);
  assert.throws(()=>parseWorkbench('{broken'));
  assert.throws(()=>parseWorkbench('x'.repeat(60001)));
  assert.equal(removeConcept(bench,item.id).id,item.id);
  assert.equal(bench.placements.length,0);
});
test('workbench capacity stops rather than silently losing a concept',()=>{
  const {habitat,artifact}=approved(),bench=makeWorkbench();
  for(let i=0;i<MAX_PLACEMENTS;i++)placeConcept(bench,habitat,artifact.id,'0');
  assert.throws(()=>placeConcept(bench,habitat,artifact.id,'0'),/full/);
  assert.equal(bench.placements[0].id,'w1');
  assert.equal(bench.placements.length,MAX_PLACEMENTS);
});
test('workbench saves independently and fails closed without storage',()=>{
  const {habitat,artifact}=approved();
  const bench=makeWorkbench();
  placeConcept(bench,habitat,artifact.id,'0');
  const data=new Map();
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  assert.equal(saveWorkbench(bench,storage),true);
  assert.ok(data.get(WORKBENCH_KEY));
  assert.deepEqual(loadWorkbench(storage),bench);
  assert.equal(saveWorkbench(bench,null),false);
});

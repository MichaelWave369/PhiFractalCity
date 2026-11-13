import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewGate, REVIEW_WINDOW_MS } from '../src/xr-policy.js';

test('approval always needs two matching selections in the same pocket',()=>{
  const first=reviewGate(null,'approve','p3','0/6',1000);
  assert.equal(first.confirmed,false);
  assert.equal(first.armed.key,'approve:p3:0/6');
  assert.equal(reviewGate(first.armed,'approve','p3','0/6',1500).confirmed,true);
  assert.equal(reviewGate(first.armed,'decline','p3','0/6',1500).confirmed,false);
  assert.equal(reviewGate(first.armed,'approve','p4','0/6',1500).confirmed,false);
  assert.equal(reviewGate(first.armed,'approve','p3','0/7',1500).confirmed,false);
});
test('two-step confirmations expire after ten seconds',()=>{
  const first=reviewGate(null,'remove','w12','0',500);
  assert.equal(first.armed.until,500+REVIEW_WINDOW_MS);
  assert.equal(reviewGate(first.armed,'remove','w12','0',500+REVIEW_WINDOW_MS).confirmed,false);
  assert.equal(reviewGate(first.armed,'remove','w12','0',500+REVIEW_WINDOW_MS-1).confirmed,true);
});
test('bad operations and spoofed addresses reject closed',()=>{
  assert.throws(()=>reviewGate(null,'publish','p1','0'),/Invalid/);
  assert.throws(()=>reviewGate(null,'approve','../../secret','0'),/Invalid/);
  assert.throws(()=>reviewGate(null,'approve','p1','0/9'),/Invalid/);
  assert.throws(()=>reviewGate(null,'remove','w0','0'),/Invalid/);
});

test('VR staging cannot write a model reply without matching second confirmation',()=>{
  const first=reviewGate(null,'stage','p1','0/3',1000);
  assert.equal(first.confirmed,false);
  assert.equal(first.armed.action,'stage');
  assert.equal(reviewGate(first.armed,'stage','p1','0/3',2000).confirmed,true);
  assert.equal(reviewGate(first.armed,'stage','p1','0/4',2000).confirmed,false);
  assert.equal(reviewGate(first.armed,'approve','p1','0/3',2000).confirmed,false);
});

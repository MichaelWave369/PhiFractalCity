import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDistrict, childAddress, parentAddress, makeWorld, enterPocket, returnPocket,
  addMemory, memoriesHere, serializeWorld, parseWorld, saveWorld, loadWorld,
  agentStep, setAgentJob, mandelbrotEscape, validateAddress
} from '../src/world.js';

test('pocket addresses have stable hierarchical limits', () => {
  assert.equal(childAddress('0/3', 6), '0/3/6');
  assert.equal(parentAddress('0/3/6'), '0/3');
  assert.equal(parentAddress('0'), '0');
  assert.equal(validateAddress('0/9'), false);
  assert.throws(() => childAddress('0/0/0/0/0/0/0/0/0', 1));
});
test('district generation is deterministic and bounded', () => {
  const a = generateDistrict('0/3/6', 369);
  assert.deepEqual(a, generateDistrict('0/3/6', 369));
  assert.notDeepEqual(a, generateDistrict('0/3/7', 369));
  assert.equal(a.portals.length, 9);
  assert.ok(a.buildings.length < 81 && a.buildings.length > 20);
  assert.equal(mandelbrotEscape(0, 0), 24);
});
test('memory is spatially addressed and survives JSON roundtrip', () => {
  const world = makeWorld();
  enterPocket(world, 3);
  addMemory(world, 'A shared workshop observation.');
  returnPocket(world);
  assert.equal(memoriesHere(world).length, 0);
  enterPocket(world, 3);
  const restored = parseWorld(serializeWorld(world));
  assert.equal(memoriesHere(restored)[0].text, 'A shared workshop observation.');
});
test('resident activity is explicitly opt-in, auditable, and persisted', () => {
  const world = makeWorld();
  assert.equal(agentStep(world), null);
  setAgentJob(world, 'study');
  assert.match(agentStep(world), /Ori/);
  assert.equal(world.memories[0].author, 'ori-001');
  assert.equal(world.memories[0].kind, 'simulation');
  assert.equal(parseWorld(serializeWorld(world)).agents[0].tick, 1);
});
test('rejects invalid imports and oversized notes', () => {
  const world = makeWorld();
  assert.throws(() => addMemory(world, 'x'.repeat(501)));
  assert.throws(() => parseWorld('{"schema":"malicious"}'));
  assert.throws(() => parseWorld('{broken'));
  assert.throws(() => parseWorld('x'.repeat(300001)));
  assert.throws(() => parseWorld(JSON.stringify({...world, memories: [{id:'m1',address:'0',author:'unknown',kind:'note',text:'bad',time:'today'}]})));
});
test('local persistence survives reload and tolerates blocked storage', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) || null, setItem: (key,value) => data.set(key,value) };
  const world = makeWorld();
  addMemory(world, 'Remember the shared plaza.');
  assert.equal(saveWorld(world, storage), true);
  assert.equal(loadWorld(storage).memories[0].text, 'Remember the shared plaza.');
  assert.equal(saveWorld(world, { setItem() { throw new Error('blocked'); } }), false);
  assert.equal(saveWorld(world, null), false);
});

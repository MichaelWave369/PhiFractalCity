import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMFORT_KEY,defaultComfort,validateComfort,loadComfort,saveComfort,cycleComfort,
  readStick,snapTurnRequest,smoothDelta,teleportPoint,clampVisitor
} from '../src/xr-comfort.js';

test('visitor preferences default to teleport and snap turn, independent of world data',()=>{
  const prefs=defaultComfort();
  assert.equal(prefs.locomotion,'teleport');
  assert.equal(prefs.turn,'snap45');
  assert.equal(prefs.panelDistance,1.8);
  assert.deepEqual(validateComfort({...prefs,extra:'ignored'}),prefs);
  assert.throws(()=>validateComfort({...prefs,speed:100}));
  assert.throws(()=>validateComfort({...prefs,panelDistance:-1}));
});
test('preferences cycle only through validated, bounded values',()=>{
  const original=defaultComfort();
  assert.equal(cycleComfort(original,'locomotion').locomotion,'smooth');
  assert.equal(cycleComfort(original,'turn').turn,'off');
  assert.equal(cycleComfort({...original,turn:'snap30'},'turn').turn,'snap45');
  assert.equal(cycleComfort(original,'speed').speed,2.5);
  assert.equal(cycleComfort(original,'panelDistance').panelDistance,2.2);
  assert.equal(original.locomotion,'teleport');
  assert.throws(()=>cycleComfort(original,'customUrl'));
});
test('visitor preferences persist separately and never accept arbitrary stored data',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)||null,setItem:(key,val)=>data.set(key,val)};
  const settings=cycleComfort(defaultComfort(),'speed');
  assert.equal(saveComfort(settings,storage),true);
  assert.deepEqual(loadComfort(storage),settings);
  assert.ok(data.has(COMFORT_KEY));
  assert.equal(saveComfort(settings,null),false);
  data.set(COMFORT_KEY,JSON.stringify({...settings,locomotion:'fly-unlimited'}));
  assert.deepEqual(loadComfort(storage),defaultComfort());
});
test('thumbstick deadzone, finite axes and XR standard axis placement',()=>{
  assert.deepEqual(readStick({axes:[0,0,.8,-.9]}),{x:.8,y:-.9});
  assert.deepEqual(readStick({axes:[.1,-.1]}),{x:0,y:0});
  assert.deepEqual(readStick({axes:[.7,-.6]}),{x:.7,y:-.6});
  assert.deepEqual(readStick({axes:[NaN,Infinity]}),{x:0,y:0});
  assert.deepEqual(readStick(null),{x:0,y:0});
});
test('snap turn requests latch until release, preventing repeated spin',()=>{
  const start=snapTurnRequest(.9,false,'snap45');
  assert.equal(start.latched,true);
  assert.ok(Math.abs(start.radians+Math.PI/4)<1e-8);
  assert.equal(snapTurnRequest(.9,true,'snap45').radians,0);
  assert.equal(snapTurnRequest(.2,true,'snap45').latched,false);
  assert.equal(snapTurnRequest(-.85,false,'snap30').radians,Math.PI/6);
  assert.equal(snapTurnRequest(1,false,'off').radians,0);
});
test('smooth movement follows headset heading with bounded frame delta',()=>{
  const forward=smoothDelta({x:0,y:-1},{x:0,z:-1},.1,1.5);
  assert.equal(forward.x,0);
  assert.ok(Math.abs(forward.z+.15)<1e-8);
  const right=smoothDelta({x:1,y:0},{x:0,z:-1},.1,1.5);
  assert.ok(Math.abs(right.x-.15)<1e-8);
  assert.deepEqual(smoothDelta({x:1,y:1},{x:0,z:-1},5,3.5),{x:0,z:0});
});
test('teleport only accepts short, flat-ground-safe landing points',()=>{
  // Controller 1m above ground, pointing down toward a road.
  assert.deepEqual(teleportPoint({x:0,y:1,z:5},{x:0,y:-1,z:0},{x:0,z:5}),{x:0,z:5});
  assert.equal(teleportPoint({x:0,y:1,z:0},{x:0,y:1,z:0},{x:0,z:0}),null);
  assert.equal(teleportPoint({x:0,y:1,z:0},{x:0,y:-.01,z:-1},{x:0,z:0}),null);
  assert.equal(teleportPoint({x:0,y:1,z:0},{x:0,y:-.15,z:-1},{x:0,z:0}),null);
  // A building occupies the corner of x5,z5.
  assert.equal(teleportPoint({x:5,y:1,z:5},{x:0,y:-1,z:0},{x:0,z:0}),null);
  assert.deepEqual(clampVisitor(99,-99),{x:44,z:-44});
});

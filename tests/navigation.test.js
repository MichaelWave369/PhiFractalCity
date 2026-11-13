import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDistrict} from '../src/world.js';
import {
  NAV_RADIUS,createNavigationMap,isWalkable,clearSegment,
  resolveMotion,safeTeleport,routeDestinations,planPath
} from '../src/navigation.js';

const base=()=>createNavigationMap(generateDistrict('0'),[]);
test('collider map follows deterministic roofs and root public structures',()=>{
  const a=base();
  assert.deepEqual(a,base());
  assert.equal(a.address,'0');
  assert.equal(isWalkable(a,{x:0,z:16}),true);
  assert.equal(isWalkable(a,{x:5,z:5}),false);
  assert.equal(isWalkable(a,{x:0,z:0}),false);
  assert.equal(isWalkable(a,{x:-8,z:0}),false);
  assert.equal(isWalkable(a,{x:8,z:0}),false);
  assert.equal(isWalkable(a,{x:0,z:9}),false);
  assert.equal(isWalkable(a,{x:80,z:0}),false);
  assert.equal(isWalkable(a,{x:NaN,z:0}),false);
});
test('smooth movement stops at geometry and slides along a collision boundary',()=>{
  const map=base(),initial={x:2.95,z:5};
  assert.equal(isWalkable(map,initial),true);
  const wall=resolveMotion(map,initial,{x:.5,z:0});
  assert.equal(wall.blocked,true);
  assert.ok(wall.position.x>=initial.x&&wall.position.x<3.14);
  assert.equal(isWalkable(map,wall.position),true);
  const slide=resolveMotion(map,initial,{x:.45,z:.45});
  assert.equal(slide.blocked,true);
  assert.equal(slide.slid,true);
  assert.equal(isWalkable(map,slide.position),true);
  assert.equal(clearSegment(map,{x:0,z:16},{x:5,z:5}),false);
});
test('swept path prevents high-frame or malformed delta movement',()=>{
  const map=base();
  assert.equal(resolveMotion(map,{x:0,z:16},{x:10,z:0}).blocked,true);
  assert.equal(resolveMotion(map,{x:5,z:5},{x:.1,z:.1}).blocked,true);
  assert.deepEqual(resolveMotion(map,{x:0,z:16},{x:NaN,z:1}).position,{x:0,z:16});
});
test('teleport checks same geometry including workbench objects and public plaza',()=>{
  const district=generateDistrict('0');
  const map=createNavigationMap(district,[{id:'w1',address:'0',x:0,z:16}]);
  assert.equal(safeTeleport(map,{x:0,y:1,z:16},{x:0,y:-1,z:0},{x:0,z:16}),null);
  const clear=base();
  assert.deepEqual(safeTeleport(clear,{x:0,y:1,z:16},{x:0,y:-1,z:0},{x:0,z:16}),{x:0,z:16});
  assert.equal(safeTeleport(clear,{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,z:0}),null);
});
test('walkable route can reach each district-zero landmark without crossing walls',()=>{
  const map=base(),start={x:0,z:16};
  const destinations=routeDestinations('0');
  assert.deepEqual(destinations.map(d=>d.id),['home','workshop','commons','memory']);
  for(const d of destinations){
    const goal={x:d.x,z:d.z};
    assert.equal(isWalkable(map,goal),true,d.id+' destination walkable');
    const route=planPath(map,start,goal);
    assert.ok(route,'route exists to '+d.id);
    assert.ok(route.waypoints.length>=2,'route has waypoints to '+d.id);
    assert.ok(route.distance>0,'route distance exists to '+d.id);
    assert.deepEqual(route.waypoints[0],start);
    assert.deepEqual(route.waypoints.at(-1),goal);
    for(let i=1;i<route.waypoints.length;i++){
      assert.equal(clearSegment(map,route.waypoints[i-1],route.waypoints[i]),true,
        d.id+' segment '+i+' must be safe');
    }
  }
});
test('routes update for child pockets and reject blocked route endpoints',()=>{
  const child=createNavigationMap(generateDistrict('0/3/6'));
  assert.equal(routeDestinations('0/3/6').length,3);
  assert.throws(()=>routeDestinations('0/9'));
  assert.equal(planPath(child,{x:5,z:5},{x:0,z:16}),null);
  const same=planPath(child,{x:0,z:16},{x:0,z:16});
  assert.ok(same);
});
test('placed concepts become colliders without modifying the city world model',()=>{
  const original=generateDistrict('0');
  const nav=createNavigationMap(original,[{id:'w1',address:'0',x:0,z:16}]);
  assert.equal(isWalkable(nav,{x:0,z:16}),false);
  assert.equal(isWalkable(base(),{x:0,z:16}),true);
  assert.equal(original.buildings.length,64);
  assert.throws(()=>createNavigationMap(null),/Invalid district/);
  assert.equal(NAV_RADIUS,.42);
});

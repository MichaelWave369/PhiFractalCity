/* ΦFractalCity R0.9: deterministic walkability and visitor-only route previews.
 * No full physics or independently navigated agents. Collision approximates
 * actual fixed procedural building footprint, root monuments, and local exhibits.
 */
import { teleportPoint } from './xr-comfort.js';

export const NAV_RADIUS = .42;
export const NAV_LIMIT = 44;
export const ROUTE_GRID = 2;
const MAX_MOTION = 1;
const STEP = .14;
const EPSILON = 1e-8;
const ADDRESS = /^0(?:\/[0-8]){0,8}$/;

function rect(id,x,z,hx,hz){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(hx)||!Number.isFinite(hz)||
     hx<=0||hz<=0)throw new Error('Invalid navigation obstacle');
  return {id:String(id),x,z,hx,hz};
}
export function createNavigationMap(district,placements=[]){
  if(!district||!ADDRESS.test(district.address)||!Array.isArray(district.buildings)||
     district.buildings.length>100||!Array.isArray(placements)||placements.length>60) {
    throw new Error('Invalid district navigation input');
  }
  const obstacles=[
    // Central memory pedestal physically occupies the root plaza.
    rect('memory-plaza',0,0,3.65,3.65),
    ...district.buildings.map(b=>{
      if(!b||!Number.isFinite(b.x)||!Number.isFinite(b.z))throw new Error('Invalid building');
      // Includes roof overhang, allowing space around the geometric walls.
      return rect('building:'+b.id,b.x,b.z,1.45,1.45);
    })
  ];
  if(district.address==='0'){
    obstacles.push(rect('ori-home',-8,0,1.3,1.3));
    obstacles.push(rect('open-workshop',8,0,1.4,1.4));
    obstacles.push(rect('commons-garden',0,9,1.35,1.35));
  }
  for(const p of placements){
    if(!p||p.address!==district.address)continue;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw new Error('Invalid placed concept');
    obstacles.push(rect('concept:'+p.id,p.x,p.z,1.06,1.06));
  }
  return {address:district.address,obstacles};
}
export function isWalkable(map,point,radius=NAV_RADIUS){
  if(!map||!Array.isArray(map.obstacles)||!point ||
     !Number.isFinite(point.x)||!Number.isFinite(point.z)||
     !Number.isFinite(radius)||radius<0||radius>1.5 ||
     Math.abs(point.x)>NAV_LIMIT-radius || Math.abs(point.z)>NAV_LIMIT-radius) return false;
  for(const o of map.obstacles){
    const dx=Math.max(Math.abs(point.x-o.x)-o.hx,0);
    const dz=Math.max(Math.abs(point.z-o.z)-o.hz,0);
    if(dx*dx+dz*dz<radius*radius-EPSILON)return false;
    if(dx===0&&dz===0)return false;
  }
  return true;
}
export function clearSegment(map,from,to,radius=NAV_RADIUS){
  if(!isWalkable(map,from,radius)||!isWalkable(map,to,radius))return false;
  const dx=to.x-from.x,dz=to.z-from.z;
  const length=Math.hypot(dx,dz);
  if(!Number.isFinite(length)||length>100)return false;
  const steps=Math.max(1,Math.ceil(length/STEP));
  for(let i=1;i<=steps;i++){
    if(!isWalkable(map,{x:from.x+dx*i/steps,z:from.z+dz*i/steps},radius))return false;
  }
  return true;
}
export function resolveMotion(map,start,delta,radius=NAV_RADIUS){
  if(!isWalkable(map,start,radius) || !delta ||
     !Number.isFinite(delta.x)||!Number.isFinite(delta.z)||
     Math.hypot(delta.x,delta.z)>MAX_MOTION){
    return {position:{x:start?.x??0,z:start?.z??0},blocked:true,slid:false};
  }
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/STEP));
  const vx=delta.x/steps,vz=delta.z/steps;
  const current={x:start.x,z:start.z};
  let blocked=false,slid=false;
  for(let i=0;i<steps;i++){
    const both={x:current.x+vx,z:current.z+vz};
    if(isWalkable(map,both,radius)){current.x=both.x;current.z=both.z;continue;}
    blocked=true;
    const xOnly={x:current.x+vx,z:current.z};
    const zOnly={x:current.x,z:current.z+vz};
    if(isWalkable(map,xOnly,radius)){current.x=xOnly.x;slid=true;}
    else if(isWalkable(map,zOnly,radius)){current.z=zOnly.z;slid=true;}
  }
  return {position:current,blocked,slid};
}
export function safeTeleport(map,origin,direction,head){
  const landing=teleportPoint(origin,direction,head);
  return landing && isWalkable(map,landing) ? landing : null;
}
export function routeDestinations(address){
  if(!ADDRESS.test(address))throw new Error('Invalid pocket destination');
  if(address==='0')return [
    {id:'home',name:"Ori's Home",x:-8,z:3.5},
    {id:'workshop',name:'Open Workshop',x:8,z:3.5},
    {id:'commons',name:'Common Garden',x:0,z:12},
    {id:'memory',name:'Memory Plaza',x:0,z:5}
  ];
  return [
    {id:'memory',name:'Memory Plaza',x:0,z:5},
    {id:'north',name:'North Promenade',x:0,z:-19},
    {id:'south',name:'South Promenade',x:0,z:20}
  ];
}
const WIDTH=NAV_LIMIT/ROUTE_GRID*2+1;
const nToPos=n=>-NAV_LIMIT+n*ROUTE_GRID;
function canHop(map,one,two){
  return clearSegment(map,one,two);
}
function nearestNode(map,point){
  let best=null,score=Infinity;
  for(let i=0;i<WIDTH;i++)for(let j=0;j<WIDTH;j++){
    const p={x:nToPos(i),z:nToPos(j)};
    const dist=(p.x-point.x)**2+(p.z-point.z)**2;
    if(dist>=score||!isWalkable(map,p)||!canHop(map,point,p))continue;
    best={i,j,point:p};score=dist;
  }
  return best;
}
function compress(points){
  if(points.length<=2)return points;
  const out=[points[0]];
  for(let k=1;k<points.length-1;k++){
    const a=out[out.length-1],b=points[k],c=points[k+1];
    const cross=(b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x);
    if(Math.abs(cross)>1e-7)out.push(b);
  }
  out.push(points.at(-1));
  return out;
}
export function planPath(map,start,goal){
  if(!isWalkable(map,start)||!isWalkable(map,goal))return null;
  if(clearSegment(map,start,goal))return {waypoints:[{...start},{...goal}],distance:Math.round(Math.hypot(goal.x-start.x,goal.z-start.z)*10)/10};
  const first=nearestNode(map,start),last=nearestNode(map,goal);
  if(!first||!last)return null;
  const key=(i,j)=>i*WIDTH+j;
  const origin=key(first.i,first.j),target=key(last.i,last.j);
  const heap=[];
  const push=item=>{
    heap.push(item);
    let k=heap.length-1;
    while(k>0){
      const p=(k-1)>>1;
      if(heap[p].f<=item.f)break;
      heap[k]=heap[p];k=p;
    }
    heap[k]=item;
  };
  const pop=()=>{
    const top=heap[0],last=heap.pop();
    if(heap.length){
      let k=0;
      while(k*2+1<heap.length){
        let child=k*2+1;
        if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;
        if(heap[child].f>=last.f)break;
        heap[k]=heap[child];k=child;
      }
      heap[k]=last;
    }
    return top;
  };
  const N=WIDTH*WIDTH;
  const cost=new Float64Array(N).fill(Infinity);
  const previous=new Int32Array(N).fill(-1);
  const closed=new Uint8Array(N);
  const free=new Int8Array(N); // zero=unknown, +1=open, -1=blocked
  const walkable=(i,j)=>{
    if(i<0||j<0||i>=WIDTH||j>=WIDTH)return false;
    const k=key(i,j);
    if(!free[k])free[k]=isWalkable(map,{x:nToPos(i),z:nToPos(j)})?1:-1;
    return free[k]===1;
  };
  const heuristic=(i,j)=>Math.abs(i-last.i)+Math.abs(j-last.j);
  cost[origin]=0;
  push({index:origin,i:first.i,j:first.j,f:heuristic(first.i,first.j)});
  let found=false,expanded=0;
  while(heap.length && expanded<N){
    const node=pop(),k=node.index;
    if(closed[k])continue;
    closed[k]=1;expanded++;
    if(k===target){found=true;break;}
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const i=node.i+di,j=node.j+dj;
      if(!walkable(i,j))continue;
      const nk=key(i,j);
      if(closed[nk])continue;
      const from={x:nToPos(node.i),z:nToPos(node.j)};
      const to={x:nToPos(i),z:nToPos(j)};
      if(!canHop(map,from,to))continue;
      const tentative=cost[k]+1;
      if(tentative>=cost[nk])continue;
      cost[nk]=tentative;previous[nk]=k;
      push({index:nk,i,j,f:tentative+heuristic(i,j)});
    }
  }
  if(!found)return null;
  const nodes=[];
  for(let k=target;k>=0;k=previous[k]){
    const i=Math.floor(k/WIDTH),j=k%WIDTH;
    nodes.push({x:nToPos(i),z:nToPos(j)});
    if(k===origin)break;
  }
  nodes.reverse();
  const waypoints=compress([start,...nodes,goal]);
  const length=waypoints.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-waypoints[i].x,p.z-waypoints[i].z),0);
  // A route preview is a suggestion, not an automated walking command.
  return {waypoints,distance:Math.round(length*10)/10};
}

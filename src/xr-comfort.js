/* R0.8: graphics-independent, bounded Quest comfort preferences and locomotion.
 * Visitor-side preferences only. Never changes the canonical world/habitat schemas.
 * No hardware QA claim: actual controller mappings require on-device verification.
 */
export const COMFORT_KEY='phifractalcity:xr-comfort:v1';
export const COMFORT_SCHEMA='phifractalcity.comfort.v1';
export const MOVEMENT_MODES=Object.freeze(['teleport','smooth']);
export const TURN_MODES=Object.freeze(['snap30','snap45','off']);
export const MOVE_SPEEDS=Object.freeze([1.5,2.5,3.5]);
export const PANEL_DISTANCES=Object.freeze([1.4,1.8,2.2]);
export const MAX_WALK_AREA=44;
export const MAX_TELEPORT_RANGE=18;
const DEADZONE=.22;

export function defaultComfort(){
  return {
    schema:COMFORT_SCHEMA,
    locomotion:'teleport',
    turn:'snap45',
    speed:1.5,
    panelDistance:1.8
  };
}
export function validateComfort(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||
     value.schema!==COMFORT_SCHEMA ||
     !MOVEMENT_MODES.includes(value.locomotion)||
     !TURN_MODES.includes(value.turn)||
     !MOVE_SPEEDS.includes(value.speed)||
     !PANEL_DISTANCES.includes(value.panelDistance)){
    throw new Error('Invalid comfort preferences');
  }
  return {
    schema:COMFORT_SCHEMA,
    locomotion:value.locomotion,
    turn:value.turn,
    speed:value.speed,
    panelDistance:value.panelDistance
  };
}
export function loadComfort(storage){
  try{
    const value=storage?.getItem(COMFORT_KEY);
    return value?validateComfort(JSON.parse(value)):defaultComfort();
  }catch{return defaultComfort();}
}
export function saveComfort(settings,storage){
  const data=JSON.stringify(validateComfort(settings));
  try{
    if(!storage||typeof storage.setItem!=='function')return false;
    storage.setItem(COMFORT_KEY,data);
    return true;
  }catch{return false;}
}
export function cycleComfort(settings,field){
  const pools={
    locomotion:MOVEMENT_MODES,
    turn:TURN_MODES,
    speed:MOVE_SPEEDS,
    panelDistance:PANEL_DISTANCES
  };
  const options=pools[field];
  if(!options)throw new Error('Unknown comfort control');
  const current=validateComfort(settings);
  const index=options.indexOf(current[field]);
  current[field]=options[(index+1)%options.length];
  return current;
}
export function readStick(gamepad){
  const axes=gamepad?.axes;
  if(!axes || axes.length<2)return {x:0,y:0};
  const x=axes.length>=4?axes[2]:axes[0];
  const y=axes.length>=4?axes[3]:axes[1];
  const clean=v=>Number.isFinite(v)&&Math.abs(v)>=DEADZONE?Math.max(-1,Math.min(1,v)):0;
  return {x:clean(x),y:clean(y)};
}
export function snapTurnRequest(x,latched,mode){
  if(!TURN_MODES.includes(mode))throw new Error('Unknown turn preference');
  if(!Number.isFinite(x))x=0;
  if(mode==='off')return {radians:0,latched:false};
  if(Math.abs(x)<.42)return {radians:0,latched:false};
  if(latched||Math.abs(x)<.72)return {radians:0,latched:Boolean(latched)};
  const degrees=mode==='snap30'?30:45;
  // Right stick toward right rotates the world-relative visitor right.
  return {radians:(x>0?-1:1)*degrees*Math.PI/180,latched:true};
}
export function smoothDelta(stick,heading,dt,speed){
  if(!MOVE_SPEEDS.includes(speed)||!Number.isFinite(dt)||dt<=0||dt>.2){
    return {x:0,z:0};
  }
  const x=Number.isFinite(stick?.x)?stick.x:0;
  const y=Number.isFinite(stick?.y)?stick.y:0;
  const hx=Number.isFinite(heading?.x)?heading.x:0;
  const hz=Number.isFinite(heading?.z)?heading.z:0;
  const len=Math.hypot(hx,hz);
  if(!len)return {x:0,z:0};
  const fx=hx/len,fz=hz/len;
  const rx=-fz,rz=fx;
  const step=speed*dt;
  return {x:(rx*x-fx*y)*step,z:(rz*x-fz*y)*step};
}
export function teleportPoint(origin,direction,head){
  const o=origin,d=direction,h=head;
  if(!o||!d||!h||!Number.isFinite(o.x)||!Number.isFinite(o.y)||
     !Number.isFinite(o.z)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||
     !Number.isFinite(d.z)||!Number.isFinite(h.x)||!Number.isFinite(h.z)||
     d.y>=-.12)return null;
  const t=-o.y/d.y;
  if(t<.3||t>30)return null;
  const x=o.x+d.x*t,z=o.z+d.z*t;
  if(!Number.isFinite(x)||!Number.isFinite(z)||
     Math.abs(x)>MAX_WALK_AREA||Math.abs(z)>MAX_WALK_AREA||
     Math.hypot(x-h.x,z-h.z)>MAX_TELEPORT_RANGE)return null;
  // Procedural buildings occupy non-axis grid sites at multiples of five.
  // Prevent selecting a landing in solid building volumes.
  for(let gx=-4;gx<=4;gx++){
    if(gx===0)continue;
    for(let gz=-4;gz<=4;gz++){
      if(gz===0)continue;
      if(Math.abs(x-gx*5)<2.4&&Math.abs(z-gz*5)<2.4)return null;
    }
  }
  return {x:Math.round(x*100)/100,z:Math.round(z*100)/100};
}
export function clampVisitor(x,z){
  return {
    x:Math.min(MAX_WALK_AREA,Math.max(-MAX_WALK_AREA,Number.isFinite(x)?x:0)),
    z:Math.min(MAX_WALK_AREA,Math.max(-MAX_WALK_AREA,Number.isFinite(z)?z:0))
  };
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {
  MAX_DEPTH, generateDistrict, makeWorld, loadWorld, saveWorld, parseWorld, serializeWorld,
  addMemory, memoriesHere, agentStep, setAgentJob, enterPocket, returnPocket, appendEvent
} from './world.js';
import {
  HABITAT_ZONES, makeHabitat, loadHabitat, saveHabitat, parseHabitat,
  exportHabitat, addPrivateNote, proposeCreation, reviewProposal
} from './habitat.js';
import './style.css';

const el = id => document.getElementById(id);
let storage = null;
try { storage = window.localStorage; } catch { /* private/blocked storage */ }
let world = loadWorld(storage);
let habitat = loadHabitat(storage);
let activeZone = null;
let crystal, resident, board;
let toastTimer, lastStep = performance.now();
const container = el('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#091529');
scene.fog = new THREE.FogExp2(0x091529, .011);
const camera = new THREE.PerspectiveCamera(65, 1, .1, 300);
const visitorRig = new THREE.Group();
scene.add(visitorRig);
visitorRig.add(camera);
camera.position.set(19, 20, 27);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
container.appendChild(renderer.domElement);

const vrButton = VRButton.createButton(renderer);
Object.assign(vrButton.style, { position:'absolute', left:'50%', bottom:'18px', zIndex:'5' });
container.appendChild(vrButton);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 2, 0);
orbit.enableDamping = true;
orbit.minDistance = 7;
orbit.maxDistance = 90;
orbit.maxPolarAngle = Math.PI * .48;
orbit.update();

scene.add(new THREE.HemisphereLight(0xa6ccff, 0x141027, 2.2));
const sun = new THREE.DirectionalLight(0xbfc3ff, 2.5);
sun.position.set(25, 45, 10);
scene.add(sun);
const accent = new THREE.PointLight(0x6e63ff, 55, 48, 2);
accent.position.set(0, 11, 0);
scene.add(accent);
const districtRoot = new THREE.Group();
scene.add(districtRoot);
const interactives = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();
const portalColors = ['#61d5ec','#97afff','#a293ff','#d8a6ff','#65edca','#eab1cb','#7b9eff','#79d8de','#b79ffa'];

function mat(color, opts={}) {
  return new THREE.MeshStandardMaterial({ color, roughness:.42, metalness:.32, ...opts });
}
function cube(w,h,d,material,x,y,z,parent=districtRoot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}
function register(mesh, kind, data=null) {
  mesh.userData.interaction = {kind,data};
  interactives.push(mesh);
  return mesh;
}
function label(text,x,y,z,width=4) {
  const canvas=document.createElement('canvas');
  canvas.width=512; canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(11,22,46,.88)';
  ctx.fillRect(4,4,504,120);
  ctx.strokeStyle='#567fa6'; ctx.lineWidth=4; ctx.strokeRect(4,4,504,120);
  ctx.fillStyle='#d6f5ff'; ctx.font='bold 39px system-ui'; ctx.textAlign='center';
  ctx.fillText(text.length>19 ? text.slice(0,18)+'…' : text,256,78);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.position.set(x,y,z);
  sprite.scale.set(width,width/4,1);
  districtRoot.add(sprite);
}
function buildGround() {
  cube(110,.4,110,mat('#101c35'),0,-.24,0);
  const road=mat('#19243d',{roughness:.85,metalness:.05});
  for(let i=-4;i<=4;i++){
    cube(110,.012,1,road,0,.01,i*5+2.5);
    cube(1,.012,110,road,i*5+2.5,.01,0);
  }
  const grid=new THREE.GridHelper(110,22,'#33557c','#1c3455');
  grid.position.y=.04; districtRoot.add(grid);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.cos(a)*9,z=Math.sin(a)*9;
    cube(.12,2.7,.12,mat('#506080'),x,1.4,z);
    const light=new THREE.Mesh(new THREE.IcosahedronGeometry(.2),new THREE.MeshBasicMaterial({color:'#78f0f0'}));
    light.position.set(x,2.9,z);districtRoot.add(light);
  }
}
function buildBuildings(district) {
  const palette=['#263a61','#273955','#302b54','#274c60'];
  const trims=mat('#58618c',{emissive:'#1a2259',emissiveIntensity:.5});
  const lights=[
    new THREE.MeshBasicMaterial({color:'#83eadc'}),
    new THREE.MeshBasicMaterial({color:'#8b91e9'})
  ];
  for(const building of district.buildings){
    const {x,z,height,style}=building;
    cube(3.5,height,3.5,mat(palette[style],{emissive:'#0a1930',emissiveIntensity:.22}),x,height/2+.6,z);
    cube(3.8,.18,3.8,trims,x,height+.7,z);
    for(let j=0;j<Math.floor(height/2.2)+1;j++){
      cube(1.1,.35,.035,lights[j%3===0?0:1],x,1.2+j*1.9,z+1.77);
    }
  }
}
function buildPlaza() {
  cube(9,.25,9,mat('#2e315c'),0,.14,0);
  cube(7,.2,7,mat('#384e70'),0,.3,0);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.5,.35,8),mat('#242b57'));
  pedestal.position.y=.55; districtRoot.add(pedestal);
  crystal=register(new THREE.Mesh(
    new THREE.OctahedronGeometry(1.7),
    mat('#9edaff',{emissive:'#294c95',emissiveIntensity:1.9,metalness:.22,roughness:.06,transparent:true,opacity:.82})
  ),'memory');
  crystal.position.y=3.05; districtRoot.add(crystal);
  const ringMat=new THREE.MeshBasicMaterial({color:'#8cb9ff',transparent:true,opacity:.78});
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(2+i*.47,.024,6,72),ringMat);
    ring.rotation.x=Math.PI/2;
    ring.position.y=1.3+i*.3;
    districtRoot.add(ring);
  }
  label('MEMORY CORE',0,6.6,0,5.2);
}
function buildPortals(district) {
  for(const portal of district.portals){
    const a=portal.index*Math.PI*2/9-Math.PI/2;
    const x=Math.cos(a)*17,z=Math.sin(a)*17;
    const frameRoot=new THREE.Group();
    frameRoot.position.set(x,.25,z);
    frameRoot.rotation.y=-a-Math.PI/2;
    districtRoot.add(frameRoot);
    cube(3.5,.22,2,mat('#182e49'),0,0,0,frameRoot);
    const sealed=district.depth>=MAX_DEPTH;
    const frame=mat(sealed?'#364057':'#465587',{emissive:sealed?'#080c15':'#202c6d',emissiveIntensity:.65});
    cube(.34,3.2,.42,frame,-1.6,1.65,0,frameRoot);
    cube(.34,3.2,.42,frame,1.6,1.65,0,frameRoot);
    cube(3.45,.34,.5,frame,0,3.35,0,frameRoot);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(2.8,2.85),new THREE.MeshBasicMaterial({
      color:portalColors[portal.index],side:THREE.DoubleSide,transparent:true,
      opacity:sealed?.09:.27,depthWrite:false
    }));
    plane.position.y=1.75;frameRoot.add(plane);
    if(!sealed)register(plane,'portal',portal.index);
    const glyph=new THREE.Mesh(new THREE.TorusGeometry(.48,.09,10,40),new THREE.MeshBasicMaterial({color:portalColors[portal.index]}));
    glyph.position.y=1.8;frameRoot.add(glyph);
    if(!sealed)register(glyph,'portal',portal.index);
    label(sealed?'DEPTH LIMIT':'POCKET '+portal.index,x,4.5,z,3.2);
  }
}
function buildResident() {
  resident=register(new THREE.Mesh(new THREE.IcosahedronGeometry(.85,1),
    mat('#76e6e0',{emissive:'#2197b1',emissiveIntensity:2.2,metalness:.15,roughness:.17})
  ),'agent');
  resident.position.set(5.8,2.6,6);districtRoot.add(resident);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.2,.047,8,50),new THREE.MeshBasicMaterial({color:'#8fafff'}));
  halo.rotation.x=Math.PI/2;resident.add(halo);
  label('ORI · RESIDENT',5.8,4.45,6,4.2);
}

function buildHabitatZones(){
  if(world.address!=='0')return;
  const baseColors={home:'#8778e2',workshop:'#5fd5de',commons:'#6ed2a9'};
  HABITAT_ZONES.forEach((zone,index)=>{
    const color=baseColors[zone.id];
    cube(3.3,.28,3.3,mat('#243856'),zone.x,.19,zone.z);
    cube(2.7,.12,2.7,mat(color,{emissive:color,emissiveIntensity:.35}),zone.x,.4,zone.z);
    if(zone.id==='home'){
      const walls=cube(2.0,2,2,mat('#473d75'),zone.x,1.45,zone.z);
      register(walls,'zone',zone.id);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(1.6,1.3,4),
        mat(color,{emissive:color,emissiveIntensity:.25}));
      roof.position.set(zone.x,3.1,zone.z);
      roof.rotation.y=Math.PI/4;
      register(roof,'zone',zone.id);districtRoot.add(roof);
    }else if(zone.id==='workshop'){
      const platform=cube(2.25,.75,2.25,mat('#2b4871'),zone.x,1,zone.z);
      register(platform,'zone',zone.id);
      const gear=new THREE.Mesh(new THREE.TorusKnotGeometry(.65,.17,64,8,2,3),
        mat(color,{emissive:color,emissiveIntensity:.85}));
      gear.position.set(zone.x,2.5,zone.z);
      register(gear,'zone',zone.id);districtRoot.add(gear);
    }else{
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5;
        const tree=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,0),
          mat(color,{emissive:color,emissiveIntensity:.3}));
        tree.position.set(zone.x+Math.cos(a)*.85,1.3,zone.z+Math.sin(a)*.85);
        register(tree,'zone',zone.id);districtRoot.add(tree);
      }
      const garden=cube(2.1,.18,2.1,mat('#275348'),zone.x,.62,zone.z);
      register(garden,'zone',zone.id);
    }
    label(zone.label.toUpperCase(),zone.x,4.4,zone.z,4.0);
  });
}

function buildBoard() {
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=384;
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(7.4,3.7),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
  screen.position.set(0,5,-11.5);
  districtRoot.add(screen);
  board={canvas,texture};
  updateBoard();
}
function updateBoard(){
  if(!board)return;
  const ctx=board.canvas.getContext('2d');
  ctx.fillStyle='rgba(10,18,41,.94)';ctx.fillRect(0,0,768,384);
  ctx.strokeStyle='#5a8da5';ctx.lineWidth=6;ctx.strokeRect(6,6,756,372);
  ctx.fillStyle='#75e4e3';ctx.font='bold 28px system-ui';ctx.fillText('ΦFRACTALCITY  /  LIVE DISTRICT',32,60);
  ctx.fillStyle='#dfe8ff';ctx.font='bold 37px system-ui';ctx.fillText('POCKET '+world.address,32,125);
  ctx.fillStyle='#a6b8d4';ctx.font='26px system-ui';
  ctx.fillText('MEMORIES HERE: '+memoriesHere(world).length,32,181);
  ctx.fillText('ORI: '+(world.agents[0].enabled?world.agents[0].activity.toUpperCase():'IDLE'),32,224);
  ctx.font='20px system-ui';ctx.fillText('TRIGGER A PORTAL TO ENTER',32,294);
  ctx.fillText(activeZone ? 'ZONE: '+activeZone.toUpperCase() : 'TRIGGER CRYSTAL TO LEAVE A MARKER',32,326);
  board.texture.needsUpdate=true;
}
function clearDistrict() {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  districtRoot.traverse(obj=>{
    if(obj.geometry)geometries.add(obj.geometry);
    if(obj.material){
      for(const m of (Array.isArray(obj.material)?obj.material:[obj.material])){
        materials.add(m);if(m.map)textures.add(m.map);
      }
    }
  });
  geometries.forEach(g=>g.dispose());
  textures.forEach(t=>t.dispose());
  materials.forEach(m=>m.dispose());
  districtRoot.clear();
}
function rebuild(){
  clearDistrict();
  interactives.length=0;
  board=null;
  const district=generateDistrict(world.address,world.seed);
  buildGround();buildBuildings(district);buildPlaza();buildPortals(district);buildResident();buildHabitatZones();buildBoard();
  updateUI();
}
function toast(message){
  el('scene-toast').textContent=message;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el('scene-toast').textContent='Select a portal, crystal, or Ori to interact.';},6500);
}
function persist(){
  if(!saveWorld(world,storage))toast('Browser storage unavailable: export JSON to keep progress.');
  updateUI();updateBoard();
}
function persistHabitat(){
  if(!saveHabitat(habitat,storage))toast('Habitat not saved: export a private archive to preserve it.');
  renderHabitat();updateBoard();
}
function updateUI(){
  el('district-name').textContent=generateDistrict(world.address,world.seed).name.toUpperCase();
  el('address-tag').textContent='ADDRESS / '+world.address;
  el('address-readout').textContent=world.address;
  el('depth-metric').textContent=String(world.address.split('/').length-1).padStart(2,'0');
  el('memory-metric').textContent=String(world.memories.length).padStart(2,'0');
  el('agent-job').textContent=world.agents[0].enabled
    ?world.agents[0].activity.toUpperCase()+' / ACTIVE':'IDLE / PAUSED';
  el('agent-job-select').value=world.agents[0].activity;
  el('up-btn').disabled=world.address==='0';
  el('home-btn').disabled=world.address==='0';
  const grid=el('pocket-grid');grid.replaceChildren();
  for(let i=0;i<9;i++){
    const button=document.createElement('button');
    button.className='pocket-tile';
    button.disabled=world.address.split('/').length-1>=MAX_DEPTH;
    const symbol=document.createElement('span');symbol.textContent='◇';
    button.append(symbol,document.createTextNode(' '+i));
    button.title='Enter child pocket '+i;
    button.addEventListener('click',()=>goDeeper(i));
    grid.append(button);
  }
  renderHabitat();
  const list=el('memory-list');list.replaceChildren();
  const notes=memoriesHere(world).slice(-8).reverse();
  if(!notes.length){
    const empty=document.createElement('div');
    empty.className='empty-memory';empty.textContent='No memories stored in this pocket yet.';
    list.append(empty);
  }
  for(const note of notes){
    const entry=document.createElement('article');entry.className='memory-entry';
    const who=document.createElement('strong');
    who.textContent=note.author==='visitor'?'VISITOR MEMORY':'ORI / SIMULATED';
    const text=document.createElement('p');text.textContent=note.text;
    entry.append(who,text);list.append(entry);
  }
}

function renderHabitat(){
  const zones=el('habitat-zones');zones.replaceChildren();
  for(const zone of HABITAT_ZONES){
    const b=document.createElement('button');
    b.className='zone-tile'+(activeZone===zone.id?' active':'');
    const title=document.createElement('strong');title.textContent=zone.label;
    const desc=document.createElement('span');desc.textContent=zone.description;
    b.append(title,desc);
    b.addEventListener('click',()=>openZone(zone.id));
    zones.append(b);
  }
  const privateList=el('private-memory-list');privateList.replaceChildren();
  const privateNotes=habitat.privateNotes.slice(-6).reverse();
  if(!privateNotes.length)privateList.append(emptyMessage('No local resident reflections yet.'));
  for(const note of privateNotes){
    privateList.append(habitatEntry(note.source==='simulated'?'SIMULATED REFLECTION':'VISITOR-SUPPLIED',note.text));
  }
  const pending=habitat.proposals.filter(p=>p.status==='pending').slice(-8).reverse();
  const list=el('proposal-list');list.replaceChildren();
  if(!pending.length)list.append(emptyMessage('No pending proposals. The workshop is ready.'));
  for(const proposal of pending){
    const entry=habitatEntry((proposal.source==='simulated'?'SIMULATED':'VISITOR')+' · '+proposal.kind.toUpperCase(),proposal.summary);
    const actions=document.createElement('div');actions.className='review-row';
    for(const [decision,text] of [['approve','Approve & publish'],['decline','Decline']]){
      const b=document.createElement('button');b.className='button '+(decision==='approve'?'primary':'secondary');
      b.textContent=text;
      b.addEventListener('click',()=>{
        try{
          reviewProposal(habitat,proposal.id,decision);
          appendEvent(world,'workshop','Proposal '+proposal.id+' '+(decision==='approve'?'published':'declined')+'.');
          persist();persistHabitat();
          toast(decision==='approve'?'Creation published in local ledger.':'Proposal declined.');
        }catch(error){toast(error.message);}
      });actions.append(b);
    }
    entry.append(actions);list.append(entry);
  }
  const artifacts=el('artifact-list');artifacts.replaceChildren();
  const approved=habitat.artifacts.slice(-8).reverse();
  if(!approved.length)artifacts.append(emptyMessage('Published creations will appear here.'));
  for(const a of approved){
    artifacts.append(habitatEntry(a.kind.toUpperCase()+' · '+(a.source==='simulated'?'SIMULATED ORIGIN':'VISITOR ORIGIN'),a.summary));
  }
}
function emptyMessage(message){
  const node=document.createElement('div');node.className='empty-memory';node.textContent=message;return node;
}
function habitatEntry(header,body){
  const node=document.createElement('article');node.className='memory-entry';
  const strong=document.createElement('strong');strong.textContent=header;
  const p=document.createElement('p');p.textContent=body;
  node.append(strong,p);return node;
}
function openZone(id){
  const zone=HABITAT_ZONES.find(z=>z.id===id);
  if(!zone)return;
  activeZone=id;
  el('zone-description').textContent=zone.label+' · '+zone.description;
  if(world.address!=='0'){
    world.address='0';appendEvent(world,'travel','Visitor returned to the resident district.');
    persist();rebuild();
  }
  renderHabitat();updateBoard();
  toast('Entered '+zone.label+'. '+(id==='workshop'?'Review proposals in the workshop panel.':'Local world state remains persistent.'));
  if(!renderer.xr.isPresenting){
    const target=id==='home'?'private-panel':id==='workshop'?'workshop-panel':'habitat-panel';
    el(target).scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}
function goDeeper(index){
  activeZone=null;
  try{enterPocket(world,index);persist();rebuild();toast('Entered '+world.address+'. Procedural district restored.');}
  catch(error){toast(error.message);}
}
function goUp(){activeZone=null;returnPocket(world);persist();rebuild();toast('Returned to '+world.address+'.');}
function interact(hit){
  if(!hit)return;
  if(hit.kind==='portal'){goDeeper(hit.data);return;}
  if(hit.kind==='zone'){openZone(hit.data);return;}
  if(hit.kind==='agent'){
    toast('Ori is '+(world.agents[0].enabled?world.agents[0].activity:'idle')+'. Set an activity in the resident panel.');
    return;
  }
  if(hit.kind==='memory'){
    addMemory(world,'A visitor touched the memory crystal in pocket '+world.address+'.',{kind:'marker'});
    persist();toast('Memory marker recorded in this pocket.');
  }
}
function pick(ray){
  const found=ray.intersectObjects(interactives,false);
  return found[0]?.object.userData.interaction||null;
}
const pointer={x:0,y:0,dragged:false};
renderer.domElement.addEventListener('pointerdown',e=>{
  pointer.x=e.clientX;pointer.y=e.clientY;pointer.dragged=false;
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(Math.hypot(pointer.x-e.clientX,pointer.y-e.clientY)>6)pointer.dragged=true;
});
renderer.domElement.addEventListener('pointerup',e=>{
  if(pointer.dragged||renderer.xr.isPresenting)return;
  const bounds=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-bounds.left)/bounds.width)*2-1;
  mouse.y=-((e.clientY-bounds.top)/bounds.height)*2+1;
  raycaster.setFromCamera(mouse,camera);
  interact(pick(raycaster));
});
for(let i=0;i<2;i++){
  const controller=renderer.xr.getController(i);
  const rayLine=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-15)]),
    new THREE.LineBasicMaterial({color:0x80dfed})
  );
  controller.add(rayLine);
  visitorRig.add(controller);
  controller.addEventListener('selectstart',()=>{
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0,0,-1).transformDirection(controller.matrixWorld);
    interact(pick(raycaster));
  });
}
renderer.xr.addEventListener('sessionstart',()=>{
  orbit.enabled=false;
  camera.userData.desktopPosition=camera.position.clone();
  visitorRig.position.set(0,0,16);
  camera.position.set(0,0,0);
  toast('WebXR session started. Point and trigger to interact.');
});
renderer.xr.addEventListener('sessionend',()=>{
  visitorRig.position.set(0,0,0);
  camera.position.copy(camera.userData.desktopPosition||new THREE.Vector3(19,20,27));
  orbit.enabled=true;orbit.target.set(0,2,0);orbit.update();
});
function moveVisitor(dt){
  if(!renderer.xr.isPresenting)return;
  const session=renderer.xr.getSession();
  if(!session)return;
  const source=[...session.inputSources].find(s=>s.handedness==='left'&&s.gamepad);
  if(!source)return;
  const axes=source.gamepad.axes;
  const x=axes.length>=4?axes[2]:axes[0],y=axes.length>=4?axes[3]:axes[1];
  if(Math.hypot(x||0,y||0)<.18)return;
  const heading=new THREE.Vector3();
  renderer.xr.getCamera(camera).getWorldDirection(heading);
  heading.y=0;heading.normalize();
  const right=new THREE.Vector3().crossVectors(heading,new THREE.Vector3(0,1,0)).normalize();
  visitorRig.position.addScaledVector(right,(x||0)*dt*3.5);
  visitorRig.position.addScaledVector(heading,-(y||0)*dt*3.5);
  visitorRig.position.x=THREE.MathUtils.clamp(visitorRig.position.x,-48,48);
  visitorRig.position.z=THREE.MathUtils.clamp(visitorRig.position.z,-48,48);
}
function resize(){
  const width=container.clientWidth,height=Math.max(1,container.clientHeight);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height);
}
new ResizeObserver(resize).observe(container);
window.addEventListener('resize',resize);
function animate(){
  const dt=Math.min(clock.getDelta(),.1);
  if(!renderer.xr.isPresenting)orbit.update();
  moveVisitor(dt);
  const t=performance.now()/1000;
  if(crystal){crystal.rotation.y+=dt*.35;crystal.position.y=3.05+Math.sin(t*1.4)*.15;}
  if(resident){resident.rotation.y+=dt*.4;resident.position.y=2.6+Math.sin(t*1.7)*.22;}
  if(world.agents[0].enabled&&performance.now()-lastStep>8500){
    lastStep=performance.now();
    const note=agentStep(world);
    if(note && world.agents[0].activity==='study' && world.agents[0].tick%3===0){
      addPrivateNote(habitat,'Simulated reflection '+world.agents[0].tick+': geometry observed in '+world.agents[0].address+'.',
        {source:'simulated',address:world.agents[0].address});
      persistHabitat();
    }
    if(note && world.agents[0].activity==='build' && world.agents[0].tick%3===0){
      try{
        proposeCreation(habitat,'Ori proposed a geometric sculpture concept at '+world.agents[0].address+
          ' (simulation tick '+world.agents[0].tick+').',
          {kind:'sculpture',author:'ori-001',source:'simulated',address:world.agents[0].address});
        persistHabitat();
      }catch(error){toast(error.message);}
    }
    persist();
    if(note)toast(note);
  }
  renderer.render(scene,camera);
}
rebuild();resize();renderer.setAnimationLoop(animate);

el('up-btn').addEventListener('click',goUp);
el('home-btn').addEventListener('click',()=>{
  activeZone=null;
  world.address='0';appendEvent(world,'travel','Visitor returned to District Zero.');
  persist();rebuild();toast('Welcome to District Zero.');
});
el('add-note').addEventListener('click',()=>{
  try{
    addMemory(world,el('memory-note').value);
    el('memory-note').value='';
    persist();toast('Memory stored in this pocket.');
  }catch(error){toast(error.message);}
});
el('agent-start').addEventListener('click',()=>{
  setAgentJob(world,el('agent-job-select').value);
  lastStep=performance.now();persist();
  toast('Ori began '+world.agents[0].activity+'. This is a rule-based simulation.');
});
el('agent-pause').addEventListener('click',()=>{
  world.agents[0].enabled=false;
  appendEvent(world,'agent','Ori activity paused by the visitor.');
  persist();toast('Simulation paused. State saved.');
});
el('export-btn').addEventListener('click',()=>{
  const file=new Blob([serializeWorld(world)],{type:'application/json'});
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download='PhiFractalCity-world.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('World archive exported. Keep your copy safe.');
});
el('import-btn').addEventListener('click',()=>el('import-file').click());
el('import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  try{
    if(file.size>300000)throw new Error('World file exceeds 300 KB.');
    const imported=parseWorld(await file.text());
    if(!window.confirm('Replace local world with this archive? Export first if needed.'))return;
    activeZone=null;world=imported;persist();rebuild();toast('World archive imported.');
  }catch(error){toast(error.message);}
});
el('reset-btn').addEventListener('click',()=>{
  if(!window.confirm('Permanently reset this local world? Export your memories first.'))return;
  activeZone=null;world=makeWorld();persist();rebuild();toast('District Zero reset; resident habitat preserved.');
});


el('private-memory-save').addEventListener('click',()=>{
  try{
    addPrivateNote(habitat,el('private-memory-input').value,{source:'visitor-supplied',address:world.address});
    el('private-memory-input').value='';
    persistHabitat();toast('Saved in Ori’s local home vault. Not encrypted.');
  }catch(error){toast(error.message);}
});
el('proposal-submit').addEventListener('click',()=>{
  try{
    const p=proposeCreation(habitat,el('proposal-input').value,{
      kind:el('proposal-kind').value,author:'visitor',source:'visitor-supplied',address:world.address
    });
    el('proposal-input').value='';
    persistHabitat();toast('Proposal '+p.id+' recorded for review. Nothing published yet.');
  }catch(error){toast(error.message);}
});
function downloadArchive(filename,contents){
  const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
el('habitat-export').addEventListener('click',()=>{
  downloadArchive('PhiFractalCity-habitat-public.json',exportHabitat(habitat));
  toast('Public habitat archive exported. Home vault omitted.');
});
el('private-export').addEventListener('click',()=>{
  if(!window.confirm('Export Ori’s local home vault in PLAINTEXT JSON? Anyone with the file can read it.'))return;
  downloadArchive('PhiFractalCity-habitat-private.json',exportHabitat(habitat,{includePrivate:true}));
  toast('Private archive exported in plaintext. Store it carefully.');
});
el('habitat-import').addEventListener('click',()=>el('habitat-file').click());
el('habitat-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  try{
    if(file.size>300000)throw new Error('Habitat file exceeds 300 KB.');
    const data=parseHabitat(await file.text());
    const warning=data.privateNotes.length
      ?'This archive includes '+data.privateNotes.length+' plaintext home-vault entries.':'This is a redacted public archive.';
    if(!window.confirm(warning+' Replace the current local habitat? Export yours first if needed.'))return;
    habitat=data;persistHabitat();toast('Habitat archive imported.');
  }catch(error){toast(error.message);}
});

el('habitat-reset').addEventListener('click',()=>{
  if(!window.confirm('Delete ALL local resident reflections, proposals and published records? Export a private archive first.'))return;
  habitat=makeHabitat();
  activeZone=null;
  persistHabitat();
  renderHabitat();updateBoard();
  toast('Local resident habitat reset; District Zero world history preserved.');
});

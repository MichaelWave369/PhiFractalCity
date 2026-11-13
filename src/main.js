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
import { askLocalModel, makePublicContext, DEFAULT_LOCAL_MODEL } from './inference.js';
import { askPairedBridge } from './bridge-client.js';
import {
  makeWorkbench, loadWorkbench, saveWorkbench, parseWorkbench, exportWorkbench,
  placeConcept, moveConcept, turnConcept, removeConcept
} from './workbench.js';
import { createXRConsole } from './xr-console.js';
import { reviewGate } from './xr-policy.js';
import { promptByIndex, dialogueView } from './xr-dialogue.js';
import { QA_TESTS, makeQA, recordQA, recordFrame, setCheck, summarizeQA, exportQA } from './quest-qa.js';
import {
  defaultComfort,loadComfort,saveComfort,validateComfort,cycleComfort,readStick,
  snapTurnRequest,smoothDelta,teleportPoint,clampVisitor
} from './xr-comfort.js';
import './style.css';

const el = id => document.getElementById(id);
let storage = null;
try { storage = window.localStorage; } catch { /* private/blocked storage */ }
let world = loadWorld(storage);
let habitat = loadHabitat(storage);
let workbench = loadWorkbench(storage);
let selectedPlacementId = null;
let xrTab = 'proposals';
let xrProposalCursor = 0;
let xrArtifactCursor = 0;
let xrPromptCursor = 0;
let xrReplyPage = 0;
let xrDialogueStatus = 'Pair in the 2D panel before asking from VR.';
let armedReview = null;
let activeZone = null;
let selectedArtifact = null;
let latestModelReply = null;
let modelBusy = false;
let qa = makeQA();
let qaCheckCursor = 0;
let comfort = loadComfort(storage);
let xrTurnLatched = false;
let xrTeleportHeld = false;
let xrTeleportTarget = null;
let xrRightController = null;
let pendingConsoleDock = false;
let qaLastUpdatedAt = 0;
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
const xrConsole = createXRConsole(THREE, visitorRig);

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
const teleportMarker = new THREE.Mesh(
  new THREE.RingGeometry(.37,.52,32),
  new THREE.MeshBasicMaterial({color:0x72efd5,side:THREE.DoubleSide,depthWrite:false})
);
teleportMarker.rotation.x=-Math.PI/2;
teleportMarker.visible=false;
teleportMarker.position.y=.07;
scene.add(teleportMarker);
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


function buildArtifactGallery(){
  const local=habitat.artifacts.filter(a=>a.address===world.address).slice(-6);
  if(!local.length)return;
  const x0=world.address==='0'?8:0;
  const z0=world.address==='0'?0:-9;
  const tints={sculpture:'#c8a2ff',garden:'#78edc0',research:'#91ceff',workshop:'#efbe8d'};
  for(const [index,artifact] of local.entries()){
    const angle=index*Math.PI*2/Math.max(local.length,3);
    const x=x0+Math.cos(angle)*2.6;
    const z=z0+Math.sin(angle)*2.6;
    const color=tints[artifact.kind]||'#b8daff';
    const geometry=artifact.kind==='sculpture'?new THREE.DodecahedronGeometry(.46)
      :artifact.kind==='garden'?new THREE.IcosahedronGeometry(.48)
      :artifact.kind==='workshop'?new THREE.BoxGeometry(.72,.72,.72)
      :new THREE.OctahedronGeometry(.55);
    const exhibit=new THREE.Mesh(geometry,mat(color,{emissive:color,emissiveIntensity:1.0}));
    exhibit.position.set(x,2.2,z);
    register(exhibit,'artifact',artifact.id);districtRoot.add(exhibit);
    cube(.95,.12,.95,mat('#395371'),x,1.25,z);
  }
  label('APPROVED CONCEPTS · '+local.length,x0,6.3,z0,6.1);
}

function buildWorkbenchPlacements(){
  const byArtifact=new Map(habitat.artifacts.map(a=>[a.id,a]));
  const tints={sculpture:'#d19ff7',garden:'#67dfaf',research:'#85c9f7',workshop:'#f0bd8c'};
  const display=workbench.placements.filter(p=>p.address===world.address);
  for(const [i,position] of display.entries()){
    const art=byArtifact.get(position.artifactId);
    if(!art)continue; // Unlinked exhibits remain recoverable in layout JSON.
    const color=tints[art.kind]||'#8bc9e6';
    let geometry;
    switch(art.kind){
      case 'sculpture': geometry=new THREE.DodecahedronGeometry(.95);break;
      case 'garden': geometry=new THREE.IcosahedronGeometry(.95,1);break;
      case 'workshop': geometry=new THREE.BoxGeometry(1.65,1.65,1.65);break;
      default: geometry=new THREE.OctahedronGeometry(.95);break;
    }
    const mesh=new THREE.Mesh(geometry,mat(color,{emissive:color,emissiveIntensity:.65,metalness:.1}));
    mesh.position.set(position.x,2,position.z);
    mesh.rotation.y=position.yaw*Math.PI/4;
    register(mesh,'placement',position.id);
    districtRoot.add(mesh);
    cube(1.9,.14,1.9,mat('#344e71'),position.x,.98,position.z);
    if(i<10)label('CONCEPT '+position.id.toUpperCase(),position.x,3.55,position.z,3.5);
  }
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
  const detail=selectedArtifact
    ? 'ARTIFACT '+selectedArtifact.id.toUpperCase()+': '+selectedArtifact.summary.slice(0,28)
    : (activeZone ? 'ZONE: '+activeZone.toUpperCase() : 'TRIGGER CRYSTAL TO LEAVE A MARKER');
  ctx.fillText(detail,32,326);
  ctx.fillStyle='#a9c5f1';ctx.font='17px system-ui';
  ctx.fillText('PLACED CONCEPTS: '+workbench.placements.filter(p=>p.address===world.address).length,32,263);
  if(latestModelReply){
    const clean=latestModelReply.text.replace(/\s+/g,' ').slice(0,64);
    ctx.fillStyle='#b1ecda';ctx.font='18px system-ui';
    ctx.fillText('ORI MODEL (UNVERIFIED): '+clean,32,360);
  }
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
  buildGround();buildBuildings(district);buildPlaza();buildPortals(district);buildResident();buildHabitatZones();buildArtifactGallery();buildWorkbenchPlacements();buildBoard();
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
  renderHabitat();refreshXRConsole();updateBoard();
}
function persistWorkbench(){
  if(!saveWorkbench(workbench,storage))toast('Spatial layout not saved: export JSON to preserve it.');
  renderWorkbenchUI();refreshXRConsole();updateBoard();
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
  renderWorkbenchUI();
  refreshXRConsole();
  el('stage-ori-proposal').disabled = !latestModelReply || modelBusy;
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
    const sourceLabel=proposal.source==='model-generated'
      ? 'MODEL-GENERATED · '+(proposal.model||'UNKNOWN MODEL')
      : proposal.source==='simulated'?'SIMULATED':'VISITOR';
    const entry=habitatEntry(sourceLabel+' · '+proposal.kind.toUpperCase(),proposal.summary);
    const actions=document.createElement('div');actions.className='review-row';
    for(const [decision,text] of [['approve','Approve & publish'],['decline','Decline']]){
      const b=document.createElement('button');b.className='button '+(decision==='approve'?'primary':'secondary');
      b.textContent=text;
      b.addEventListener('click',()=>{
        try{
          reviewProposal(habitat,proposal.id,decision);
          appendEvent(world,'workshop','Proposal '+proposal.id+' '+(decision==='approve'?'published':'declined')+'.');
          persist();persistHabitat();
          if(decision==='approve')rebuild();
          toast(decision==='approve'?'Creation published as an inspectable 3D concept marker.':'Proposal declined.');
        }catch(error){toast(error.message);}
      });actions.append(b);
    }
    entry.append(actions);list.append(entry);
  }
  const artifacts=el('artifact-list');artifacts.replaceChildren();
  const approved=habitat.artifacts.slice(-8).reverse();
  if(!approved.length)artifacts.append(emptyMessage('Published creations will appear here.'));
  for(const a of approved){
    const origin=a.source==='model-generated'?'MODEL · '+(a.model||'UNKNOWN')
      :a.source==='simulated'?'SIMULATED ORIGIN':'VISITOR ORIGIN';
    artifacts.append(habitatEntry(a.kind.toUpperCase()+' · '+origin,a.summary));
  }
}

function currentProposals(){return habitat.proposals.filter(p=>p.status==='pending'&&p.address===world.address);}
function currentArtifacts(){return habitat.artifacts.filter(a=>a.address===world.address);}
function currentPlacements(){return workbench.placements.filter(p=>p.address===world.address);}
function option(value,label){
  const element=document.createElement('option');element.value=value;element.textContent=label;
  return element;
}
function renderWorkbenchUI(){
  const artifacts=currentArtifacts(),placements=currentPlacements();
  const artifactSelect=el('placement-artifact-select');
  const before=artifactSelect.value;
  artifactSelect.replaceChildren();
  if(!artifacts.length)artifactSelect.append(option('','No approved concepts here'));
  for(const art of artifacts)artifactSelect.append(option(art.id,art.id.toUpperCase()+' · '+art.kind));
  if(artifacts.some(a=>a.id===before))artifactSelect.value=before;
  const select=el('placement-select');
  if(!placements.some(p=>p.id===selectedPlacementId))selectedPlacementId=placements[0]?.id||null;
  select.replaceChildren();
  if(!placements.length)select.append(option('','No placed concepts'));
  for(const p of placements)select.append(option(p.id,p.id.toUpperCase()+' · X:'+p.x+' Z:'+p.z));
  if(selectedPlacementId)select.value=selectedPlacementId;
  el('place-artifact').disabled=!artifacts.length;
  for(const id of ['placement-left','placement-right','placement-forward','placement-back',
    'placement-turn','placement-remove'])el(id).disabled=!selectedPlacementId;
}
function refreshXRConsole(){
  const proposals=currentProposals(),artifacts=currentArtifacts();
  xrProposalCursor=proposals.length?((xrProposalCursor%proposals.length)+proposals.length)%proposals.length:0;
  xrArtifactCursor=artifacts.length?((xrArtifactCursor%artifacts.length)+artifacts.length)%artifacts.length:0;
  const current=artifacts[xrArtifactCursor];
  const placement=workbench.placements.find(p=>p.id===selectedPlacementId&&p.address===world.address);
  const armed=armedReview&&armedReview.until>Date.now()?armedReview:null;
  const replyPage=dialogueView(latestModelReply,xrReplyPage);
  xrReplyPage=replyPage.index;
  xrConsole.render({
    pocket:world.address,tab:xrTab,
    proposal:proposals[xrProposalCursor]||null,
    artifact:current||null,
    placement:placement&&current?.id===placement.artifactId?placement:null,
    armedText:armed?'Press again to confirm '+armed.action.toUpperCase():'',
    comfort,
    qa:{
      ...summarizeQA(qa),
      checkIndex:qaCheckCursor,
      checkCount:QA_TESTS.length,
      check:{...QA_TESTS[qaCheckCursor],status:qa.checks[QA_TESTS[qaCheckCursor].id]}
    },
    dialogue:{
      prompt:promptByIndex(xrPromptCursor),
      busy:modelBusy,status:xrDialogueStatus,
      page:replyPage.page,pageCount:replyPage.total,
      pageIndex:replyPage.index,model:replyPage.model,
      armedText:armed?.action==='stage'?'CONFIRM STAGE':''
    }
  });
}
function handleXRAction(action,data){
  if(!renderer.xr.isPresenting)return;
  recordQA(qa,'panel-action');
  const proposals=currentProposals(),artifacts=currentArtifacts();
  const proposal=proposals[xrProposalCursor],artifact=artifacts[xrArtifactCursor];
  const changeTab=tab=>{xrTab=tab;armedReview=null;};
  const refresh=()=>{refreshXRConsole();updateBoard();};
  try{
    switch(action){
      case 'close':xrConsole.hide();toast('XR console hidden. Left grip reopens it.');return;
      case 'tab':changeTab(['gallery','ori','qa','comfort'].includes(data)?data:'proposals');break;
      case 'cycle-movement':updateComfort(cycleComfort(comfort,'locomotion'));break;
      case 'cycle-turn':updateComfort(cycleComfort(comfort,'turn'));break;
      case 'cycle-speed':updateComfort(cycleComfort(comfort,'speed'));break;
      case 'cycle-panel':updateComfort(cycleComfort(comfort,'panelDistance'));pendingConsoleDock=true;break;
      case 'recenter-panel':pendingConsoleDock=true;toast('Panel will be recentered to your current headset direction.');break;
      case 'prev-check':
      case 'next-check':
        qaCheckCursor=(qaCheckCursor+(action==='next-check'?1:-1)+QA_TESTS.length)%QA_TESTS.length;
        break;
      case 'mark-pass':
      case 'mark-fail':
      case 'mark-skip':
        setCheck(qa,QA_TESTS[qaCheckCursor].id,action.slice(5));
        renderQaUI();
        toast('Field result recorded locally: '+QA_TESTS[qaCheckCursor].label+'.');
        break;
      case 'prev-prompt':
      case 'next-prompt':
        xrPromptCursor+=(action==='next-prompt'?1:-1);
        armedReview=null;
        xrDialogueStatus='Ready for your next explicit question.';
        break;
      case 'ask-preset':
        if(modelBusy){toast('Ori is still responding.');break;}
        armedReview=null;
        xrReplyPage=0;
        void requestOri(promptByIndex(xrPromptCursor).question,{fromXR:true});
        break;
      case 'prev-reply':
      case 'next-reply':
        xrReplyPage+=action==='next-reply'?1:-1;
        break;
      case 'stage-reply':{
        if(modelBusy||!latestModelReply){toast('No model response available to stage.');break;}
        const gate=reviewGate(armedReview,'stage','p1',latestModelReply.address);
        armedReview=gate.armed;
        if(!gate.confirmed){toast('Press STAGE again within 10 seconds to add a pending proposal.');break;}
        stageOriProposal();
        xrDialogueStatus='Suggestion staged for workshop review; not published.';
        toast('Suggestion staged. Manual workshop approval is still required.');
        break;
      }
      case 'prev-proposal':xrProposalCursor=Math.max(0,xrProposalCursor-1);armedReview=null;break;
      case 'next-proposal':xrProposalCursor+=1;armedReview=null;break;
      case 'prev-artifact':xrArtifactCursor=Math.max(0,xrArtifactCursor-1);armedReview=null;break;
      case 'next-artifact':xrArtifactCursor+=1;armedReview=null;break;
      case 'approve':
      case 'decline':{
        if(!proposal){toast('No pending proposal in this pocket.');return;}
        const gate=reviewGate(armedReview,action,proposal.id,world.address);
        armedReview=gate.armed;
        if(!gate.confirmed){
          toast('Confirm '+action+' of '+proposal.id+': select the same button again within 10 seconds.');
          break;
        }
        reviewProposal(habitat,proposal.id,action);
        appendEvent(world,'workshop','VR visitor '+(action==='approve'?'approved':'declined')+' '+proposal.id+'.');
        persistHabitat();persist();
        if(action==='approve')rebuild();
        toast('Proposal '+proposal.id+' '+(action==='approve'?'approved as an exhibit concept':'declined')+'.');
        break;
      }
      case 'place':{
        if(!artifact){toast('No approved concept in this pocket.');return;}
        selectedPlacementId=placeConcept(workbench,habitat,artifact.id,world.address).id;
        persistWorkbench();rebuild();toast('Placed '+selectedPlacementId+' (editable concept geometry).');
        break;
      }
      case 'rotate':
        if(!selectedPlacementId)throw new Error('Select a 3D placed concept first');
        turnConcept(workbench,selectedPlacementId,1);
        persistWorkbench();rebuild();break;
      case 'move-left':
      case 'move-right':
      case 'move-forward':
      case 'move-back':{
        if(!selectedPlacementId)throw new Error('Select a 3D placed concept first');
        const step=action==='move-left'?[-1,0]:action==='move-right'?[1,0]:
          action==='move-forward'?[0,-1]:[0,1];
        moveConcept(workbench,selectedPlacementId,...step);
        persistWorkbench();rebuild();break;
      }
      case 'remove':{
        if(!selectedPlacementId)throw new Error('Select a 3D placed concept first');
        const gate=reviewGate(armedReview,'remove',selectedPlacementId,world.address);
        armedReview=gate.armed;
        if(!gate.confirmed){
          toast('Select REMOVE again within 10 seconds to remove this placement.');
          break;
        }
        removeConcept(workbench,selectedPlacementId);
        selectedPlacementId=null;
        persistWorkbench();rebuild();toast('Placement removed. Original approved idea preserved.');break;
      }
      default:toast('Unknown XR workshop action');return;
    }
  }catch(error){toast(error.message);}
  refresh();
}


function renderComfortUI(){
  el('comfort-movement').value=comfort.locomotion;
  el('comfort-turn').value=comfort.turn;
  el('comfort-speed').value=String(comfort.speed);
  el('comfort-distance').value=String(comfort.panelDistance);
  el('comfort-dock').disabled=!renderer.xr.isPresenting;
}
function updateComfort(settings){
  comfort=validateComfort(settings);
  if(!saveComfort(comfort,storage)){
    toast('Comfort settings only saved for this open page; browser storage unavailable.');
  }
  renderComfortUI();refreshXRConsole();
}
for(const [element,field,parse] of [
  ['comfort-movement','locomotion',String],
  ['comfort-turn','turn',String],
  ['comfort-speed','speed',Number],
  ['comfort-distance','panelDistance',Number]
]){
  el(element).addEventListener('change',()=>{
    try{
      const candidate={...comfort,[field]:parse(el(element).value)};
      updateComfort(candidate);
      if(field==='panelDistance')pendingConsoleDock=true;
    }catch(error){renderComfortUI();toast(error.message);}
  });
}
el('comfort-defaults').addEventListener('click',()=>{
  updateComfort(defaultComfort());
  if(renderer.xr.isPresenting)pendingConsoleDock=true;
  toast('Visitor comfort defaults restored.');
});
el('comfort-dock').addEventListener('click',()=>{
  if(!renderer.xr.isPresenting){toast('Enter VR, then recenter from the MOVE tab.');return;}
  pendingConsoleDock=true;
  toast('Panel recenter requested.');
});
renderComfortUI();

function xrHeadPose(){
  const headset=renderer.xr.getCamera(camera);
  if(!headset)return null;
  headset.updateMatrixWorld(true);
  const pos=new THREE.Vector3();
  const forward=new THREE.Vector3();
  headset.getWorldPosition(pos);
  headset.getWorldDirection(forward);
  if(!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||!Number.isFinite(pos.z)||
     !Number.isFinite(forward.x)||!Number.isFinite(forward.z))return null;
  return {pos,forward};
}
function dockConsole(){
  if(!renderer.xr.isPresenting)return false;
  visitorRig.updateMatrixWorld(true);
  const pose=xrHeadPose();
  return pose?xrConsole.dock(pose.pos,pose.forward,comfort.panelDistance):false;
}
function getControllerSource(hand){
  if(!renderer.xr.isPresenting)return null;
  const sources=renderer.xr.getSession()?.inputSources;
  if(!sources)return null;
  return [...sources].find(source=>source.handedness===hand && source.gamepad)||null;
}
function refreshTeleportTarget(){
  xrTeleportTarget=null;
  teleportMarker.visible=false;
  if(!xrTeleportHeld||!renderer.xr.isPresenting||!xrRightController)return;
  const pose=xrHeadPose();
  if(!pose)return;
  xrRightController.updateWorldMatrix(true,false);
  const origin=new THREE.Vector3().setFromMatrixPosition(xrRightController.matrixWorld);
  const direction=new THREE.Vector3(0,0,-1).transformDirection(xrRightController.matrixWorld);
  const result=teleportPoint(origin,direction,pose.pos);
  if(!result)return;
  xrTeleportTarget=result;
  teleportMarker.position.set(result.x,.07,result.z);
  teleportMarker.visible=true;
}
function commitTeleport(){
  refreshTeleportTarget();
  const target=xrTeleportTarget;
  xrTeleportHeld=false;
  xrTeleportTarget=null;
  teleportMarker.visible=false;
  if(!target){toast('No safe, reachable road target. Aim at a clear section of ground.');return;}
  const pose=xrHeadPose();
  if(!pose)return;
  // Move the headset's actual horizontal world position to the chosen ground point.
  const next=clampVisitor(
    visitorRig.position.x+target.x-pose.pos.x,
    visitorRig.position.z+target.z-pose.pos.z
  );
  visitorRig.position.x=next.x;
  visitorRig.position.z=next.z;
  recordQA(qa,'teleport-move');
  pendingConsoleDock=true;
  toast('Teleported to safe ground. Recenter the console using MOVE if necessary.');
}
function snapRigAtHead(radians){
  if(!renderer.xr.isPresenting||!Number.isFinite(radians)||radians===0)return;
  const before=xrHeadPose()?.pos;
  if(!before)return;
  visitorRig.rotation.y+=radians;
  visitorRig.updateMatrixWorld(true);
  const after=xrHeadPose()?.pos;
  if(after){
    const next=clampVisitor(
      visitorRig.position.x+before.x-after.x,
      visitorRig.position.z+before.z-after.z
    );
    visitorRig.position.x=next.x;
    visitorRig.position.z=next.z;
  }
  recordQA(qa,'snap-turn');
  // Console remains docked at the visitor's old view until they explicitly recenter.
}
function updateXRComfort(dt){
  if(!renderer.xr.isPresenting)return;
  if(pendingConsoleDock){
    pendingConsoleDock=false;
    if(!dockConsole())pendingConsoleDock=true;
  }
  if(xrTeleportHeld)refreshTeleportTarget();
  const right=readStick(getControllerSource('right')?.gamepad);
  const turn=snapTurnRequest(right.x,xrTurnLatched,comfort.turn);
  xrTurnLatched=turn.latched;
  if(turn.radians)snapRigAtHead(turn.radians);
  if(comfort.locomotion!=='smooth')return;
  const left=readStick(getControllerSource('left')?.gamepad);
  if(!left.x&&!left.y)return;
  const forward=xrHeadPose()?.forward;
  if(!forward)return;
  const movement=smoothDelta(left,forward,dt,comfort.speed);
  const next=clampVisitor(visitorRig.position.x+movement.x,visitorRig.position.z+movement.z);
  visitorRig.position.x=next.x;
  visitorRig.position.z=next.z;
}
function renderQaUI(){
  const summary=summarizeQA(qa);
  const frames=summary.frame;
  const stats=el('qa-stats');
  stats.replaceChildren();
  for(const [label,value] of [
    ['VR sessions',summary.sessions],
    ['Input / event observations',summary.eventCount],
    ['Manual passes',summary.counts.pass],
    ['Manual failures',summary.counts.fail],
    ['JS frame avg (ms)',frames.meanMs===null?'—':frames.meanMs],
    ['JS frame p95 (ms)',frames.p95Ms===null?'—':frames.p95Ms]
  ]){
    const tile=document.createElement('div');tile.className='qa-stat';
    const key=document.createElement('span');key.textContent=label;
    const number=document.createElement('strong');number.textContent=String(value);
    tile.append(key,number);stats.append(tile);
  }
  const list=el('qa-tests');list.replaceChildren();
  for(const test of QA_TESTS){
    const item=document.createElement('div');item.className='qa-test';
    const heading=document.createElement('strong');heading.textContent=test.label;
    const detail=document.createElement('p');detail.textContent=test.detail;
    const status=document.createElement('span');status.className='qa-outcome';
    status.textContent='MANUAL · '+qa.checks[test.id].toUpperCase();
    const controls=document.createElement('div');controls.className='qa-actions';
    for(const [kind,title] of [['pass','Pass'],['fail','Fail'],['skip','Skip'],['untested','Clear']]){
      const button=document.createElement('button');
      button.className='button secondary'+(qa.checks[test.id]===kind?' selected':'');
      button.textContent=title;
      button.title=title+' '+test.label;
      button.addEventListener('click',()=>{
        setCheck(qa,test.id,kind);
        renderQaUI();refreshXRConsole();
      });
      controls.append(button);
    }
    item.append(heading,detail,status,controls);list.append(item);
  }
}
el('qa-export').addEventListener('click',()=>{
  try{
    downloadArchive('PhiFractalCity-quest-field-lab.json',exportQA(qa));
    toast('Redacted QA report exported locally. No network upload.');
  }catch(error){toast(error.message);}
});
el('qa-clear').addEventListener('click',()=>{
  if(!window.confirm('Clear this page’s field observations and manual test results? Export the report first.'))return;
  qa=makeQA();qaCheckCursor=0;
  renderQaUI();refreshXRConsole();
  toast('Field Lab reset. No world, habitat or workbench state changed.');
});
el('qa-storage-probe').addEventListener('click',()=>{
  const key='phifractalcity:qa-probe:'+Date.now();
  try{
    if(!storage)throw new Error('Browser storage is unavailable');
    storage.setItem(key,'ok');
    if(storage.getItem(key)!=='ok')throw new Error('Storage read-back mismatch');
    recordQA(qa,'storage-test-success');
    toast('Browser storage read/write works now; reload persistence still needs manual testing.');
  }catch(error){
    recordQA(qa,'storage-test-fail');
    toast('Browser storage check failed: '+error.message);
  }finally{
    try{storage?.removeItem(key);}catch{ /* blocked cleanup */ }
  }
  renderQaUI();refreshXRConsole();
});
renderQaUI();
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
  selectedArtifact=null;
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
  selectedArtifact=null;
  try{
    enterPocket(world,index);
    if(renderer.xr.isPresenting)recordQA(qa,'pocket-travel');
    persist();rebuild();
    toast('Entered '+world.address+'. Procedural district restored.');
  }
  catch(error){toast(error.message);}
}
function goUp(){
  activeZone=null;selectedArtifact=null;
  returnPocket(world);
  if(renderer.xr.isPresenting)recordQA(qa,'pocket-travel');
  persist();rebuild();toast('Returned to '+world.address+'.');
}
function interact(hit){
  if(!hit)return;
  if(hit.kind==='portal'){goDeeper(hit.data);return;}
  if(hit.kind==='zone'){openZone(hit.data);return;}
  if(hit.kind==='xr-console'){handleXRAction(hit.action,hit.data);return;}
  if(hit.kind==='placement'){
    selectedPlacementId=hit.data;
    renderWorkbenchUI();refreshXRConsole();
    const chosen=workbench.placements.find(p=>p.id===hit.data);
    toast(chosen?'Selected spatial concept '+chosen.id+'.':'Spatial concept not found.');
    return;
  }
  if(hit.kind==='artifact'){
    selectedArtifact=habitat.artifacts.find(a=>a.id===hit.data)||null;
    updateBoard();
    if(selectedArtifact)toast('Approved concept: '+selectedArtifact.summary+' ('+selectedArtifact.source+').');
    return;
  }
  if(hit.kind==='agent'){
    toast(latestModelReply
      ? 'Ori last model reply: '+latestModelReply.text.slice(0,180)
      : 'Ori is '+(world.agents[0].enabled?world.agents[0].activity:'idle')+'. Use Talk to Ori for an explicit local model request.');
    return;
  }
  if(hit.kind==='memory'){
    addMemory(world,'A visitor touched the memory crystal in pocket '+world.address+'.',{kind:'marker'});
    persist();toast('Memory marker recorded in this pocket.');
  }
}
function pick(ray){
  const targets=renderer.xr.isPresenting && xrConsole.isVisible()
    ? interactives.concat(xrConsole.targets) : interactives;
  const found=ray.intersectObjects(targets,false);
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
  if(i===0)controller.addEventListener('squeezestart',()=>{
    if(!renderer.xr.isPresenting)return;
    recordQA(qa,'left-grip');
    const visible=xrConsole.toggle();
    recordQA(qa,visible?'console-open':'console-close');
    if(visible)refreshXRConsole();
    renderQaUI();
    toast(visible?'XR workshop console opened.':'XR workshop console hidden.');
  });
  controller.addEventListener('selectstart',()=>{
    if(renderer.xr.isPresenting)recordQA(qa,'controller-select');
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0,0,-1).transformDirection(controller.matrixWorld);
    interact(pick(raycaster));
  });
}
renderer.xr.addEventListener('sessionstart',()=>{
  recordQA(qa,'xr-enter');
  renderQaUI();
  orbit.enabled=false;
  camera.userData.desktopPosition=camera.position.clone();
  visitorRig.position.set(0,0,16);
  camera.position.set(0,0,0);
  xrConsole.show();refreshXRConsole();
  toast('WebXR session started. Point and trigger to interact. Use left grip to toggle the workshop.');
});
renderer.xr.addEventListener('sessionend',()=>{
  recordQA(qa,'xr-exit');
  renderQaUI();
  xrConsole.hide();
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
  const rawDt=clock.getDelta();
  const dt=Math.min(rawDt,.1);
  if(renderer.xr.isPresenting){
    recordFrame(qa,rawDt*1000);
    const now=performance.now();
    if(now-qaLastUpdatedAt>3500){
      qaLastUpdatedAt=now;
      if(xrTab==='qa'&&xrConsole.isVisible())refreshXRConsole();
      renderQaUI();
    }
  }else orbit.update();
  moveVisitor(dt);
  const t=performance.now()/1000;
  if(crystal){crystal.rotation.y+=dt*.35;crystal.position.y=3.05+Math.sin(t*1.4)*.15;}
  if(resident){resident.rotation.y+=dt*.4;resident.position.y=2.6+Math.sin(t*1.7)*.22;}
  if(world.agents[0].enabled&&performance.now()-lastStep>8500){
    lastStep=performance.now();
    const note=agentStep(world);
    if(note && world.agents[0].activity==='study' && world.agents[0].tick%3===0){
      try{
        addPrivateNote(habitat,'Simulated reflection '+world.agents[0].tick+': geometry observed in '+world.agents[0].address+'.',
          {source:'simulated',address:world.agents[0].address});
        persistHabitat();
      }catch(error){
        world.agents[0].enabled=false;
        toast(error.message+' Ori paused; export or reset the habitat.');
      }
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
    habitat=data;selectedArtifact=null;persistHabitat();rebuild();toast('Habitat archive imported.');
  }catch(error){toast(error.message);}
});

el('habitat-reset').addEventListener('click',()=>{
  if(!window.confirm('Delete ALL local resident reflections, proposals and published records? Export a private archive first.'))return;
  habitat=makeHabitat();
  activeZone=null;selectedArtifact=null;
  rebuild();
  persistHabitat();
  renderHabitat();updateBoard();
  toast('Local resident habitat reset; District Zero world history preserved.');
});


/* Single-request conversation: explicit user click, no background polling, no automatic memory writes. */
function displayModelStatus(message){
  el('model-state').textContent=message;
}
function showBridgeOptions(){
  const paired=el('ori-transport').value==='bridge';
  el('paired-settings').hidden=!paired;
  if(!modelBusy)displayModelStatus(paired
    ? 'Paired HTTPS LAN mode · no connection until Ask is pressed.'
    : 'Local Ollama mode · no connection until Ask is pressed.');
}
el('ori-transport').addEventListener('change',showBridgeOptions);
el('bridge-disconnect').addEventListener('click',()=>{
  if(modelBusy){toast('Request in progress; pairing cannot be changed.');return;}
  el('bridge-token').value='';
  latestModelReply=null;
  el('model-reply').textContent='No response yet.';
  el('stage-ori-proposal').disabled=true;
  displayModelStatus('Pairing token forgotten for this page session.');
  updateBoard();
});
showBridgeOptions();
async function requestOri(prompt,{fromXR=false}={}){
  if(modelBusy)return;
  const model=el('local-model-name').value.trim()||DEFAULT_LOCAL_MODEL;
  const requestedPocket=world.address;
  const transport=el('ori-transport').value;
  if(fromXR)recordQA(qa,'model-attempt');
  modelBusy=true;
  latestModelReply=null;
  armedReview=null;
  xrReplyPage=0;
  xrDialogueStatus='Sending one explicit request; no private memories.';
  el('ask-ori').disabled=true;
  el('ori-transport').disabled=true;
  el('stage-ori-proposal').disabled=true;
  el('model-reply').textContent=transport==='bridge'
    ? 'Contacting your paired HTTPS PC bridge…'
    : 'Contacting your local Ollama runtime…';
  displayModelStatus('One-shot request · only current public pocket context; no private vault.');
  refreshXRConsole();updateBoard();
  try{
    // VR must use an explicitly paired service. Headset localhost is NOT the PC.
    if(fromXR&&transport!=='bridge'){
      throw new Error('Choose and pair the HTTPS PC bridge in the 2D panel before asking from Quest VR.');
    }
    const context=makePublicContext(world,habitat);
    const result=transport==='bridge'
      ? await askPairedBridge({
          prompt,model,context,
          endpoint:el('bridge-url').value.trim(),
          token:el('bridge-token').value.trim()
        })
      : await askLocalModel({prompt,model,context});
    latestModelReply={...result,address:requestedPocket};
    if(fromXR)recordQA(qa,'model-success');
    xrDialogueStatus='Model '+latestModelReply.model+' replied · UNVERIFIED';
    el('model-reply').textContent=latestModelReply.text;
    displayModelStatus('Received · '+latestModelReply.endpoint+' · model '+latestModelReply.model+
      ' · pocket '+latestModelReply.address+' · unverified; not saved to world memory.');
    toast('Ori replied. Read the pages and review before staging.');
  }catch(error){
    if(fromXR)recordQA(qa,'model-error');
    latestModelReply=null;
    xrDialogueStatus=String(error.message).slice(0,115);
    el('model-reply').textContent='No usable response.';
    displayModelStatus(error.message);
    toast(error.message);
  }finally{
    modelBusy=false;
    el('ask-ori').disabled=false;
    el('ori-transport').disabled=false;
    el('stage-ori-proposal').disabled=!latestModelReply;
    refreshXRConsole();updateBoard();
  }
}
el('ask-ori').addEventListener('click',()=>void requestOri(el('ori-question').value));
el('clear-ori').addEventListener('click',()=>{
  if(modelBusy){toast('Current request must complete or time out.');return;}
  latestModelReply=null;
  el('model-reply').textContent='No response yet.';
  el('stage-ori-proposal').disabled=true;
  displayModelStatus('Cleared · nothing stored in the world.');
  xrDialogueStatus='Reply cleared; no response stored.';
  xrReplyPage=0;
  armedReview=null;
  refreshXRConsole();updateBoard();
});
function stageOriProposal(){
  if(modelBusy || !latestModelReply)throw new Error('No model reply available to stage');
  const proposal=proposeCreation(habitat,latestModelReply.text.slice(0,490),{
    kind:'research',author:'ori-001',source:'model-generated',
    address:latestModelReply.address,model:latestModelReply.model
  });
  persistHabitat();
  return proposal;
}
el('stage-ori-proposal').addEventListener('click',()=>{
  try{
    const proposal=stageOriProposal();
    toast('Model suggestion '+proposal.id+' staged. Human approval still required.');
    el('workshop-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){toast(error.message);}
});


/* Desktop acceptance lane for the same reviewed spatial placement operations used in XR. */
el('placement-select').addEventListener('change',value=>{
  selectedPlacementId=value.target.value||null;
  refreshXRConsole();
});
el('place-artifact').addEventListener('click',()=>{
  try{
    const artId=el('placement-artifact-select').value;
    selectedPlacementId=placeConcept(workbench,habitat,artId,world.address).id;
    persistWorkbench();rebuild();
    toast('3D concept placement '+selectedPlacementId+' saved locally.');
  }catch(error){toast(error.message);}
});
function editPlacement(action){
  try{
    if(!selectedPlacementId)throw new Error('Select a placed concept first');
    if(action==='rotate')turnConcept(workbench,selectedPlacementId,1);
    else{
      const delta={left:[-1,0],right:[1,0],forward:[0,-1],back:[0,1]}[action];
      if(!delta)throw new Error('Unknown placement action');
      moveConcept(workbench,selectedPlacementId,...delta);
    }
    persistWorkbench();rebuild();toast('Placement updated. Export the layout for a portable backup.');
  }catch(error){toast(error.message);}
}
for(const [id,action] of [
  ['placement-left','left'],['placement-right','right'],
  ['placement-forward','forward'],['placement-back','back'],
  ['placement-turn','rotate']
]){
  el(id).addEventListener('click',()=>editPlacement(action));
}
el('placement-remove').addEventListener('click',()=>{
  if(!selectedPlacementId)return;
  if(!window.confirm('Remove this local 3D placement? Its approved concept will remain published.'))return;
  try{
    removeConcept(workbench,selectedPlacementId);
    selectedPlacementId=null;
    persistWorkbench();rebuild();toast('Placement removed; approved concept still preserved.');
  }catch(error){toast(error.message);}
});
el('workbench-export').addEventListener('click',()=>{
  downloadArchive('PhiFractalCity-workbench.json',exportWorkbench(workbench));
  toast('Spatial workbench JSON exported. Keep your world and habitat backups separately.');
});
el('workbench-import').addEventListener('click',()=>el('workbench-file').click());
el('workbench-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  try{
    if(file.size>60000)throw new Error('Workbench file exceeds 60 KB.');
    const incoming=parseWorkbench(await file.text());
    if(!window.confirm('Replace local 3D layout from this file? Export your existing layout first.'))return;
    workbench=incoming;
    selectedPlacementId=null;
    persistWorkbench();rebuild();toast('Spatial layout imported. Unlinked exhibits are retained as data but not drawn.');
  }catch(error){toast(error.message);}
});
